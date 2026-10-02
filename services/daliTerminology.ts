import { supabase } from './supabaseClient';
import { db } from './supabaseDb';

export type TerminologyType =
  | 'entity' | 'field' | 'status' | 'port' | 'customer' | 'shipper'
  | 'trucker' | 'genset' | 'booking' | 'container' | 'maintenance'
  | 'invoice' | 'operation' | 'action' | 'intent';

export type TerminologyRecord = {
  id?: string;
  canonical_value: string;
  canonical_type: TerminologyType;
  alias: string;
  normalized_alias: string;
  language: 'ar' | 'en' | 'mixed';
  alias_type: 'canonical' | 'manual' | 'system' | 'typo' | 'equivalent' | 'correction';
  context: string[];
  confidence: number;
  usage_count?: number;
  source?: string;
  status?: 'approved' | 'pending' | 'rejected';
  metadata?: Record<string, unknown>;
};

export type TerminologyMatch = TerminologyRecord & {
  score: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'normalized';
};

export type IntentMatch = {
  intent: 'COUNT' | 'LIST' | 'SEARCH' | 'LOCATION' | 'STATUS' | 'DETAIL' | 'UNKNOWN';
  confidence: number;
  entities: Array<{ type: TerminologyType; canonical: string; alias: string; confidence: number }>;
  candidates: TerminologyMatch[];
};

const ARABIC_DIACRITICS = /[ًٌٍَُِّْـ]/g;
const ARABIC_MAP: Record<string, string> = { 'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي' };

export function normalizeTerminology(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[أإآٱةىؤئ]/g, c => ARABIC_MAP[c] || c)
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[-_/.]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function languageOf(value: string): 'ar'|'en'|'mixed' {
  const ar = /[\u0600-\u06ff]/.test(value);
  const en = /[A-Za-z]/.test(value);
  return ar && en ? 'mixed' : ar ? 'ar' : 'en';
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({length:b.length+1}, (_,i)=>i);
  for (let i=1;i<=a.length;i++) {
    let left = i;
    for (let j=1;j<=b.length;j++) {
      const cur = prev[j];
      prev[j] = Math.min(prev[j]+1, left+1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      left = prev[j];
    }
  }
  return prev[b.length];
}

function fuzzyScore(input: string, target: string): number {
  const a = normalizeTerminology(input), b = normalizeTerminology(target);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.replace(/\s/g,'') === b.replace(/\s/g,'')) return 0.95;
  const distance = levenshtein(a.replace(/\s/g,''), b.replace(/\s/g,''));
  const max = Math.max(a.length, b.length);
  return max ? Math.max(0, 1 - distance / max) : 0;
}

