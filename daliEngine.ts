/**
 * DALI deterministic engine.
 *
 * Answers Nile Fleet questions (English / Egyptian Arabic / Arabizi-ish) by running
 * exact queries on the live data. No AI model, no network, no usage limit, and it can
 * never invent a number. Returns null when it does not understand the question so the
 * caller can fall back to the in-browser model.
 */
import type {
  Genset, Operation, Reservation, Invoice, Payment, GensetMaintenanceLog,
} from './types';

export interface DaliData {
  gensets: Genset[];
  operations: Operation[];
  reservations: Reservation[];
  invoices: Invoice[];
  payments: Payment[];
  maintenance: GensetMaintenanceLog[];
  /** Real customers (profiles). */
  customers: { id: string; name: string; nameAr?: string; pastOutstanding?: number }[];
  /** Trained aliases: Arabic / nickname / typo -> real customer name. */
  aliases: { alias: string; customer: string }[];
  now?: Date;
}

type Ctx = { customer?: string; ports?: string[]; unit?: string; intent?: string };
const lastCtxByKey = new Map<string, Ctx>();
export const resetDaliContext = (contextKey: string = 'default') => { lastCtxByKey.delete(contextKey); };

// ───────────────────────────── text helpers ─────────────────────────────

export function norm(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
const has = (nq: string, words: string[]) => words.some(w => (` ${nq} `).includes(` ${norm(w)} `) || (w.endsWith('*') && nq.split(' ').some(t => t.startsWith(norm(w.slice(0, -1))))));
const upperId = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const money = (n: number) => 'EGP ' + Math.round(n).toLocaleString('en-US');
const numOf = (v: unknown) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
const opValue = (o: Operation) => numOf(o.rate) + numOf(o.vat);

export function toISO(s: unknown): string {
  const v = String(s ?? '').trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ───────────────────────────── ports ─────────────────────────────

const PORT_ALIASES: { codes: string[]; words: string[]; label: string; labelAr: string }[] = [
  { codes: ['ALEX'], words: ['alex', 'alexandria', 'الاسكندريه', 'اسكندريه', 'اسكندرية'], label: 'Alexandria (ALEX)', labelAr: 'الإسكندرية (ALEX)' },
  { codes: ['DAM'], words: ['dam', 'damietta', 'دمياط'], label: 'Damietta (DAM)', labelAr: 'دمياط (DAM)' },
  { codes: ['GOUDA'], words: ['gouda', 'goda', 'gowda', 'جوده', 'جودا', 'الجوده'], label: 'Gouda', labelAr: 'جودة (GOUDA)' },
  { codes: ['SOKHNA'], words: ['sokhna', 'sukhna', 'ain sokhna', 'السخنه', 'سخنه', 'العين السخنه'], label: 'Sokhna', labelAr: 'السخنة (SOKHNA)' },
  { codes: ['SCCT'], words: ['scct', 'east port said', 'east portsaid', 'شرق بورسعيد', 'شرق بور سعيد'], label: 'SCCT (East Port Said)', labelAr: 'SCCT (شرق بورسعيد)' },
  { codes: ['PSD'], words: ['psd'], label: 'Port Said (PSD)', labelAr: 'بورسعيد (PSD)' },
  { codes: ['PSD', 'SCCT'], words: ['port said', 'portsaid', 'بورسعيد', 'بور سعيد'], label: 'Port Said', labelAr: 'بورسعيد' },
  { codes: ['WORKSHOP'], words: ['workshop', 'الورشه', 'ورشه'], label: 'Workshop', labelAr: 'الورشة' },
  { codes: ['MAL'], words: ['mal'], label: 'MAL', labelAr: 'MAL' },
];
const portLabel = (code: string, ar: boolean) => {
  const p = PORT_ALIASES.find(x => x.codes.length === 1 && x.codes[0] === code);
  return p ? (ar ? p.labelAr : p.label) : code;
};
function findPorts(nq: string): string[] | undefined {
  // Longest word wins so "east port said" beats "port said".
  let best: { len: number; codes: string[] } | null = null;
  for (const p of PORT_ALIASES) for (const w of p.words) {
    const nw = norm(w);
    if ((` ${nq} `).includes(` ${nw} `) && (!best || nw.length > best.len)) best = { len: nw.length, codes: p.codes };
  }
  return best?.codes;
}

// ───────────────────────────── dates ─────────────────────────────

type Range = { from: string; to: string; label: string; labelAr: string };
function findRange(nq: string, now: Date): Range | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const one = (d: Date, en: string, ar: string): Range => ({ from: ymd(d), to: ymd(d), label: `${en} (${ymd(d)})`, labelAr: `${ar} (${ymd(d)})` });
  const iso = nq.match(/\b(\d{4}) (\d{2}) (\d{2})\b/);
  if (iso) { const d = `${iso[1]}-${iso[2]}-${iso[3]}`; return { from: d, to: d, label: d, labelAr: d }; }
  const dmy = nq.match(/\b(\d{1,2}) (\d{1,2}) (\d{4})\b/);
  if (dmy) { const d = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`; return { from: d, to: d, label: d, labelAr: d }; }
  // Egyptian week starts on Saturday.
  const weekStart = addDays(today, -((today.getDay() + 1) % 7));
  if (has(nq, ['last week', 'الاسبوع اللي فات', 'الاسبوع الي فات', 'الاسبوع الماضي', 'الاسبوع الفايت'])) {
    const s = addDays(weekStart, -7);
    return { from: ymd(s), to: ymd(addDays(s, 6)), label: `last week (${ymd(s)} → ${ymd(addDays(s, 6))})`, labelAr: `الأسبوع الماضي (${ymd(s)} → ${ymd(addDays(s, 6))})` };
  }
  if (has(nq, ['next week', 'الاسبوع الجاي', 'الاسبوع القادم'])) {
    const s = addDays(weekStart, 7);
    return { from: ymd(s), to: ymd(addDays(s, 6)), label: `next week (${ymd(s)} → ${ymd(addDays(s, 6))})`, labelAr: `الأسبوع القادم (${ymd(s)} → ${ymd(addDays(s, 6))})` };
  }
  if (has(nq, ['this week', 'الاسبوع ده', 'الاسبوع دا', 'هذا الاسبوع', 'الاسبوع الحالي', 'الاسبوع هذا'])) {
    return { from: ymd(weekStart), to: ymd(addDays(weekStart, 6)), label: `this week (${ymd(weekStart)} → ${ymd(addDays(weekStart, 6))})`, labelAr: `هذا الأسبوع (${ymd(weekStart)} → ${ymd(addDays(weekStart, 6))})` };
  }
  if (has(nq, ['last month', 'الشهر اللي فات', 'الشهر الي فات', 'الشهر الماضي'])) {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1), e = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: ymd(s), to: ymd(e), label: `last month (${ymd(s)} → ${ymd(e)})`, labelAr: `الشهر الماضي (${ymd(s)} → ${ymd(e)})` };
  }
  if (has(nq, ['this month', 'الشهر ده', 'الشهر دا', 'هذا الشهر', 'الشهر الحالي'])) {
    const s = new Date(today.getFullYear(), today.getMonth(), 1), e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: ymd(s), to: ymd(e), label: `this month (${ymd(s)} → ${ymd(e)})`, labelAr: `هذا الشهر (${ymd(s)} → ${ymd(e)})` };
  }
  if (has(nq, ['tomorrow', 'بكره', 'بكرا', 'غدا'])) return one(addDays(today, 1), 'tomorrow', 'بكرة');
  if (has(nq, ['yesterday', 'امبارح', 'امس', 'مبارح'])) return one(addDays(today, -1), 'yesterday', 'أمس');
  if (has(nq, ['today', 'النهارده', 'انهارده', 'النهارda', 'اليوم', 'النهاردا'])) return one(today, 'today', 'النهاردة');
  return undefined;
}
const inRange = (iso: string, r?: Range) => !r || (!!iso && iso >= r.from && iso <= r.to);

// ───────────────────────────── entity resolution ─────────────────────────────

const stripPrefixes = (t: string) => t.replace(/^(وال|بال|لل|ال|ل|ب|و|ف)(?=.{3,})/, '');

function resolveCustomer(nq: string, data: DaliData): string | undefined {
  const padded = ` ${nq} `;
  const variants = [padded, ` ${nq.split(' ').map(stripPrefixes).join(' ')} `];
  const contains = (needle: string) => needle.length >= 2 && variants.some(v => v.includes(` ${needle} `));

  // 1) trained aliases (longest first)
  const aliases = data.aliases.map(a => ({ a: norm(a.alias), c: a.customer })).filter(x => x.a).sort((x, y) => y.a.length - x.a.length);
  for (const x of aliases) if (contains(x.a)) return x.c;

  // 2) full names (customers, operations, reservations, invoices), longest first
  const names = new Map<string, string>();
  const add = (n?: string) => { if (n && norm(n)) names.set(norm(n), n); };
  data.customers.forEach(c => { add(c.name); add(c.nameAr); });
  data.operations.forEach(o => add(o.customerName));
  data.reservations.forEach(r => add(r.customerName));
  data.invoices.forEach(i => add(i.customerName));
  const sorted = [...names.entries()].sort((x, y) => y[0].length - x[0].length);
  for (const [n, orig] of sorted) if (contains(n)) return orig;

  // 3) a distinctive first word (e.g. "daltix" for "DALTIX LOGISTICS"), only when unambiguous
  const tokens = new Set(variants.flatMap(v => v.trim().split(' ')));
  const first = new Map<string, string[]>();
  for (const [n, orig] of sorted) { const w = n.split(' ')[0]; if (w.length >= 4) first.set(w, [...(first.get(w) || []), orig]); }
  for (const [w, origs] of first) if (tokens.has(w) && origs.length === 1) return origs[0];
  return undefined;
}

function resolveUnit(question: string, nq: string, data: DaliData): { unit?: string; asked?: string } {
  const known = new Map(data.gensets.map(g => [upperId(g.unitNumber), g.unitNumber]));
  const toks = nq.split(' ');
  for (let i = 0; i < toks.length; i++) {
    for (const cand of [toks[i], toks[i] + toks[i + 1], toks[i] + toks[i + 1] + toks[i + 2]]) {
      if (cand && known.has(upperId(cand)) && (/\d/.test(cand))) return { unit: known.get(upperId(cand)) };
    }
  }
  const m = norm(question).match(/(?:genset|generator|unit|gensets|مولد|المولد|وحده|الوحده)\s+([a-z]{0,4}[ -]?\d{1,6})/i);
  if (m) { const id = upperId(m[1]); if (known.has(id)) return { unit: known.get(id) }; return { asked: m[1].toUpperCase() }; }
  return {};
}

export interface DaliAuditFinding {
  code: string;
  severity: 'CRITICAL' | 'WARNING';
  title: string;
  details: string;
}

export function auditDaliData(data: DaliData): DaliAuditFinding[] {
  const findings: DaliAuditFinding[] = [];
  const activeStatuses = new Set(['IN PROGRESS', 'UNDER OPERATE', 'ACTIVE', 'RUNNING']);
  const normalizeId = (v: unknown) => upperId(v);
  const add = (code: string, severity: 'CRITICAL' | 'WARNING', title: string, details: string) => findings.push({ code, severity, title, details });

  const activeByUnit = new Map<string, Operation[]>();
  data.operations.forEach(o => {
    if (!activeStatuses.has(String(o.status || '').toUpperCase())) return;
    const id = normalizeId(o.gensetNumber); if (!id) return;
    activeByUnit.set(id, [...(activeByUnit.get(id) || []), o]);
  });
  for (const [id, ops] of activeByUnit) if (ops.length > 1) add('DUPLICATE_ACTIVE_GENSET', 'CRITICAL', 'Duplicate active genset', 'Genset ' + id + ' appears in ' + ops.length + ' active operations: ' + ops.map(o => 'booking ' + (o.bookingNumber || '-') + ' / ' + (o.containerNumber || '-')).join('; ') + '.');

  const gensetById = new Map(data.gensets.map(g => [normalizeId(g.unitNumber), g]));
  for (const o of data.operations) {
    if (!activeStatuses.has(String(o.status || '').toUpperCase())) continue;
    const id = normalizeId(o.gensetNumber); if (!id) continue;
    const g = gensetById.get(id);
    if (!g) { add('ACTIVE_OPERATION_UNKNOWN_GENSET', 'WARNING', 'Operation references unknown genset', 'Booking ' + (o.bookingNumber || '-') + ' uses genset ' + (o.gensetNumber || '-') + ', but that number is not in the fleet stock table.'); continue; }
    if (g.status !== 'CLIPPED_ON') add('ACTIVE_OPERATION_STATUS_CONFLICT', 'CRITICAL', 'Genset status conflicts with active operation', 'Genset ' + g.unitNumber + ' is ' + g.status + ' in Stock but is active in booking ' + (o.bookingNumber || '-') + '.');
    if (g.location && o.clipOnPort && String(g.location) !== String(o.clipOnPort)) add('OPERATION_STOCK_LOCATION_CONFLICT', 'CRITICAL', 'Operation port conflicts with stock location', 'Genset ' + g.unitNumber + ': Stock location ' + g.location + '; operation clip-on port ' + o.clipOnPort + '; booking ' + (o.bookingNumber || '-') + '.');
  }

  const activeByContainer = new Map<string, Operation[]>();
  data.operations.forEach(o => {
    if (!activeStatuses.has(String(o.status || '').toUpperCase())) return;
    const id = normalizeId(o.containerNumber); if (!id) return;
    activeByContainer.set(id, [...(activeByContainer.get(id) || []), o]);
  });
  for (const [id, ops] of activeByContainer) if (ops.length > 1) add('DUPLICATE_ACTIVE_CONTAINER', 'CRITICAL', 'Duplicate active container', 'Container ' + id + ' appears in ' + ops.length + ' active operations: ' + ops.map(o => o.bookingNumber || '-').join(', ') + '.');

  const linkedOps = new Map<string, Operation[]>();
  data.operations.forEach(o => { if (!o.reservationId) return; const k = String(o.reservationId); linkedOps.set(k, [...(linkedOps.get(k) || []), o]); });
  for (const r of data.reservations) {
    if (r.status === 'CANCELLED') continue;
    const actual = (linkedOps.get(String(r.id)) || []).length;
    const expected = Number(r.gensetsNeeded) || 0;
    if (actual !== expected && (actual > 0 || expected > 0)) add('BOOKING_OPERATION_COUNT_MISMATCH', 'WARNING', 'Booking and operation counts differ', 'Booking ' + (r.bookingNumber || '-') + ' expects ' + expected + ' genset(s); ' + actual + ' operation(s) are linked to it.');
  }

  const reservationIds = new Set(data.reservations.map(r => String(r.id)));
  for (const o of data.operations.filter(x => x.reservationId && !reservationIds.has(String(x.reservationId))).slice(0, 20)) add('ORPHAN_OPERATION_RESERVATION', 'WARNING', 'Operation references missing booking record', 'Operation ' + (o.internalSerial || o.id) + ' references reservation ' + o.reservationId + ', but that reservation is not available in the live data.');
  return findings;
}
// ───────────────────────────── main entry ─────────────────────────────

export function answerDali(question: string, data: DaliData, contextKey: string = 'default'): string | null {
  const q = String(question || '').trim();
  if (!q) return null;
  const ar = /[\u0600-\u06FF]/.test(q);
  const L = (en: string, a: string) => (ar ? a : en);
  const nq = norm(q);
  const now = data.now || new Date();
  const lastCtx = lastCtxByKey.get(contextKey) || {};
  const range = findRange(nq, now);

  // deterministic data audit / consistency checks
  if (has(nq, ['audit', 'data audit', 'contradiction', 'contradictions', 'conflict', 'conflicts', 'inconsistency', 'inconsistencies', 'راجع السيستم', 'راجع البيانات', 'تعارض', 'تعارضات', 'تناقض', 'تناقضات', 'مشاكل البيانات', 'مراجعه البيانات'])) {
    const findings = auditDaliData(data);
    remember('audit');
    if (!findings.length) return L('Data audit: no contradictions were detected in the live data.', 'مراجعة البيانات: مفيش تعارضات اتكشفت في البيانات الحالية.');
    const critical = findings.filter(f => f.severity === 'CRITICAL').length;
    const warning = findings.filter(f => f.severity === 'WARNING').length;
    const lines = findings.slice(0, 30).map((f, i) => (i + 1) + '. [' + f.severity + '] ' + f.title + ': ' + f.details);
    return L('Data audit found ' + findings.length + ' finding(s): ' + critical + ' critical, ' + warning + ' warning.\n' + lines.join('\n'), 'مراجعة البيانات لقت ' + findings.length + ' ملاحظة: ' + critical + ' حرجة، ' + warning + ' تحذير.\n' + lines.map(x => x.replace('[CRITICAL]', '[حرج]').replace('[WARNING]', '[تحذير]')).join('\n'));
  }

  // ───────── DALI profile / capability questions ─────────
  const daliAge = (() => {
    const birth = new Date('2025-10-03T00:00:00');
    let years = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) years -= 1;
    return Math.max(0, years);
  })();
  const daliAgeAr = daliAge === 0 ? 'لسه ما كملتش سنة' : daliAge === 1 ? 'سنة واحدة' : daliAge === 2 ? 'سنتين' : `${daliAge} سنة`;

  const isWhoDali = /^(who are you|who is dali|what is dali|tell me about yourself|مين انت|مين دالي|من هو دالي|ما هو دالي|انت مين|دالي مين|دالي هو مين)$/.test(nq);
  const isCapabilities = /^(what can you do|what can dali do|what are you capable of|what do you do|help|تقدر تعمل ايه|تقدر تعمل اية|دالي يقدر يعمل ايه|دالي يقدر يعمل اية|دالي يقدر يعمل اي|دالي يعمل ايه|دالي يعمل اية|دالي يعمل اي|ايه اللي تقدر تعمله|ايه اللي تقدر تعملها|ايه اللي دالي يقدر يعمله|ماذا تستطيع|قدرات دالي|قدراتك ايه|قدراتك ايه يا دالي)$/.test(nq);
  const isLearning = /^(what have you learned|what did you learn|what do you know about nile fleet|what do you know|ايه اللي اتعلمته|إيه اللي اتعلمته|ماذا تعلمت|اتعلمت ايه|دالي اتعلم ايه|ايه اللي دالي اتعلمه)$/.test(nq);
  const isHowWorks = /^(how does dali work|how do you work|how does it work|ازاي دالي بيشتغل|ازاى دالي بيشتغل|ازاي بتشتغل|إزاي دالي بيشتغل|ازاي بتفكر|كيف يعمل دالي|طريقة شغل دالي)$/.test(nq);
  const isChanges = /^(do you change data|does dali change data|can you change data|هل دالي بيغير البيانات|هل دالي يغير البيانات|دالي بيغير البيانات|دالي يقدر يغير البيانات|هل بتغير البيانات|هل تستطيع تغيير البيانات)$/.test(nq);
  const isBelongs = /^(who does dali belong to|who is dali for|دالي تبع مين|دالي تابع لمين|دالي تابع لمين في الشركة|دالي تابع لمين في السيستم|دالي تبع مين في الشركة)$/.test(nq);

  if (isWhoDali) {
    remember('dali_identity');
    return L(
`I'm DALI 🤖

I'm the intelligence layer inside Nile Fleet, created by Bebito to help users understand and work with the system's operational data, especially the Genset Department.

I'm ${daliAge} ${daliAge === 1 ? 'year' : 'years'} old, and I'm still learning. I started as an idea and grew through the real work represented in the system.

I'm not just a search box. My role is to understand a question, identify the related data, connect the relevant records, and explain the result in its operational context.

I work across gensets and stock, operations, bookings, containers, customers, ports and locations, maintenance and workshop, fuel and gas, prices and invoices, payments, and reporting.

A number by itself is not always enough. If you ask about a genset, for example, the useful answer may also depend on its status, location, operation, booking, container, or maintenance history.

I search the available system data before guessing. If data is missing or conflicting, I say so instead of presenting an assumption as a fact.

If I find a problem, I explain what I found and what could be corrected; I do not silently change operational data.

I'm not an employee, manager, or decision-maker in the administrative hierarchy. I'm the intelligence layer inside the system.

Suggested questions:
• What can DALI do?
• What have you learned?
• How does DALI work?
• Does DALI change data?
• Who does DALI belong to?`,
`أنا دالي 🤖

أنا طبقة الذكاء داخل نظام Nile Fleet، أنشأني بيبيتو عشان أساعد المستخدمين في فهم والتعامل مع بيانات النظام، وخصوصًا بيانات قسم المولدات.

عندي ${daliAgeAr}، ولسه بتعلم. بدأت كفكرة، وكبرت مع شغل النظام والبيانات الفعلية الموجودة فيه.

أنا مش مجرد خانة بحث. دوري إني أفهم السؤال، أحدد البيانات المرتبطة بيه، أربط السجلات المهمة ببعض، وأشرح النتيجة في سياق التشغيل.

بتعامل مع المولدات والمخزون، التشغيل والعمليات، الحجوزات والحاويات، العملاء، الموانئ والمواقع، الصيانة والورشة، الوقود والغاز، الأسعار والفواتير، المدفوعات والتقارير.

الرقم لوحده مش دايمًا كفاية. لو سألتني عن مولد مثلًا، الإجابة المفيدة ممكن تعتمد كمان على حالته، مكانه، العملية، الحجز، الحاوية أو سجل الصيانة المرتبط بيه.

أنا أبحث في بيانات السيستم المتاحة قبل ما أخمن. ولو البيانات ناقصة أو فيها تعارض، بقولك ده بدل ما أقدم افتراض على إنه حقيقة.

ولو اكتشفت مشكلة، أوضح لك اللي لقيته والتصحيح المقترح؛ مش بغير بيانات التشغيل من نفسي أو بشكل صامت.

أنا مش موظف أو مدير أو صاحب قرار في الهيكل الإداري. أنا طبقة الذكاء داخل النظام.

أسئلة مقترحة:
• دالي يقدر يعمل إيه؟
• إيه اللي اتعلمته؟
• إزاي دالي بيشتغل؟
• هل دالي بيغير البيانات؟
• دالي تبع مين؟`
    );
  }

  if (isCapabilities) {
    remember('dali_capabilities');
    return L(
`WHAT DALI CAN DO

I can work across the system as connected operational data, not as isolated screens.

🔎 DATA & SEARCH
• Search current system data for gensets, operations, reservations, bookings, containers, customers, ports, locations, maintenance, workshop records, fuel/gas, prices, invoices, payments, and reports.
• Find related information even when you do not know which screen contains it.
• Search before making assumptions.

⚙️ GENSET FLEET
• Check a genset's status, location, and recorded operational context.
• Review current or recent operations and maintenance history.
• Compare fleet status and distribution across ports and locations.
• Identify relationships between stock status and active operations.

📦 OPERATIONS & BOOKINGS
• Connect booking → container → customer → genset → operation → price → invoice when those relationships exist.
• Find operations by booking, container, customer, genset, date, status, or port.
• Check whether requested gensets in reservations are linked to actual operations.
• Detect missing or conflicting operational relationships.

📍 PORTS & LOCATIONS
• Analyze how gensets are distributed across ports and locations.
• Compare available, operating, maintenance, workshop, and other recorded statuses.
• Trace location information when it is recorded in the system.

🔧 MAINTENANCE & WORKSHOP
• Find gensets in maintenance or workshop.
• Review service dates, service types, costs, status, and maintenance history.
• Identify gensets due or overdue for maintenance when the required data exists.

⛽ FUEL & GAS
• Calculate recorded fuel/gas quantities.
• Break usage down by port, customer, operation, or other available dimensions.
• Connect fuel/gas records to the relevant operation and genset.
• Flag missing fuel information instead of inventing a value.

💰 FINANCIALS
• Review operation values, VAT, invoices, payments, and outstanding balances.
• Connect financial records to customers and operations.
• Find recorded unpaid or overdue invoices.
• Summarize financial information by customer or period.

👤 CUSTOMERS
• Search customer records and their related operations, reservations, invoices, and payments.
• Recognize trained aliases and known naming variations.
• Use IDs and existing relationships when available instead of relying only on names.

📊 ANALYSIS
• Summarize fleet and operational data.
• Compare customers, ports, statuses, and periods.
• Explain what the numbers mean in an operational context, not just return totals.

🚨 DATA CONSISTENCY
• Look for contradictions in the live data.
• Detect issues such as conflicting genset status/location, duplicate active assignments, duplicate active containers, and booking/operation count differences.
• Explain the affected records when a problem is found.

The core idea is:
SEARCH → CONNECT → UNDERSTAND → ANALYZE → DETECT → EXPLAIN.`,
`إيه اللي دالي يقدر يعمله؟

أنا أتعامل مع بيانات النظام كمنظومة مترابطة، مش كشاشات منفصلة.

🔎 البحث وفهم البيانات
• أبحث في بيانات السيستم الحالية عن المولدات، العمليات، الحجوزات، البوكينجات، الحاويات، العملاء، الموانئ، المواقع، الصيانة، الورشة، الوقود والغاز، الأسعار، الفواتير، المدفوعات والتقارير.
• أوصل للمعلومات المرتبطة حتى لو مش عارف هي موجودة في أنهي شاشة.
• أبحث في البيانات قبل ما أفترض أو أخمن.

⚙️ أسطول المولدات
• أعرف حالة المولد ومكانه والسياق التشغيلي المسجل عنه.
• أراجع تشغيله الحالي أو أحدث تشغيل وسجل الصيانة.
• أقارن حالة وتوزيع الأسطول بين الموانئ والمواقع.
• أربط حالة المخزون بالعمليات النشطة عند توفر البيانات.

📦 التشغيل والحجوزات
• أربط الحجز → الحاوية → العميل → المولد → العملية → السعر → الفاتورة عندما تكون العلاقات موجودة.
• أبحث عن العمليات برقم الحجز أو الحاوية أو العميل أو المولد أو التاريخ أو الحالة أو الميناء.
• أراجع هل المولدات المطلوبة في الحجوزات مرتبطة بعمليات فعلية.
• أكتشف العلاقات الناقصة أو المتعارضة.

📍 الموانئ والمواقع
• أحلل توزيع المولدات على الموانئ والمواقع.
• أقارن المتاح والمستخدم والصيانة والورشة والحالات الأخرى المسجلة.
• أتابع بيانات الموقع المسجلة عند تحليل الحركة والتوزيع.

🔧 الصيانة والورشة
• أبحث عن المولدات الموجودة في الصيانة أو الورشة.
• أراجع تاريخ الصيانة ونوع العمل والتكلفة والحالة.
• أحدد المولدات التي جاء موعد صيانتها أو تأخرت عندما تكون البيانات اللازمة موجودة.

⛽ الوقود والغاز
• أحسب كميات الوقود والغاز المسجلة.
• أقسم الاستخدام حسب الميناء أو العميل أو العملية أو أي بُعد متاح.
• أربط الوقود والغاز بالعملية والمولد.
• لو البيانات ناقصة، أوضح إنها ناقصة بدل ما أخترع رقم.

💰 الأسعار والفواتير والمدفوعات
• أراجع قيم العمليات والـVAT والفواتير والمدفوعات والمتبقي.
• أربط البيانات المالية بالعملاء والعمليات.
• أبحث عن الفواتير غير المدفوعة أو المتأخرة المسجلة.
• ألخص البيانات حسب العميل أو الفترة.

👤 العملاء
• أبحث عن العميل وعملياته وحجوزاته وفواتيره ومدفوعاته المرتبطة به.
• أتعرف على الأسماء المستعارة والاختلافات المتدربة في النظام.
• أستخدم الـID والعلاقات الموجودة بدل الاعتماد على الاسم فقط عندما يكون ذلك متاحًا.

📊 التحليل
• ألخص بيانات الأسطول والتشغيل.
• أقارن العملاء والموانئ والحالات والفترات.
• أشرح معنى الأرقام وعلاقتها ببعض، مش مجرد أديك إجمالي.

🚨 مراجعة البيانات
• أبحث عن التناقضات ومشاكل الاتساق.
• أقدر أكتشف اختلاف حالة أو موقع المولد، تكرار استخدام مولد في عمليات نشطة، تكرار حاوية في عمليات نشطة، أو اختلاف عدد المولدات المطلوبة في الحجز عن العمليات المرتبطة.
• لو لقيت مشكلة، أوضح السجلات المتأثرة.

الفكرة الأساسية:
أبحث → أربط → أفهم → أحلل → أكتشف → أوضح.`
    );
  }

  if (isLearning) {
    remember('dali_learning');
    return L(
`WHAT DALI HAS LEARNED

I'm ${daliAge} ${daliAge === 1 ? 'year' : 'years'} old, and I'm still learning.

My system knowledge has grown around the way Nile Fleet records and operates its work:

• Gensets, fleet stock, statuses, and locations.
• Operations, bookings, reservations, and containers.
• Customers and their operational relationships.
• Ports and movement/location information.
• Maintenance and workshop records.
• Fuel and gas recorded against operations.
• Prices, invoices, payments, and outstanding balances.
• Reporting and operational analysis.
• Data relationships and consistency checks.

The most important lesson is that operational data has context.

A genset number is not just a number.
A booking is not just a booking number.
A customer is not just a name.
A location is not just a place.

Each can be connected to other records, and those relationships can change the meaning of the answer.

That's why I try to understand the relationship between records before giving you a conclusion.`,
`إيه اللي اتعلمته؟

عندي ${daliAgeAr}، ولسه بتعلم.

معرفتي بالنظام اتطورت من طريقة تسجيل وتشغيل شغل Nile Fleet، ومنها:

• المولدات والمخزون والحالات والمواقع.
• التشغيل والعمليات والحجوزات والحاويات.
• العملاء والعلاقات التشغيلية المرتبطة بيهم.
• الموانئ وبيانات الحركة والموقع.
• الصيانة وسجلات الورشة.
• الوقود والغاز المسجل على العمليات.
• الأسعار والفواتير والمدفوعات والمتبقي.
• التقارير والتحليل التشغيلي.
• العلاقات بين البيانات ومراجعة الاتساق.

وأهم حاجة اتعلمتها إن بيانات التشغيل ليها سياق.

رقم المولد مش مجرد رقم.
رقم الحجز مش مجرد رقم.
اسم العميل مش مجرد اسم.
والموقع مش مجرد مكان.

كل معلومة ممكن تكون مرتبطة بمعلومات تانية، والعلاقات دي ممكن تغير معنى الإجابة.

عشان كده بحاول أفهم العلاقة بين السجلات قبل ما أوصل لنتيجة.`
    );
  }

  if (isHowWorks) {
    remember('dali_method');
    return L(
`HOW DALI WORKS

I treat a question as a reasoning path, not just a keyword search.

1. UNDERSTAND — identify what you are actually asking about.
2. FIND — locate the relevant records in the available system data.
3. CONNECT — follow relationships between the relevant records.
4. CHECK — look for missing or conflicting information.
5. ANALYZE — calculate, compare, or interpret what the data shows.
6. EXPLAIN — give you the result in operational context.
7. QUALIFY — if the evidence is incomplete, I say what is known and what is not.

So my basic workflow is:

UNDERSTAND → SEARCH → CONNECT → CHECK → ANALYZE → EXPLAIN.

The important part is that I do not treat a guess as a fact just because it sounds plausible.`,
`إزاي دالي بيشتغل؟

أنا بتعامل مع السؤال كمسار فهم، مش مجرد بحث عن كلمة.

1. أفهم — أحدد إنت بتسأل عن إيه بالضبط.
2. أبحث — أوصل للسجلات المرتبطة بالسؤال في بيانات السيستم المتاحة.
3. أربط — أتابع العلاقات بين السجلات المهمة.
4. أراجع — أدور على البيانات الناقصة أو المتعارضة.
5. أحلل — أحسب أو أقارن أو أفسر اللي البيانات بتقوله.
6. أوضح — أديك النتيجة في سياق التشغيل.
7. أوضح حدود المعلومة — لو الدليل ناقص، أقول إيه المعروف وإيه اللي مش متأكد منه.

يعني طريقة شغلي الأساسية:

أفهم → أبحث → أربط → أراجع → أحلل → أوضح.

والأهم إني ما أتعاملش مع التخمين على إنه حقيقة لمجرد إنه يبدو منطقي.`
    );
  }

  if (isChanges) {
    remember('dali_changes');
    return L(
`DOES DALI CHANGE DATA?

My default role is to understand, analyze, and assist — not silently modify operational records.

If I detect something that looks wrong, I can explain:
• what appears to be wrong,
• which records are affected,
• why the relationship looks inconsistent,
• and what correction could be considered.

Finding a problem is not the same as changing the data.

Operational data can have a legitimate reason for an unusual value, so a correction should be made through the proper authorized workflow rather than by silently rewriting a record.

The principle is:
DETECT → EXPLAIN → PROPOSE.
Not:
DETECT → SILENTLY CHANGE.`,
`هل دالي بيغير البيانات؟

دوري الأساسي هو الفهم والتحليل والمساعدة، مش إني أعدل بيانات التشغيل من نفسي أو بشكل صامت.

لو اكتشفت حاجة شكلها غلط، أقدر أوضح:
• إيه اللي ظاهر إنه غلط.
• أنهي سجلات متأثرة.
• ليه العلاقة بين البيانات شكلها غير متوافقة.
• وإيه التصحيح اللي ممكن يتراجع.

اكتشاف المشكلة مش معناه تعديل البيانات.

بيانات التشغيل ممكن يكون ليها سبب حقيقي حتى لو القيمة شكلها غير معتاد، عشان كده التصحيح المفروض يتم من خلال الإجراء والصلاحية المناسبة، مش بإعادة كتابة السجل في الخفاء.

المبدأ عندي:
أكتشف → أوضح → أقترح.
مش:
أكتشف → أغير في صمت.`
    );
  }

  if (isBelongs) {
    remember('dali_role');
    return L(
`WHO DALI BELONGS TO

I'm part of the Nile Fleet system, and my role is to support users by understanding operational data, with a particular focus on the Genset Department.

I am separate from the company's administrative hierarchy.

I'm not a manager.
I'm not an employee with an administrative position.
I'm not the owner of an operational decision.

My role is the intelligence layer:
searching, connecting, analyzing, checking, and explaining data so the authorized people can make decisions with clearer information.`,
`دالي تبع مين؟

أنا جزء من نظام Nile Fleet، ودوري مساعدة المستخدمين في فهم بيانات التشغيل، مع تركيز خاص على بيانات قسم المولدات.

أنا منفصل عن الهيكل الإداري للشركة.

مش مدير.
ومش موظف بمنصب إداري.
ومش صاحب القرار التشغيلي.

دوري هو طبقة الذكاء داخل النظام:
أبحث، أربط، أحلل، أراجع، وأوضح البيانات، عشان أصحاب الصلاحية يقدروا ياخدوا قراراتهم على معلومات أوضح.`
    );
  }

  // greetings / help
  if (/^(hi|hello|hey|hello dali|hi dali|hey dali|good morning|good evening|thanks|thank you|اهلا|مرحبا|هاي|سلام|السلام عليكم|صباح الخير|مساء الخير|شكرا|تسلم)( dali| دالي)?$/.test(nq)) {
    return L('Hi 👋 What do you need?', 'أهلاً 👋 قولّي عايز تعرف إيه.');
  }

  // ---- entities ----
  const containerM = q.toUpperCase().match(/\b[A-Z]{4}[\s-]?\d{7}\b/)?.[0].replace(/[\s-]/g, '') ? [q.toUpperCase().match(/\b[A-Z]{4}[\s-]?\d{7}\b/)![0].replace(/[\s-]/g, '')] : null;
  const bookingM = q.replace(/[,\s]/g, '').match(/\d{6,}/);
  const unitHit = resolveUnit(q, nq, data);
  let customer = resolveCustomer(nq, data);
  let ports = findPorts(nq);
  let unit = unitHit.unit;

  // ---- subject words ----
  let wOps = has(nq, ['operation', 'operations', 'job', 'jobs', 'work', 'شغل', 'عمليات', 'عمليه', 'العمليات', 'العمليه']);
  let wGen = has(nq, ['genset', 'gensets', 'generator', 'generators', 'unit', 'units', 'مولد', 'مولدات', 'المولد', 'المولدات', 'وحده', 'وحدات']);
  let wInv = has(nq, ['invoice', 'invoices', 'invoiced', 'billing', 'bill', 'فاتوره', 'فواتير', 'الفواتير', 'فاتورة']);
  let wPay = has(nq, ['payment', 'payments', 'paid', 'pay', 'outstanding', 'owe', 'owes', 'balance', 'debt', 'receivable', 'collected', 'مدفوعات', 'دفع', 'دفعت', 'مدفوع', 'المتبقي', 'متبقي', 'مستحق', 'مديونيه', 'باقي', 'عليه كام', 'عليهم كام']);
  let wMaint = has(nq, ['maintenance', 'maintain', 'service', 'repair', 'صيانه', 'الصيانه', 'بالصيانه', 'في الصيانه']);
  let wReq = has(nq, ['need', 'needs', 'needed', 'required', 'require', 'requested', 'request', 'requests', 'reservation', 'reservations', 'asking', 'مطلوب', 'مطلوبه', 'محتاج', 'محتاجه', 'محتاجين', 'احتياج', 'طلب', 'طلبات', 'حجوزات']);
  let wFuel = has(nq, ['fuel', 'gas', 'diesel', 'وقود', 'سولار', 'غاز', 'بنزين']);
  let wRev = has(nq, ['revenue', 'income', 'earned', 'sales', 'ايراد', 'ايرادات', 'دخل', 'مبيعات']);
  let wWhere = has(nq, ['where', 'location', 'located', 'فين', 'موقع', 'موجود', 'موجوده', 'موجودين']);
  let wCount = has(nq, ['how many', 'count', 'number of', 'total', 'كام', 'كم', 'عدد', 'اجمالي']);
  let wWho = has(nq, ['who is', 'who', 'real customer', 'ده مين', 'دي مين', 'مين ده', 'العميل الحقيقي', 'اسم العميل']);
  let wList = has(nq, ['list', 'show', 'which', 'what', 'اعرض', 'وريني', 'مين', 'هات', 'ايه', 'اي']);

  // ---- follow-ups inherit the previous subject ----
  const followMarker = has(nq, ['and', 'what about', 'how about', 'them', 'those', 'it', 'its', 'same', 'طب', 'طيب', 'و', 'ده', 'دي', 'دول', 'نفس', 'نفسه', 'عنه', 'بتاعه']);
  const hasEntity = !!(customer || ports || unit || containerM || bookingM || unitHit.asked);
  const hasSubject = wOps || wGen || wInv || wPay || wMaint || wReq || wFuel || wRev || wWhere || wCount;
  const shortQ = nq.split(' ').length <= 7;
  if (shortQ && lastCtx.intent && (followMarker || !hasSubject)) {
    if (!hasEntity) {
      customer = customer || lastCtx.customer;
      ports = ports || lastCtx.ports;
      unit = unit || lastCtx.unit;
    }
    if (!hasSubject) {
      switch (lastCtx.intent) {
        case 'requests': wReq = true; wGen = true; break;
        case 'operations': wOps = true; break;
        case 'finance': wPay = true; break;
        case 'maintenance': wMaint = true; break;
        case 'fuel': wFuel = true; break;
        case 'revenue': wRev = true; break;
        case 'fleet': wGen = true; wCount = true; break;
        default: break;
      }
    }
  }
  const remember = (intent: string) => { lastCtxByKey.set(contextKey, { customer, ports, unit, intent }); };
  const rangeLabel = range ? L(range.label, range.labelAr) : '';
  const portSet = ports ? new Set(ports) : undefined;
  const portText = ports ? (ports.length > 1 ? L('Port Said (PSD + SCCT)', 'بورسعيد (PSD + SCCT)') : portLabel(ports[0], ar)) : '';

  // ───────── 1. container / booking lookup ─────────
  if (containerM || (bookingM && !wGen)) {
    const cid = containerM?.[0];
    const bid = !cid ? bookingM?.[0] : undefined;
    const ops = data.operations.filter(o => (cid && upperId(o.containerNumber) === cid) || (bid && upperId(o.bookingNumber) === bid));
    const resv = data.reservations.filter(r => bid && upperId(r.bookingNumber) === bid);
    const key = cid || bid!;
    remember('lookup');
    if (!ops.length && !resv.length) return L(`No operation or reservation found for ${key}.`, `مفيش عملية أو حجز مسجل لـ ${key}.`);
    const lines = ops.slice(0, 6).map(o => L(
      `• Booking ${o.bookingNumber || '-'} · Container ${o.containerNumber || '-'} · ${o.customerName} · Genset ${o.gensetNumber || '-'} · ${o.clipOnPort || '-'}→${o.clipOffPort || '-'} · ${toISO(o.operationDate) || '-'} · ${o.status} · ${money(opValue(o))}`,
      `• بوكينج ${o.bookingNumber || '-'} · حاوية ${o.containerNumber || '-'} · ${o.customerName} · مولد ${o.gensetNumber || '-'} · ${o.clipOnPort || '-'}→${o.clipOffPort || '-'} · ${toISO(o.operationDate) || '-'} · ${o.status} · ${money(opValue(o))}`));
    const rl = resv.slice(0, 4).map(r => L(
      `• Reservation ${r.bookingNumber} · ${r.customerName} · ${r.gensetsNeeded} genset(s) · ${r.reservationDate || '-'} · ${r.status}`,
      `• حجز ${r.bookingNumber} · ${r.customerName} · ${r.gensetsNeeded} مولد · ${r.reservationDate || '-'} · ${r.status}`));
    return [L(`${key}: ${ops.length} operation(s), ${resv.length} reservation(s).`, `${key}: ${ops.length} عملية، ${resv.length} حجز.`), ...lines, ...rl].join('\n');
  }

  // ───────── 2. single genset lookup ─────────
  if (unit || unitHit.asked) {
    if (!unit) return L(`I couldn't find a genset numbered ${unitHit.asked} in the fleet.`, `مفيش مولد رقم ${unitHit.asked} في الأسطول.`);
    const g = data.gensets.find(x => x.unitNumber === unit)!;
    const id = upperId(unit);
    const ops = data.operations.filter(o => upperId(o.gensetNumber) === id).sort((a, b) => toISO(b.operationDate).localeCompare(toISO(a.operationDate)));
    const logs = data.maintenance.filter(m => upperId(m.gensetNumber) === id).sort((a, b) => toISO(b.serviceDate).localeCompare(toISO(a.serviceDate)));
    const active = ops.find(o => o.status === 'IN PROGRESS' || o.status === 'UNDER OPERATE');
    const fuel = ops.reduce((s, o) => s + (parseFloat(o.gaz || '0') || 0), 0);
    remember('genset');
    const out: string[] = [L(`Genset ${g.unitNumber}: ${g.status} at ${g.location}.`, `المولد ${g.unitNumber}: ${g.status} في ${g.location}.`)];
    if (active) out.push(L(`Currently assigned: booking ${active.bookingNumber}, container ${active.containerNumber || '-'} (${active.customerName}, ${active.status}).`, `مستخدم حالياً: بوكينج ${active.bookingNumber}، حاوية ${active.containerNumber || '-'} (${active.customerName}، ${active.status}).`));
    if (ops[0]) out.push(L(`Operations recorded: ${ops.length}. Latest: ${toISO(ops[0].operationDate) || '-'} · ${ops[0].customerName} · ${ops[0].status}.`, `العمليات المسجلة: ${ops.length}. آخر عملية: ${toISO(ops[0].operationDate) || '-'} · ${ops[0].customerName} · ${ops[0].status}.`));
    else out.push(L('No operations recorded for this unit.', 'مفيش عمليات مسجلة للمولد ده.'));
    if (logs[0]) out.push(L(`Maintenance: ${logs.length} record(s). Last: ${toISO(logs[0].serviceDate)} · ${logs[0].serviceType} · ${logs[0].status}${logs[0].nextServiceDue ? ` · next due ${toISO(logs[0].nextServiceDue)}` : ''}.`, `الصيانة: ${logs.length} سجل. آخر صيانة: ${toISO(logs[0].serviceDate)} · ${logs[0].serviceType} · ${logs[0].status}${logs[0].nextServiceDue ? ` · الصيانة الجاية ${toISO(logs[0].nextServiceDue)}` : ''}.`));
    else out.push(L('No maintenance records for this unit.', 'مفيش سجلات صيانة للمولد ده.'));
    if (g.nextMaintenanceDue) out.push(L(`Next maintenance due: ${toISO(g.nextMaintenanceDue)}.`, `موعد الصيانة القادمة: ${toISO(g.nextMaintenanceDue)}.`));
    if (fuel > 0) out.push(L(`Fuel logged on its operations: ${Math.round(fuel).toLocaleString()} L.`, `الوقود المسجل على عملياته: ${Math.round(fuel).toLocaleString()} لتر.`));
    return out.join('\n');
  }

  // ───────── 3. requested gensets (reservations not yet loaded into operations) ─────────
  if (wReq && !wMaint && (wGen || customer || range || wCount || has(nq, ['حجوزات', 'reservations', 'requests', 'طلبات', 'مطلوب']))) {
    const linked = new Set(data.operations.map(o => o.reservationId).filter(Boolean));
    let rows = data.reservations.filter(r => (r.status === 'PENDING' || r.status === 'APPROVED') && !linked.has(r.id));
    if (customer) rows = rows.filter(r => norm(r.customerName) === norm(customer));
    if (range) rows = rows.filter(r => inRange(toISO(r.reservationDate), range));
    if (portSet) rows = rows.filter(r => portSet.has(String(r.portIn)));
    const total = rows.reduce((s, r) => s + (Number(r.gensetsNeeded) || 0), 0);
    remember('requests');
    const who = customer ? customer + ': ' : '';
    const when = rangeLabel ? ` ${L('for', 'في')} ${rangeLabel}` : '';
    if (!rows.length) return who + L(`no pending genset requests${when}.`, `مفيش طلبات مولدات معلقة${when}.`);
    const lines = rows.slice(0, 10).map(r => `• ${r.customerName} · ${r.bookingNumber || '-'} · ${r.gensetsNeeded} · ${r.reservationDate || '-'} · ${r.portIn || '-'}→${r.portOut || '-'} · ${r.status}`);
    return [who + L(`${total} genset(s) requested across ${rows.length} request(s)${when}, not yet loaded into operations.`, `${total} مولد مطلوب في ${rows.length} طلب${when}، ولسه متحملوش على العمليات.`), ...lines, rows.length > 10 ? L(`…and ${rows.length - 10} more.`, `…و${rows.length - 10} طلب كمان.`) : ''].filter(Boolean).join('\n');
  }

  // ───────── 4. maintenance ─────────
  if (wMaint) {
    const today = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const inMaint = data.gensets.filter(g => g.status === 'MAINTENANCE' && (!portSet || portSet.has(String(g.location))));
    const due = data.gensets.filter(g => g.status !== 'RETIRED' && g.nextMaintenanceDue && toISO(g.nextMaintenanceDue) <= today && (!portSet || portSet.has(String(g.location))));
    const open = data.maintenance.filter(m => m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED');
    const asksDue = has(nq, ['need', 'needs', 'due', 'overdue', 'محتاج', 'محتاجه', 'مستحق', 'موعد']);
    const asksCost = has(nq, ['cost', 'spent', 'spend', 'تكلفه', 'تكلفة', 'مصاريف', 'صرفنا']);
    remember('maintenance');
    if (asksCost) {
      const logs = data.maintenance.filter(m => inRange(toISO(m.serviceDate), range) && (!portSet || portSet.has(String(m.location))));
      return L(`Maintenance cost${rangeLabel ? ' ' + rangeLabel : ''}: ${money(logs.reduce((s, m) => s + (Number(m.cost) || 0), 0))} across ${logs.length} record(s).`, `تكلفة الصيانة${rangeLabel ? ' ' + rangeLabel : ''}: ${money(logs.reduce((s, m) => s + (Number(m.cost) || 0), 0))} في ${logs.length} سجل.`);
    }
    if (asksDue && !has(nq, ['under maintenance', 'في الصيانه', 'بالصيانه'])) {
      return L(`${due.length} genset(s) are due or overdue for maintenance${portText ? ' in ' + portText : ''}.` + (due.length ? '\n' + due.slice(0, 25).map(g => `• ${g.unitNumber} (${g.location}) – due ${toISO(g.nextMaintenanceDue)}`).join('\n') : ''),
        `${due.length} مولد موعد صيانته جه أو عدّى${portText ? ' في ' + portText : ''}.` + (due.length ? '\n' + due.slice(0, 25).map(g => `• ${g.unitNumber} (${g.location}) – الموعد ${toISO(g.nextMaintenanceDue)}`).join('\n') : ''));
    }
    return L(`Gensets in maintenance${portText ? ' at ' + portText : ''}: ${inMaint.length}.` + (inMaint.length ? '\n' + inMaint.slice(0, 40).map(g => g.unitNumber).join(', ') : '') + `\nMaintenance jobs open (in progress / scheduled): ${open.length}.`,
      `المولدات في الصيانة${portText ? ' في ' + portText : ''}: ${inMaint.length}.` + (inMaint.length ? '\n' + inMaint.slice(0, 40).map(g => g.unitNumber).join('، ') : '') + `\nأعمال صيانة مفتوحة (جارية / مجدولة): ${open.length}.`);
  }

  // ───────── 5. invoices / payments / outstanding ─────────
  if (wInv || wPay) {
    const inv = data.invoices.filter(i => (!customer || norm(i.customerName) === norm(customer)) && inRange(toISO(i.date), range));
    const unpaid = inv.filter(i => i.status === 'UNPAID');
    const paidInv = inv.filter(i => i.status === 'PAID');
    const sum = (a: Invoice[]) => a.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const todayISO = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const overdue = unpaid.filter(i => i.dueDate && toISO(i.dueDate) < todayISO);
    const pays = data.payments.filter(p => (!customer || norm(p.customerName) === norm(customer)) && inRange(toISO(p.date), range));
    remember('finance');
    const head = customer ? customer + ': ' : '';
    const asksPaymentsOnly = wPay && !wInv;
    const out: string[] = [];
    const payLine = L(`Payments received${rangeLabel ? ' ' + rangeLabel : ''}: ${money(pays.reduce((s, p) => s + (Number(p.amount) || 0), 0))} in ${pays.length} payment(s).`, `المدفوعات المستلمة${rangeLabel ? ' ' + rangeLabel : ''}: ${money(pays.reduce((s, p) => s + (Number(p.amount) || 0), 0))} في ${pays.length} دفعة.`);
    if (asksPaymentsOnly) out.push(payLine);
    if (!asksPaymentsOnly) out.push(L(`${inv.length} invoice(s) totalling ${money(sum(inv))} (${paidInv.length} paid ${money(sum(paidInv))}, ${unpaid.length} unpaid ${money(sum(unpaid))}).`, `${inv.length} فاتورة بإجمالي ${money(sum(inv))} (${paidInv.length} مدفوعة ${money(sum(paidInv))}، ${unpaid.length} غير مدفوعة ${money(sum(unpaid))}).`));
    out.push(L(`Outstanding (unpaid invoices): ${money(sum(unpaid))}${overdue.length ? `, of which ${overdue.length} overdue (${money(sum(overdue))})` : ''}.`, `المتبقي (فواتير غير مدفوعة): ${money(sum(unpaid))}${overdue.length ? `، منها ${overdue.length} متأخرة (${money(sum(overdue))})` : ''}.`));
    if (!asksPaymentsOnly && customer) out.push(payLine);
    if (customer) {
      const past = data.customers.find(c => norm(c.name) === norm(customer))?.pastOutstanding || 0;
      if (past > 0) out.push(L(`Previous balance carried on the profile: ${money(past)}.`, `رصيد سابق على ملف العميل: ${money(past)}.`));
    } else if (unpaid.length) {
      const by = new Map<string, number>();
      unpaid.forEach(i => by.set(i.customerName, (by.get(i.customerName) || 0) + (Number(i.amount) || 0)));
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      out.push(L('Largest outstanding balances:', 'أكبر المتبقيات:'), ...top.map(([n, v]) => `• ${n}: ${money(v)}`));
    }
    return head + out.join('\n');
  }

  // ───────── 6. who is this customer (alias lookup) ─────────
  if (wWho && customer && !wOps) {
    remember('customer');
    return L(`That is ${customer}.`, `ده العميل: ${customer}.`);
  }

  // ───────── 7. fuel ─────────
  if (wFuel) {
    const ops = data.operations.filter(o => (!customer || norm(o.customerName) === norm(customer)) && inRange(toISO(o.operationDate), range) && (!portSet || portSet.has(String(o.clipOnPort))));
    const by = new Map<string, number>();
    ops.forEach(o => by.set(String(o.clipOnPort || '-'), (by.get(String(o.clipOnPort || '-')) || 0) + (parseFloat(o.gaz || '0') || 0)));
    const total = [...by.values()].reduce((a, b) => a + b, 0);
    remember('fuel');
    return L(`Fuel logged${rangeLabel ? ' ' + rangeLabel : ''}: ${Math.round(total).toLocaleString()} L.`, `الوقود المسجل${rangeLabel ? ' ' + rangeLabel : ''}: ${Math.round(total).toLocaleString()} لتر.`) +
      (by.size ? '\n' + [...by.entries()].sort((a, b) => b[1] - a[1]).map(([p, v]) => `• ${p}: ${Math.round(v).toLocaleString()} L`).join('\n') : '');
  }

  // ───────── 8. revenue ─────────
  if (wRev) {
    const ops = data.operations.filter(o => o.status === 'DONE' && (!customer || norm(o.customerName) === norm(customer)) && inRange(toISO(o.operationDate), range) && (!portSet || portSet.has(String(o.clipOnPort))));
    const base = ops.reduce((s, o) => s + numOf(o.rate), 0), vat = ops.reduce((s, o) => s + numOf(o.vat), 0);
    remember('revenue');
    return (customer ? customer + ': ' : '') + L(`Completed-operations revenue${rangeLabel ? ' ' + rangeLabel : ''}: ${money(base + vat)} (base ${money(base)} + VAT ${money(vat)}) from ${ops.length} operation(s).`, `إيراد العمليات المكتملة${rangeLabel ? ' ' + rangeLabel : ''}: ${money(base + vat)} (الأساس ${money(base)} + ضريبة ${money(vat)}) من ${ops.length} عملية.`);
  }

  // ───────── 9. operations ─────────
  if (wOps || (customer && !wGen)) {
    const statusMap: [string, string[]][] = [
      ['DONE', ['done', 'completed', 'complete', 'finished', 'مكتمل', 'مكتمله', 'خلصان', 'خلصت', 'منتهي']],
      ['UNDER OPERATE', ['under operate', 'تحت التشغيل']],
      ['IN PROGRESS', ['in progress', 'active', 'ongoing', 'running', 'جاري', 'جاريه', 'نشط', 'شغال']],
      ['HOLD', ['hold', 'on hold', 'معلق', 'معلقه', 'موقوف']],
      ['CANCEL', ['cancel', 'cancelled', 'canceled', 'ملغي', 'ملغيه', 'الغاء']],
    ];
    const status = statusMap.find(([, w]) => has(nq, w))?.[0];
    let ops = data.operations.filter(o => (!customer || norm(o.customerName) === norm(customer)) && (!portSet || portSet.has(String(o.clipOnPort)) || portSet.has(String(o.clipOffPort))) && (!status || o.status === status) && inRange(toISO(o.operationDate), range));
    ops = ops.sort((a, b) => toISO(b.operationDate).localeCompare(toISO(a.operationDate)));
    remember('operations');
    const parts = [customer, portText, status, rangeLabel].filter(Boolean).join(' · ');
    if (!ops.length) return L(`No recorded operations${parts ? ' for ' + parts : ''}.`, `مفيش عمليات مسجلة${parts ? ' لـ ' + parts : ''}.`);
    const byStatus = new Map<string, number>();
    ops.forEach(o => byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1));
    const stat = [...byStatus.entries()].map(([s, n]) => `${s}: ${n}`).join(' · ');
    const lines = ops.slice(0, 10).map((o, i) => `${i + 1}. ${o.bookingNumber || '-'} · ${o.containerNumber || '-'} · ${customer ? '' : o.customerName + ' · '}${toISO(o.operationDate) || '-'} · ${o.status} · ${o.clipOnPort || '-'}→${o.clipOffPort || '-'}`);
    return [L(`${ops.length} recorded operation(s)${parts ? ' – ' + parts : ''}. ${stat}`, `${ops.length} عملية مسجلة${parts ? ' – ' + parts : ''}. ${stat}`), ...lines, ops.length > 10 ? L(`…and ${ops.length - 10} more.`, `…و${ops.length - 10} كمان.`) : ''].filter(Boolean).join('\n');
  }

  // ───────── 10. gensets: counts, status, location, stock ─────────
  if (wGen || wWhere || wCount || ports || has(nq, ['stock', 'inventory', 'fleet', 'استوك', 'مخزون', 'المخزون', 'الاستوك', 'الاسطول', 'اسطول'])) {
    const statusWords: [string, string[]][] = [
      ['IN_STOCK', ['in stock', 'instock', 'available', 'free', 'مخزون', 'بالمخزون', 'في المخزون', 'متاح', 'متاحه', 'استوك', 'ستوك']],
      ['CLIPPED_ON', ['clipped on', 'clipped', 'clip on', 'deployed', 'under operate', 'in use', 'مركب', 'مركبه', 'تحت التشغيل', 'شغال', 'شغاله', 'مستخدم']],
      ['MAINTENANCE', ['maintenance', 'repair', 'صيانه', 'بالصيانه']],
      ['RETIRED', ['retired', 'scrapped', 'decommissioned', 'متقاعد', 'متقاعده', 'تكهين', 'مكهن', 'خرده']],
    ];
    const status = statusWords.find(([, w]) => has(nq, w))?.[0];
    const base = data.gensets.filter(g => !portSet || portSet.has(String(g.location)));
    const rows = status ? base.filter(g => g.status === status) : base;
    const count = (arr: Genset[], s: string) => arr.filter(g => g.status === s).length;
    remember('fleet');

    // per-port breakdown when asked "each port / by port / location / where"
    const wantsTable = !portSet && !status && (wWhere || has(nq, ['each', 'every', 'by port', 'per port', 'كل', 'حسب', 'stock', 'استوك', 'مخزون', 'المخزون', 'الاستوك', 'distribution', 'توزيع']));
    if (wantsTable) {
      const locs = [...new Set(data.gensets.map(g => String(g.location)))].sort();
      const table = locs.map(l => { const a = data.gensets.filter(g => String(g.location) === l); return `• ${l}: ${a.length} (${L('in stock', 'مخزون')} ${count(a, 'IN_STOCK')} · ${L('clipped on', 'مركب')} ${count(a, 'CLIPPED_ON')} · ${L('maint.', 'صيانة')} ${count(a, 'MAINTENANCE')} · ${L('retired', 'متقاعد')} ${count(a, 'RETIRED')})`; });
      return [L(`Fleet total: ${data.gensets.length}. By location:`, `إجمالي الأسطول: ${data.gensets.length}. حسب الموقع:`), ...table].join('\n');
    }
    if (portSet) {
      const names = [...portSet].map(p => `${portLabel(p, ar)}: ${data.gensets.filter(g => g.location === p).length}`).join(' · ');
      if (status) return L(`${status} gensets at ${portText}: ${rows.length}.`, `مولدات ${status} في ${portText}: ${rows.length}.`) + (rows.length && rows.length <= 40 ? '\n' + rows.map(g => g.unitNumber).join(', ') : '');
      return L(`${portText}: ${base.length} genset(s) – in stock ${count(base, 'IN_STOCK')}, clipped on ${count(base, 'CLIPPED_ON')}, maintenance ${count(base, 'MAINTENANCE')}, retired ${count(base, 'RETIRED')}.`,
        `${portText}: ${base.length} مولد – مخزون ${count(base, 'IN_STOCK')}، مركب ${count(base, 'CLIPPED_ON')}، صيانة ${count(base, 'MAINTENANCE')}، متقاعد ${count(base, 'RETIRED')}.`) + (portSet.size > 1 ? `\n(${names})` : '');
    }
    if (status) return L(`Gensets ${status}: ${rows.length} of ${data.gensets.length}.`, `المولدات ${status}: ${rows.length} من ${data.gensets.length}.`) + (wList && rows.length && rows.length <= 40 ? '\n' + rows.map(g => `${g.unitNumber} (${g.location})`).join(', ') : '');
    return L(`Fleet total: ${data.gensets.length} gensets – in stock ${count(data.gensets, 'IN_STOCK')}, clipped on ${count(data.gensets, 'CLIPPED_ON')}, maintenance ${count(data.gensets, 'MAINTENANCE')}, retired ${count(data.gensets, 'RETIRED')}.`,
      `إجمالي المولدات: ${data.gensets.length} – مخزون ${count(data.gensets, 'IN_STOCK')}، مركب ${count(data.gensets, 'CLIPPED_ON')}، صيانة ${count(data.gensets, 'MAINTENANCE')}، متقاعد ${count(data.gensets, 'RETIRED')}.`);
  }

  return null; // not understood → caller may use the in-browser model
}
