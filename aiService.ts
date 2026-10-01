/**
 * DALI service layer.
 *
 * No hosted AI and no usage limits:
 *   1. Known audit prompts      -> deterministic reports (daliAudits)
 *   2. Chat questions           -> exact answers from live data (daliEngine)
 *   3. Anything else            -> small in-browser model grounded on live facts (daliLocalModel)
 *   4. Container photos         -> Tesseract OCR + ISO 6346 check digit (containerScan)
 * Everything runs in the browser; nothing is sent to an AI provider.
 */
import { db } from './services/supabaseDb';
import { getDaliCustomerAliases } from './services/daliCustomerAliases';
import { answerDali, DaliData } from './daliEngine';
import { auditFromPrompt } from './daliAudits';
import { askLocalModel, warmUpLocalModel, getLocalModelStatus } from './daliLocalModel';
import { scanContainerFromImage } from './containerScan';

export { getLocalModelStatus };

// ───────────── prompt parsing (extract the user's question from the screen prompts) ─────────────

function extractQuestion(prompt: string): string | null {
  const dataMarker = '\nLIVE CONTEXT:';
  const qMarker = '\nLATEST QUESTION:';
  const qStart = prompt.lastIndexOf(qMarker);
  const dStart = prompt.indexOf(dataMarker, Math.max(0, qStart));
  if (qStart >= 0 && dStart > qStart) {
    const q = prompt.slice(qStart + qMarker.length, dStart).trim();
    if (q) return q;
  }
  const legacyQ = prompt.indexOf('\nUSER QUESTION:\n');
  if (legacyQ >= 0) {
    const q = prompt.slice(legacyQ + '\nUSER QUESTION:\n'.length).trim();
    if (q) return q;
  }
  const legacyUser = prompt.indexOf('\nLATEST USER QUESTION:');
  const liveDb = prompt.indexOf('\nLIVE CONTEXT:');
  if (legacyUser >= 0 && liveDb > legacyUser) {
    const section = prompt.slice(legacyUser + '\nLATEST USER QUESTION:'.length, liveDb).split(/\n\nYou are DALI/i)[0].trim();
    if (section) return section;
  }
  return null;
}

