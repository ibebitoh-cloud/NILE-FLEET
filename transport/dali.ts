import { transportDb } from './transportClient';
import { COMPANY, DEFAULT_SIGNER, DEFAULT_TERMS } from './exports';
import { PRICE_KEYS, PRICE_LABELS, PriceKey, Rate, TransportUser } from './types';

/**
 * DALI inside the Transport system. The model never sees the whole database:
 * this file picks the price rows that match the question, adds summaries,
 * the quotation rules, DALI's knowledge base and the user's chat memory, and
 * sends that as context. Actions are parsed on the server and applied here
 * only after the user confirms them.
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function callAi<T = any>(action: string, payload: any): Promise<T> {
  const { data } = await transportDb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session');
  const res = await fetch('/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  const raw = await res.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!res.ok) throw new Error(body?.detail || body?.error || raw || `HTTP ${res.status}`);
  return body;
}

/* ------------------------------ matching ------------------------------ */

export const norm = (s: string) => String(s || '').toLowerCase()
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stem = (w: string) => (w.length > 4 && w.startsWith('ال') ? w.slice(2) : w);
const words = (s: string) => norm(s).split(' ').filter(w => w.length >= 2).map(stem);
// Arabic glues و / ل / ب / ف / ك to the next word ("لدمياط", "للعاشر", "والسخنة").
const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'و', 'ل', 'ب', 'ف', 'ك'];
function variants(w: string): string[] {
  const out = new Set([w]);
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      const rest = w.slice(p.length);
      out.add(rest);
      if (p.endsWith('ال') || p === 'لل') out.add(`ال${rest}`);
      if (rest.startsWith('ال')) out.add(rest.slice(2));
    }
  }
  return [...out].map(stem);
}
const textWords = (s: string) => new Set(norm(s).split(' ').filter(w => w.length >= 2).flatMap(variants));
// Generic words in place and company names that should not decide a match.
const STOP = new Set(['ميناء', 'مينا', 'port', 'مدينه', 'شركه', 'للنقل', 'نقل', 'من', 'و', 'للوجيستك', 'لوجيستك', 'للوجستيك', 'لوجستيك', 'لوجيستيك', 'للوجيستيك',
  'logistics', 'logistic', 'للخدمات', 'خدمات', 'ايجيبت', 'egypt', 'للتجاره', 'تجاره', 'group', 'جروب', 'للشحن', 'شحن', 'shipping', 'line', 'lines', 'co', 'company']);

function segmentScore(name: string, tw: Set<string>, t: string): number {
  const n = norm(name);
  if (!n) return 0;
  if (n.length >= 3 && ` ${t} `.includes(` ${n} `)) return 1;
  const nw = words(name).filter(w => !STOP.has(w));
  if (!nw.length) return 0;
  const hit = nw.filter(w => tw.has(w) || (w.length >= 4 && [...tw].some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))).length;
  return hit / nw.length;
}

/** How well `name` is mentioned inside `text`, from 0 to 1 ("دمياط / مدينة دمياط" counts each part). */
export function mention(name: string, text: string): number {
  const t = norm(text);
  if (!t || !norm(name)) return 0;
  const tw = textWords(text);
  return Math.max(...[name, ...String(name).split(/[\/\-–|]/)].map(seg => segmentScore(seg, tw, t)));
}

/** True when a free-text field value refers to `query` (used for action targets). */
export function sameField(value: string, query: string): boolean {
  const v = norm(value), q = norm(query);
  if (!q) return true;
  if (!v) return false;
  if (v === q || (q.length >= 3 && v.includes(q)) || (v.length >= 3 && q.includes(v))) return true;
  return mention(query, value) >= 0.6 || mention(value, query) >= 0.75;
}

export function bestCustomer(rates: Rate[], name: string): string | null {
  if (!name.trim()) return null;
  const names = [...new Set(rates.map(r => r.customer))];
  const exact = names.find(c => norm(c) === norm(name));
  if (exact) return exact;
  const scored = names.map(c => ({ c, s: Math.max(mention(name, c), mention(c, name)) })).sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s >= 0.6 ? scored[0].c : null;
}