const BUILTIN: Array<Omit<TerminologyRecord,'id'|'normalized_alias'>> = [
  {canonical_value:'Genset',canonical_type:'entity',alias:'genset',language:'en',alias_type:'canonical',context:['fleet','operation'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'generator',language:'en',alias_type:'equivalent',context:['fleet','operation'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'gen set',language:'en',alias_type:'equivalent',context:['fleet'],confidence:.98,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'gen-set',language:'en',alias_type:'equivalent',context:['fleet'],confidence:.98,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'مولد',language:'ar',alias_type:'equivalent',context:['fleet','operation'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'مولد كهرباء',language:'ar',alias_type:'equivalent',context:['fleet'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'مولدات',language:'ar',alias_type:'equivalent',context:['fleet'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Genset',canonical_type:'entity',alias:'G/S',language:'en',alias_type:'equivalent',context:['fleet'],confidence:.90,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'Port Said',language:'en',alias_type:'canonical',context:['location','port'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'Portsaid',language:'en',alias_type:'equivalent',context:['location'],confidence:.98,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'Port-Said',language:'en',alias_type:'equivalent',context:['location'],confidence:.98,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'بورسعيد',language:'ar',alias_type:'equivalent',context:['location'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'بور سعيد',language:'ar',alias_type:'equivalent',context:['location'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Port Said',canonical_type:'port',alias:'PS',language:'en',alias_type:'equivalent',context:['location'],confidence:.90,source:'system',status:'approved'},
  {canonical_value:'Sokhna',canonical_type:'port',alias:'Sokhna',language:'en',alias_type:'canonical',context:['location','port'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Sokhna',canonical_type:'port',alias:'Ain Sokhna',language:'en',alias_type:'equivalent',context:['location'],confidence:.98,source:'system',status:'approved'},
  {canonical_value:'Sokhna',canonical_type:'port',alias:'السخنة',language:'ar',alias_type:'equivalent',context:['location'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Sokhna',canonical_type:'port',alias:'العين السخنة',language:'ar',alias_type:'equivalent',context:['location'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Maintenance',canonical_type:'status',alias:'maintenance',language:'en',alias_type:'canonical',context:['genset'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Maintenance',canonical_type:'status',alias:'maintainance',language:'en',alias_type:'typo',context:['genset'],confidence:.90,source:'system',status:'approved'},
  {canonical_value:'Maintenance',canonical_type:'status',alias:'صيانة',language:'ar',alias_type:'equivalent',context:['genset'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Stock',canonical_type:'status',alias:'stock',language:'en',alias_type:'canonical',context:['genset'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Stock',canonical_type:'status',alias:'المخزون',language:'ar',alias_type:'equivalent',context:['genset'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Operation',canonical_type:'entity',alias:'operation',language:'en',alias_type:'canonical',context:['booking','genset'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Operation',canonical_type:'entity',alias:'التشغيل',language:'ar',alias_type:'equivalent',context:['booking','genset'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Booking',canonical_type:'entity',alias:'booking',language:'en',alias_type:'canonical',context:['operation'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Booking',canonical_type:'entity',alias:'حجز',language:'ar',alias_type:'equivalent',context:['operation'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Container',canonical_type:'entity',alias:'container',language:'en',alias_type:'canonical',context:['operation'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Container',canonical_type:'entity',alias:'حاوية',language:'ar',alias_type:'equivalent',context:['operation'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'Customer',canonical_type:'customer',alias:'customer',language:'en',alias_type:'canonical',context:['invoice','operation'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'Customer',canonical_type:'customer',alias:'عميل',language:'ar',alias_type:'equivalent',context:['invoice','operation'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'COUNT',canonical_type:'intent',alias:'how many',language:'en',alias_type:'canonical',context:['count'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'COUNT',canonical_type:'intent',alias:'عدد',language:'ar',alias_type:'canonical',context:['count'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'COUNT',canonical_type:'intent',alias:'كام',language:'ar',alias_type:'equivalent',context:['count'],confidence:.95,source:'system',status:'approved'},
  {canonical_value:'LIST',canonical_type:'intent',alias:'show',language:'en',alias_type:'canonical',context:['list'],confidence:1,source:'system',status:'approved'},
  {canonical_value:'LIST',canonical_type:'intent',alias:'اعرض',language:'ar',alias_type:'equivalent',context:['list'],confidence:.95,source:'system',status:'approved'},
];

function staticRecords(): TerminologyRecord[] {
  return BUILTIN.map(x => ({...x, normalized_alias: normalizeTerminology(x.alias)}));
}

export async function getTerminology(limit = 1500): Promise<TerminologyRecord[]> {
  const {data,error} = await supabase.from('dali_terminology').select('*').eq('status','approved').order('usage_count',{ascending:false}).limit(limit);
  if(error) {
    console.warn('DALI terminology dictionary unavailable:', error.message);
    return staticRecords();
  }
  return [...staticRecords(), ...((data || []) as TerminologyRecord[])];
}

export function matchTerminology(input: string, records: TerminologyRecord[]): IntentMatch {
  const normalizedInput = normalizeTerminology(input);
  const tokens = normalizedInput.split(' ').filter(Boolean);
  const matches: TerminologyMatch[] = [];
  for (const record of records) {
    const target = record.normalized_alias || normalizeTerminology(record.alias);
    if (!target) continue;
    const exact = normalizedInput.includes(target);
    if (exact) matches.push({...record, score:record.confidence, matchType:'exact'});
    else {
      const tokenScore = tokens.reduce((best,t)=>Math.max(best,fuzzyScore(t,target)),0);
      const wholeScore = fuzzyScore(normalizedInput,target);
      const score = Math.max(tokenScore * .94, wholeScore) * record.confidence;
      if (score >= .84) matches.push({...record, score, matchType:'fuzzy'});
      else if (score >= .70) matches.push({...record, score, matchType:'normalized'});
    }
  }
  matches.sort((a,b)=>b.score-a.score);
  const dedup = new Map<string,TerminologyMatch>();
  for(const m of matches) {
    const key = m.canonical_type+'|'+m.canonical_value;
    const prior=dedup.get(key);
    if(!prior || m.score>prior.score) dedup.set(key,m);
  }
  const top=[...dedup.values()].sort((a,b)=>b.score-a.score);
  const intent = top.find(x=>x.canonical_type==='intent');
  const entities = top.filter(x=>x.canonical_type!=='intent').slice(0,12).map(x=>({type:x.canonical_type,canonical:x.canonical_value,alias:x.alias,confidence:x.score}));
  return {
    intent: (intent?.canonical_value as IntentMatch['intent']) || inferIntent(input),
    confidence: intent?.score || .55,
    entities,
    candidates: top.slice(0,20)
  };
}

function inferIntent(input:string): IntentMatch['intent'] {
  const n=normalizeTerminology(input);
  if(/how many|count|number|عدد|كام|كم/.test(n)) return 'COUNT';
  if(/show|list|which|اعرض|ايه|مين|ما هي/.test(n)) return 'LIST';
  if(/where|location|فين|اين|في/.test(n)) return 'LOCATION';
  if(/status|state|حاله|حالة|وضع/.test(n)) return 'STATUS';
  if(/who|which customer|من|مين/.test(n)) return 'SEARCH';
  return 'SEARCH';
}

export async function recordTerminologyUsage(matches: TerminologyMatch[]): Promise<void> {
  const ids=matches.map(m=>m.id).filter(Boolean);
  if(!ids.length) return;
  // Non-critical usage update; never blocks DALI. Each update is constrained
  // to the matched row and never changes the canonical value or alias.
  await Promise.all(ids.map(id =>
    supabase.from('dali_terminology').select('usage_count').eq('id', id).single()
      .then(({data}) => data && supabase.from('dali_terminology')
        .update({usage_count: Number(data.usage_count || 0) + 1})
        .eq('id', id))
      .catch(() => undefined)
  ));
}

export async function learnTerminology(input: Omit<TerminologyRecord,'normalized_alias'|'id'|'usage_count'>): Promise<TerminologyRecord> {
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user?.id) throw new Error('No active user');
  const normalized_alias=normalizeTerminology(input.alias);
  const {data,error}=await supabase.from('dali_terminology').upsert({
    ...input, normalized_alias, created_by:auth.user.id
  },{onConflict:'canonical_value,canonical_type,normalized_alias'}).select('*').single();
  if(error) throw new Error('Terminology save failed: '+error.message);
  return data as TerminologyRecord;
}

export async function recordCorrection(input:{inputText:string;correctIntent?:string;correctEntity?:string;previousMatch?:unknown}):Promise<void>{
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user?.id) throw new Error('No active user');
  const {error}=await supabase.from('dali_term_corrections').insert({
    user_id:auth.user.id,input_text:input.inputText.trim(),correct_intent:input.correctIntent || null,
    correct_entity:input.correctEntity || null,previous_match:input.previousMatch || {},confidence:1
  });
  if(error) throw new Error('Correction save failed: '+error.message);
}

export async function scanSystemTerminology(): Promise<number> {
  const learned: TerminologyRecord[] = [];
  const add = (canonical:string,type:TerminologyType,value:string,context:string[]=['system']) => {
    const v=String(value||'').trim(); if(v.length<2) return;
    learned.push({
      canonical_value:canonical,canonical_type:type,alias:v,normalized_alias:normalizeTerminology(v),
      language:languageOf(v),alias_type:v===canonical?'canonical':'system',context,confidence:v===canonical?1:.95,
      source:'system_scan',status:'approved'
    });
  };
  // UI/domain terminology plus live operational values. We only read existing data.
  ['Genset','Generator','Port','Location','Stock','Operation','Booking','Container','Customer','Shipper','Trucker','Maintenance','Workshop','Scrap','Invoice','Driver'].forEach(x=>add(x,'entity',x));
  for(const g of db.getStock()) { add(g.unitNumber,'genset',g.unitNumber,['genset','number']); add(String(g.location),'port',String(g.location),['port','location']); }
  for(const o of db.getOperations()) {
    add(o.customerName,'customer',o.customerName,['operation','customer']);
    add(o.trucker,'trucker',o.trucker,['operation','trucker']);
    add(o.bookingNumber,'booking',o.bookingNumber,['operation','booking']);
    add(o.containerNumber,'container',o.containerNumber,['operation','container']);
    add(o.gensetNumber,'genset',o.gensetNumber,['operation','genset']);
    add(String(o.clipOnPort),'port',String(o.clipOnPort),['operation','port']);
    add(String(o.status),'status',String(o.status),['operation','status']);
  }
  for(const u of db.getUsers()) {
    if(String(u.role).toUpperCase()==='CUSTOMER') {
      add(u.companyName || u.name,'customer',u.companyName || u.name,['customer']);
      if(u.companyNameAr) add(u.companyName || u.name,'customer',u.companyNameAr,['customer','arabic']);
    }
  }
  const unique = new Map<string,TerminologyRecord>();
  for(const x of learned) unique.set(x.canonical_type+'|'+x.canonical_value+'|'+x.normalized_alias,x);
  let count=0;
  for(const x of unique.values()) { try { await learnTerminology(x); count++; } catch {} }
  return count;
}