function aliasesFromPrompt(prompt: string): { alias: string; customer: string }[] {
  const marker = 'CUSTOMER DICTIONARY (Arabic/alias -> real customer):\n';
  const start = prompt.indexOf(marker);
  if (start < 0) return [];
  const end = prompt.indexOf('\nRECENT MEMORY:', start);
  return prompt.slice(start + marker.length, end >= 0 ? end : prompt.length).split('\n')
    .map(line => { const m = line.match(/^(.+?)\s+->\s+(.+?)\s+\[/); return m ? { alias: m[1].trim(), customer: m[2].trim() } : null; })
    .filter(Boolean) as { alias: string; customer: string }[];
}

// ───────────── live data snapshot ─────────────

let aliasCache: { at: number; rows: { alias: string; customer: string }[] } | null = null;
async function trainedAliases(customerNameById: Map<string, string>) {
  if (aliasCache && Date.now() - aliasCache.at < 5 * 60_000) return aliasCache.rows;
  try {
    const rows = (await getDaliCustomerAliases()).map(a => ({ alias: a.alias, customer: customerNameById.get(String(a.customer_id)) || '' })).filter(r => r.customer);
    aliasCache = { at: Date.now(), rows };
    return rows;
  } catch {
    return aliasCache?.rows || [];
  }
}

async function snapshot(prompt: string): Promise<DaliData> {
  const users = db.getUsers().filter((u: any) => String(u.role || '').toUpperCase() === 'CUSTOMER');
  const customers = users.map((u: any) => ({ id: String(u.id), name: String(u.companyName || u.name || ''), nameAr: u.companyNameAr, pastOutstanding: Number(u.pastOutstandingAmount) || 0 }));
  const byId = new Map<string, string>(customers.map(c => [c.id, c.name] as [string, string]));
  const trained = await trainedAliases(byId);
  return {
    gensets: db.getStock(),
    operations: db.getOperations(),
    reservations: db.getReservations(),
    invoices: db.getInvoices(),
    payments: db.getPayments(),
    maintenance: db.getMaintenanceLogs(),
    customers,
    aliases: [...trained, ...aliasesFromPrompt(prompt)],
  };
}

function factsFor(data: DaliData): string {
  const c = (s: string) => data.gensets.filter(g => g.status === s).length;
  const ops = (s: string) => data.operations.filter(o => o.status === s).length;
  const byLoc = new Map<string, number>();
  data.gensets.forEach(g => byLoc.set(String(g.location), (byLoc.get(String(g.location)) || 0) + 1));
  const unpaid = data.invoices.filter(i => i.status === 'UNPAID');
  return [
    `Gensets total ${data.gensets.length}: in stock ${c('IN_STOCK')}, clipped on ${c('CLIPPED_ON')}, maintenance ${c('MAINTENANCE')}, retired ${c('RETIRED')}.`,
    'Gensets by location: ' + [...byLoc.entries()].map(([l, n]) => `${l} ${n}`).join(', ') + '.',
    `Operations total ${data.operations.length}: in progress ${ops('IN PROGRESS')}, under operate ${ops('UNDER OPERATE')}, done ${ops('DONE')}, hold ${ops('HOLD')}, cancelled ${ops('CANCEL')}.`,
    `Unpaid invoices ${unpaid.length}, outstanding EGP ${Math.round(unpaid.reduce((s, i) => s + (Number(i.amount) || 0), 0))}.`,
    `Reservations pending or approved: ${data.reservations.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length}.`,
    `Customers: ${data.customers.length}.`,
  ].join('\n');
}

// ───────────── public API (same names the screens already import) ─────────────

export const getSafeApiKey = (): string | null => 'local-dali'; // no key needed any more

export const runThinkingAudit = async (prompt: string, _budget: number = 1200): Promise<string> => {
  // 1) report-style prompts (Intelligence views, Financial audit, Access review)
  const report = auditFromPrompt(prompt);
  if (report) return report;

  // 2) chat question
  const question = extractQuestion(prompt);
  if (!question) throw new Error('DALI: unrecognised request');
  const data = await snapshot(prompt);
  const exact = answerDali(question, data);
  if (exact) return exact;

  // 3) open-ended question -> in-browser model (first use downloads it once)
  const arabic = /[\u0600-\u06FF]/.test(question);
  const local = await askLocalModel(question, factsFor(data), arabic).catch(() => null);
  if (local) return local;
  const st = getLocalModelStatus();
  if (st.state === 'loading') {
    return arabic
      ? `بحمّل نموذج دالتي المحلي لأول مرة (${st.progress}%). اسأل تاني بعد دقيقة. في الوقت ده أقدر أجاوب فوراً على: المخزون والموانئ، مكان أي مولد، العمليات، الطلبات، الصيانة، الفواتير والمتبقي.`
      : `I'm loading my offline model for the first time (${st.progress}%). Ask again in a minute. Meanwhile I can answer instantly about: stock and ports, where a genset is, operations, requests, maintenance, invoices and outstanding balances.`;
  }
  return arabic
    ? 'ملقتش إجابة واضحة للسؤال ده في البيانات. جرّب تسأل عن: المخزون والموانئ، مولد معيّن، عمليات عميل، الطلبات، الصيانة، الفواتير أو المتبقي.'
    : "I couldn't find a clear answer to that in your data. Try asking about stock and ports, a specific genset, a customer's operations, requests, maintenance, invoices or outstanding balances.";
};

/** Optional: call once (e.g. when the DALI screen opens) to start downloading the offline model. */
export const prepareDaliOfflineModel = () => warmUpLocalModel();

/** Container photo -> 11-character ISO 6346 number, 'NOT_FOUND', or 'ERROR'. */
export const scanImageForContainer = async (base64Data: string): Promise<string> => {
  try { return await scanContainerFromImage(base64Data); }
  catch (e) { console.error('Container scan failed', e); return 'ERROR'; }
};

/**
 * Arabic names for new business entities. Without an AI model this only uses the trained
 * customer dictionary; unknown names are left untouched (shown in English).
 */
export const translateBusinessEntities = async (names: string[]): Promise<Record<string, string>> => {
  try {
    const rows = aliasCache?.rows || [];
    const out: Record<string, string> = {};
    for (const n of names) {
      const hit = rows.find(r => r.customer.trim().toLowerCase() === n.trim().toLowerCase() && /[\u0600-\u06FF]/.test(r.alias));
      if (hit) out[n] = hit.alias;
    }
    return out;
  } catch { return {}; }
};