export function findRows(rates: Rate[], q: { customer?: string; loadPort?: string; destination?: string }): Rate[] {
  const customer = q.customer ? bestCustomer(rates, q.customer) : null;
  if (q.customer && !customer) return [];
  return rates.filter(r => (!customer || r.customer === customer)
    && (!q.loadPort || sameField(r.load_port, q.loadPort))
    && (!q.destination || sameField(r.destination, q.destination)));
}

/* ------------------------------ context ------------------------------ */

const money = (n: number) => (n ? n.toLocaleString('en-US') : '-');
const rowLine = (r: Rate) => `${r.customer} | ${r.load_port || '-'} → ${r.destination} | return: ${r.transit_port || '-'} | ${PRICE_KEYS.map(k => `${PRICE_LABELS[k]}=${money(r[k])}`).join(' ')}${r.notes ? ` | NOTES(internal): ${r.notes.slice(0, 160)}` : ''}`;

function terms(): string[] {
  const read = (l: 'ar' | 'en') => { try { return localStorage.getItem(`nf_transport_terms_${l}`); } catch { return null; } };
  const ar = (read('ar') ?? DEFAULT_TERMS.ar.join('\n')).split('\n').filter(Boolean);
  const en = (read('en') ?? DEFAULT_TERMS.en.join('\n')).split('\n').filter(Boolean);
  return [...ar.map(x => `AR: ${x}`), ...en.map(x => `EN: ${x}`)];
}

let knowledgeCache: { title: string; content: string; keywords: string[]; priority: number }[] | null = null;
async function knowledge(question: string): Promise<string[]> {
  try {
    if (!knowledgeCache) {
      const { data } = await transportDb.from('dali_knowledge').select('title,content,keywords,priority').eq('active', true).order('priority', { ascending: false }).limit(200);
      knowledgeCache = (data || []) as any;
    }
    const tw = new Set(words(question));
    return (knowledgeCache || [])
      .map(k => ({ k, s: words(`${k.title} ${(k.keywords || []).join(' ')} ${k.content.slice(0, 600)}`).filter(w => tw.has(w)).length * 10 + Number(k.priority || 0) }))
      .sort((a, b) => b.s - a.s).slice(0, 4)
      .map(({ k }) => `${k.title}: ${k.content.replace(/\s+/g, ' ').slice(0, 700)}`);
  } catch { return []; }
}

/** Rows relevant to the question (and the last questions, for follow-ups). */
export function relevantRows(rates: Rate[], question: string, recent: string[]): Rate[] {
  const text = [question, ...recent].join(' ');
  const customers = [...new Set(rates.map(r => r.customer))];
  const dests = [...new Set(rates.map(r => r.destination))];
  const ports = [...new Set(rates.flatMap(r => [r.load_port, r.transit_port]).filter(Boolean))];
  const pick = (list: string[], src: string, min: number) => list.map(x => ({ x, s: mention(x, src) })).filter(o => o.s >= min).sort((a, b) => b.s - a.s).map(o => o.x);
  // The latest question wins; earlier turns only fill in what it leaves out.
  const cNow = pick(customers, question, 0.75), dNow = pick(dests, question, 0.75), pNow = pick(ports, question, 1);
  const c = cNow.length ? cNow : pick(customers, text, 0.75);
  const d = dNow.length ? dNow : (cNow.length ? [] : pick(dests, text, 0.75));
  const p = pNow;
  if (!c.length && !d.length && !p.length) return [];
  const filter = (cc: string[], dd: string[], pp: string[]) => rates.filter(r => (!cc.length || cc.includes(r.customer)) && (!dd.length || dd.includes(r.destination)) && (!pp.length || pp.includes(r.load_port) || pp.includes(r.transit_port)));
  // A place can be a port or a destination, so drop the weakest filter when nothing matches all of them.
  let rows: Rate[] = [];
  for (const [cc, dd, pp] of [[c, d, p], [c, d, []], [c, [], p], [c, [], []], [[], d, p], [[], d, []]] as string[][][]) {
    if (!cc.length && !dd.length && !pp.length) continue;
    rows = filter(cc, dd, pp);
    if (rows.length) break;
  }
  return rows.sort((a, b) => a.customer.localeCompare(b.customer, 'ar') || a.load_port.localeCompare(b.load_port, 'ar') || a.destination.localeCompare(b.destination, 'ar'));
}

