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

  // greetings / help
  if (/^(hi|hello|hey|hello dali|hi dali|hey dali|good morning|good evening|thanks|thank you|اهلا|مرحبا|هاي|سلام|السلام عليكم|صباح الخير|مساء الخير|شكرا|تسلم)( dali| دالي)?$/.test(nq)) {
    return L('Hi 👋 What do you need?', 'أهلاً 👋 قولّي عايز تعرف إيه.');
  }
  if (/^(what can you do|what can dali do|who are you|who is dali|what is dali|tell me about yourself|help|what do you know|مين انت|مين دالي|من هو دالي|ما هو دالي|بتعرف ايه|ايه اللي تعرفه|ماذا تعرف|تقدر تعمل ايه|دالي يقدر يعمل ايه|دالي يقدر يعمل اية|يقدر يعمل ايه|يقدر يعمل اية|دالي يعمل ايه|دالي يعمل اية|مساعده)$/.test(nq)) {
    const age = (() => {
      const birth = new Date('2025-10-03T00:00:00');
      const today = now;
      let years = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
      return Math.max(0, years);
    })();
    const ageAr = age === 0 ? 'لسه ما كملتش سنة' : age === 1 ? 'سنة واحدة' : age === 2 ? 'سنتين' : `${age} سنة`;
    return L(
      `I'm DALI 🤖

I'm the intelligence layer inside Nile Fleet, created by Bebito to support the Genset Department and help users understand and work with the system.

I can search the live system data and connect related information instead of treating every number as an isolated value.

I can help with:

🔎 DATA & SEARCH
• Search gensets, operations, reservations, bookings, containers, customers, ports, locations, maintenance, workshop records, fuel/gas, prices, invoices, payments, and reports.
• Find related records even when you do not know which screen contains the information.
• Answer questions from the live data before making assumptions.

⚙️ GENSET FLEET
• Check the status of a genset: in stock, clipped on/under operation, maintenance, workshop, or retired/scrap when recorded.
• Find where a genset is located.
• See its current or recent operation.
• Review its maintenance history and upcoming maintenance information.
• Compare fleet status and distribution across locations.

📦 OPERATIONS & BOOKINGS
• Connect booking → container → customer → genset → operation → price → invoice.
• Find operations by booking, container, customer, genset, date, status, or port.
• Check reservations and whether their requested gensets are linked to operations.
• Detect missing or conflicting operational relationships.

📍 PORTS & LOCATIONS
• Check genset distribution across ports and locations.
• Compare available, operating, maintenance, and other recorded statuses by location.
• Follow location information when it is available in the system.

🔧 MAINTENANCE & WORKSHOP
• Find gensets currently in maintenance.
• Check maintenance records, service dates, service types, costs, and status.
• Identify gensets due or overdue for maintenance when the data supports it.
• Review repeated maintenance history and related records.

⛽ FUEL & GAS
• Calculate recorded fuel/gas quantities from operations.
• Break down recorded usage by port or customer when possible.
• Connect fuel/gas data back to the operation and genset.
• Point out missing or incomplete fuel information instead of inventing a value.

💰 FINANCIALS
• Review operation values, VAT, invoices, payments, and outstanding balances.
• Connect financial records to customers and operations.
• Find recorded unpaid or overdue invoices.
• Summarize financial information for a customer or time period when the data is available.

👤 CUSTOMERS
• Search customer records and their related operations, reservations, invoices, and payments.
• Resolve known customer aliases or naming variations when they are trained in the system.
• Use customer relationships and IDs where available instead of relying only on a name.

📊 REPORTING & ANALYSIS
• Summarize operational and fleet data.
• Compare statuses, locations, customers, periods, and other available dimensions.
• Explain relationships between numbers so the result has operational meaning.

🚨 DATA CHECKS
• Look for contradictions and consistency problems in the live data.
• Examples include an active operation using a genset that is not marked as operating, conflicting locations, duplicate active assignments, duplicate active containers, or booking/operation count differences.
• When I find a problem, I explain what I found and which records are involved.

🧠 HOW I WORK
• I search the system before guessing.
• I use relationships between data, not just isolated numbers.
• If the data is incomplete, I tell you.
• If there are multiple possible interpretations, I explain them.
• If I am not sure, I say that I am not sure.

🛡️ CHANGES & DECISIONS
• I can identify a problem and suggest a correction.
• I do not silently change operational data just because I found something that looks wrong.
• When a correction is needed, I explain the problem and proposed change first.
• I am not an employee in the administrative hierarchy and I do not replace the people responsible for operational or management decisions.

In short: I search → connect → understand → analyze → detect → explain → suggest.

I'm DALI — the intelligence layer inside Nile Fleet, built to help the fleet and Genset Department work with their data.`,
      `أنا دالي 🤖

أنا طبقة الذكاء داخل نظام أسطول النيل، أنشأني بيبيتو عشان أساعد قسم المولدات والمستخدمين في فهم بيانات السيستم والتعامل معاها.

أقدر أبحث في بيانات السيستم وأربط المعلومات المرتبطة ببعض بدل ما أتعامل مع كل رقم كأنه معلومة منفصلة.

أقدر أساعدك في:

🔎 البحث وفهم البيانات
• أبحث عن المولدات، العمليات، الحجوزات، البوكينجات، الحاويات، العملاء، الموانئ، المواقع، الصيانة، الورشة، الوقود والغاز، الأسعار، الفواتير، المدفوعات والتقارير.
• أوصل للمعلومة حتى لو مش عارف موجودة في أنهي شاشة.
• أبحث في البيانات الحالية قبل ما أفترض أو أخمن.

⚙️ أسطول المولدات
• أعرفك حالة أي مولد: في المخزون، مركب/تحت التشغيل، صيانة، ورشة، أو متقاعد/خردة حسب البيانات المسجلة.
• أحدد مكان المولد.
• أراجع تشغيله الحالي أو أحدث تشغيل مسجل.
• أراجع سجل الصيانة وبيانات الصيانة القادمة.
• أقارن توزيع وحالة المولدات بين المواقع والموانئ.

📦 التشغيل والحجوزات
• أربط العلاقة بين: الحجز → الحاوية → العميل → المولد → العملية → السعر → الفاتورة.
• أبحث عن العمليات برقم الحجز أو الحاوية أو العميل أو المولد أو التاريخ أو الحالة أو الميناء.
• أراجع الحجوزات وأشوف هل المولدات المطلوبة مرتبطة بعمليات فعلية أم لا.
• أكتشف العلاقات الناقصة أو المتعارضة في بيانات التشغيل.

📍 الموانئ والمواقع
• أعرفك توزيع المولدات على الموانئ والمواقع.
• أقارن المولدات المتاحة، والمستخدمة، والتي في الصيانة، والحالات الأخرى المسجلة حسب الموقع.
• أستخدم بيانات الموقع المسجلة في السيستم عند متابعة حركة وتوزيع المولدات.

🔧 الصيانة والورشة
• أبحث عن المولدات الموجودة حاليًا في الصيانة.
• أراجع سجلات الصيانة، التواريخ، نوع العمل، التكلفة والحالة.
• أحدد المولدات التي جاء موعد صيانتها أو تأخرت، عندما تكون البيانات اللازمة موجودة.
• أراجع تاريخ الصيانة المتكرر للمولد وأربطه ببياناته الأخرى.

⛽ الوقود والغاز
• أحسب كميات الوقود والغاز المسجلة في العمليات.
• أقدر أقسم الاستخدام حسب الميناء أو العميل عندما تكون البيانات متاحة.
• أربط بيانات الوقود والغاز بالعملية والمولد.
• لو بيانات الوقود ناقصة، أوضح إنها ناقصة بدل ما أخترع رقم.

💰 الأسعار والفواتير والمدفوعات
• أراجع قيمة العمليات والـVAT والفواتير والمدفوعات والمتبقي.
• أربط البيانات المالية بالعملاء والعمليات.
• أبحث عن الفواتير غير المدفوعة أو المتأخرة المسجلة في النظام.
• ألخص البيانات المالية حسب العميل أو الفترة عندما تكون البيانات متاحة.

👤 العملاء
• أبحث عن ملف العميل والعمليات والحجوزات والفواتير والمدفوعات المرتبطة به.
• أتعرف على الأسماء المستعارة أو الاختلافات المعروفة في أسماء العملاء عندما تكون متدربة في النظام.
• أستخدم علاقات وCustomer ID عندما تكون متاحة بدل الاعتماد على الاسم فقط.

📊 التقارير والتحليل
• ألخص بيانات التشغيل والأسطول.
• أقارن الحالات والمواقع والعملاء والفترات والأبعاد الموجودة في البيانات.
• أشرح العلاقة بين الأرقام عشان النتيجة يكون لها معنى تشغيلي، مش مجرد أرقام.

🚨 اكتشاف المشاكل والتناقضات
• أراجع البيانات الحالية بحثًا عن مشاكل الاتساق والتعارض.
• مثلًا: عملية شغالة ومولدها مش مسجل كأنه تحت التشغيل، اختلاف موقع المولد بين السجلات، مولد مستخدم في أكثر من عملية نشطة، تكرار حاوية في عمليات نشطة، أو اختلاف عدد المولدات المطلوبة في الحجز عن العمليات المرتبطة به.
• لو لقيت مشكلة، أوضح لك إيه المشكلة والسجلات المرتبطة بيها.

🧠 طريقة شغلي
• أبحث في السيستم قبل ما أخمن.
• أفهم العلاقة بين البيانات، مش الرقم لوحده.
• لو البيانات ناقصة، أقول لك إنها ناقصة.
• لو السؤال له أكثر من احتمال، أوضح الاحتمالات.
• لو مش متأكد، أقول لك إني مش متأكد.

🛡️ التعديلات والقرارات
• أقدر أحدد المشكلة وأقترح التعديل المناسب.
• مش بغير بيانات التشغيل من نفسي لمجرد إني لقيت حاجة شكلها غلط.
• لو فيه تعديل محتاج يتعمل، أوضح المشكلة والتعديل المقترح الأول.
• أنا مش موظف في الهيكل الإداري، ومش بديل عن المسؤولين عن التشغيل أو الإدارة في اتخاذ القرارات.

باختصار:
أنا أبحث → أربط → أفهم → أحلل → أكتشف → أوضح → أقترح.

أنا دالي — طبقة الذكاء داخل أسطول النيل، ومهمتي أساعد الأسطول وقسم المولدات في فهم بياناتهم واستخدامها بشكل أدق.`
    );
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