export async function buildContext(rates: Rate[], user: TransportUser, question: string, history: ChatTurn[], earlier: string[]): Promise<{ context: string; rows: Rate[] }> {
  const recentQs = history.filter(h => h.role === 'user').slice(-2).map(h => h.content);
  const rows = relevantRows(rates, question, recentQs);
  const byCustomer = new Map<string, number>();
  rates.forEach(r => byCustomer.set(r.customer, (byCustomer.get(r.customer) || 0) + 1));
  const byPort = new Map<string, number>();
  rates.forEach(r => r.load_port && byPort.set(r.load_port, (byPort.get(r.load_port) || 0) + 1));
  const stats = (k: PriceKey) => {
    const v = rates.map(r => r[k]).filter(Boolean);
    return v.length ? `${PRICE_LABELS[k]}: ${v.length} quoted, avg ${money(Math.round(v.reduce((a, b) => a + b, 0) / v.length))}, min ${money(Math.min(...v))}, max ${money(Math.max(...v))}` : `${PRICE_LABELS[k]}: none`;
  };
  const kb = await knowledge(question);
  const parts = [
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    `USER: ${user.name} (${user.email}), Transport role ${user.role}${user.role === 'VIEWER' ? ' (read only: cannot change prices)' : ''}`,
    `COMPANY: ${COMPANY.nameEn} / ${COMPANY.nameAr} · phones ${COMPANY.phones} · ${COMPANY.email} · ${COMPANY.site}. Quotations are signed by ${(() => { try { return localStorage.getItem('nf_transport_signer') || DEFAULT_SIGNER; } catch { return DEFAULT_SIGNER; } })()}. Built by Dali Studio.`,
    `PRICE LIST TOTALS: ${rates.length} routes, ${byCustomer.size} customers, ${new Set(rates.map(r => r.destination)).size} destinations.`,
    `CONTAINER AVERAGES: ${PRICE_KEYS.map(stats).join(' · ')}`,
    `LOAD PORTS (routes): ${[...byPort].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} (${n})`).join(', ')}`,
    `CUSTOMERS (routes): ${[...byCustomer].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(', ')}`,
    `QUOTATION RULES (printed on every quotation):\n${terms().map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
    kb.length ? `DALI KNOWLEDGE BASE:\n${kb.join('\n')}` : '',
    earlier.length ? `EARLIER CONVERSATIONS WITH THIS USER (memory):\n${earlier.join('\n')}` : '',
    rows.length
      ? `MATCHING PRICE ROWS (${rows.length}${rows.length > 90 ? ', first 90 shown' : ''}):\n${rows.slice(0, 90).map(rowLine).join('\n')}`
      : 'MATCHING PRICE ROWS: none matched the names in the question. Use the customer list above, or ask which customer/destination they mean.',
  ];
  return { context: parts.filter(Boolean).join('\n\n'), rows };
}

export async function ask(rates: Rate[], user: TransportUser, question: string, history: ChatTurn[], earlier: string[]) {
  const { context, rows } = await buildContext(rates, user, question, history, earlier);
  const { text } = await callAi<{ text: string }>('transportAsk', { question, context, history });
  return { text, rows };
}

/* ------------------------------ actions ------------------------------ */

export type DaliAction =
  | { type: 'set_price'; customer: string; loadPort: string; destination: string; container: string; price: number }
  | { type: 'add_rate'; customer: string; loadPort: string; destination: string; transitPort: string; prices: Record<string, number>; notes: string }
  | { type: 'adjust_prices'; customer: string; loadPort: string; destination: string; containers: string[]; mode: 'percent' | 'amount'; value: number }
  | { type: 'delete_rate'; customer: string; loadPort: string; destination: string }
  | { type: 'rename_customer'; customer: string; newName: string }
  | { type: 'quote'; customer: string }
  | { type: 'show'; customer: string; loadPort: string; destination: string }
  | { type: 'none' };

export const CONTAINER_KEY: Record<string, PriceKey> = { '1x20': 'price_1x20', '2x20': 'price_2x20', '40dc': 'price_40dc', '40rf': 'price_40rf' };

// Cheap check so plain questions skip the extra action call.
const ACTION_WORDS = /(غير|غيّر|عدل|عدّل|خلي|خلّي|اجعل|زود|زوّد|ارفع|نزل|نزّل|خفض|قلل|خصم|ضيف|اضف|أضف|زود خط|احذف|امسح|شيل|سمي|غير اسم|اعمل عرض|طلع عرض|عرض سعر|عرض اسعار|عرض أسعار|بيان سعر|بيان اسعار|بيان أسعار|كوتيشن|quotation|افتح|اعرض|ورين|وريني|فلتر|\bset\b|\bchange\b|\bupdate\b|\bedit\b|\bmake\b|\braise\b|\bincrease\b|\bdecrease\b|\breduce\b|\bdiscount\b|\badd\b|\bdelete\b|\bremove\b|\brename\b|\bquot|\bshow\b|\bopen\b|\bfilter\b|\bghayar\b|\bzawed\b|\bna2al\b|\bemsa7\b|\bdayef\b)/i;
export const looksLikeAction = (q: string) => ACTION_WORDS.test(q);

export async function parseAction(question: string, rates: Rate[], history: ChatTurn[]): Promise<DaliAction> {
  const customers = [...new Set(rates.map(r => r.customer))];
  try {
    const a = await callAi<DaliAction>('transportAction', { question, customers, history });
    return a && typeof a === 'object' && 'type' in a ? a : { type: 'none' };
  } catch { return { type: 'none' }; }
}

export const WRITE_ACTIONS = new Set(['set_price', 'add_rate', 'adjust_prices', 'delete_rate', 'rename_customer']);

/* ------------------------------ memory ------------------------------ */

const SESSION_KEY = 'nf_transport_dali_session';
export function sessionId(reset = false): string {
  try {
    let id = reset ? '' : localStorage.getItem(SESSION_KEY) || '';
    if (!id) { id = `transport-${Date.now().toString(36)}`; localStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return 'transport-local'; }
}

export async function remember(session: string, role: 'user' | 'assistant', message: string) {
  try {
    const { data } = await transportDb.auth.getUser();
    if (!data.user) return;
    await transportDb.from('dali_conversations').insert({ user_id: data.user.id, session_id: session, role, message: message.slice(0, 4000), entities: { app: 'transport' }, archived: false });
  } catch { /* memory is best effort */ }
}

/** This chat's turns, plus short lines from the user's other DALI conversations. */
export async function loadMemory(session: string): Promise<{ turns: ChatTurn[]; earlier: string[] }> {
  try {
    const { data: u } = await transportDb.auth.getUser();
    if (!u.user) return { turns: [], earlier: [] };
    const { data } = await transportDb.from('dali_conversations').select('role,message,session_id,created_at')
      .eq('user_id', u.user.id).eq('archived', false).order('created_at', { ascending: false }).limit(120);
    const all = [...(data || [])].reverse() as { role: string; message: string; session_id: string; created_at: string }[];
    const turns = all.filter(m => m.session_id === session && (m.role === 'user' || m.role === 'assistant')).map(m => ({ role: m.role as ChatTurn['role'], content: m.message }));
    const earlier = all.filter(m => m.session_id !== session && m.role === 'user').slice(-25)
      .map(m => `${m.created_at.slice(0, 10)} asked: ${m.message.replace(/\s+/g, ' ').slice(0, 160)}`);
    return { turns: turns.slice(-30), earlier };
  } catch { return { turns: [], earlier: [] }; }
}
