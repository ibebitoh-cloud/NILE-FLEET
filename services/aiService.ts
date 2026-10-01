import { supabase } from './supabaseClient';

const AI_ENDPOINT = '/ai-proxy';
const OPEN_SOURCE_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';

function extractDaliChatData(prompt: string) {
  // Layout currently sends DALI data as LIVE CONTEXT + LATEST USER QUESTION.
  // Keep compatibility with the older LIVE DATABASE + USER QUESTION format too.
  const formats = [
    { dataMarker: '\nLIVE CONTEXT: ', questionMarker: '\nLATEST USER QUESTION: ' },
    { dataMarker: '\nLIVE DATABASE:\n', questionMarker: '\nUSER QUESTION:\n' },
  ];

  for (const format of formats) {
    const dataStart = prompt.indexOf(format.dataMarker);
    const questionStart = prompt.indexOf(format.questionMarker);
    if (dataStart < 0 || questionStart < 0) continue;

    const jsonStart = dataStart + format.dataMarker.length;
    const jsonEnd = questionStart;
    try {
      const live = JSON.parse(prompt.slice(jsonStart, jsonEnd).trim());
      const question = prompt.slice(questionStart + format.questionMarker.length).trim();
      if (question) return { live, question };
    } catch {
      // Try the next supported prompt format.
    }
  }
  return null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
    .trim();
}

function isGreeting(question: string): boolean {
  return /^(hi|hello|hey|good morning|good evening|good afternoon|thanks|thank you|السلام عليكم|اهلا|أهلا|اهلين|أهلين|هاي|هلا|شكرا|شكرًا)[\s!.,؟?]*$/i.test(question.trim());
}

function extractCustomerName(question: string): string {
  return question
    .replace(/\b(?:how many|how much|count|number of|operations?|operation|jobs?|work|gensets?|genset|needed|required|need|needs|requested|request|for|the|customer|client)\b/gi, ' ')
    .replace(/(?:كام|كم|عدد|مولد|مولدات|مطلوب|مطلوبه|مطلوبة|محتاج|محتاجه|احتياج|عمليات|عمليه|شغل|للعميل|العميل|شركة|شركه|ل|من|عن)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCustomerAliases(prompt: string): Array<{ alias: string; customer: string }> {
  const marker = 'CUSTOMER DICTIONARY (Arabic/alias -> real customer):\n';
  const start = prompt.indexOf(marker);
  if (start < 0) return [];
  const end = prompt.indexOf('\nRECENT MEMORY:', start);
  const section = prompt.slice(start + marker.length, end >= 0 ? end : prompt.length);
  return section
    .split('\n')
    .map(line => {
      const m = line.match(/^(.+?)\s+->\s+(.+?)\s+\[/);
      return m ? { alias: m[1].trim(), customer: m[2].trim() } : null;
    })
    .filter(Boolean) as Array<{ alias: string; customer: string }>;
}

function resolveCustomer(question: string, live: any, prompt: string): string | null {
  const aliases = getCustomerAliases(prompt);
  const nq = normalizeText(question);
  for (const item of aliases) {
    const alias = normalizeText(item.alias);
    if (alias && nq.includes(alias)) return item.customer;
  }
  const operations = Array.isArray(live?.relevantOperations)
    ? live.relevantOperations
    : Array.isArray(live?.operations?.rows)
      ? live.operations.rows
      : Array.isArray(live?.operations)
        ? live.operations
        : [];
  const candidates = new Set<string>();
  for (const row of operations) {
    if (row?.customer || row?.customerName) candidates.add(String(row.customer || row.customerName));
  }
  for (const name of candidates) {
    if (nq.includes(normalizeText(name))) return name;
  }
  return null;
}

function getOperationRows(live: any): any[] {
  const candidates = [live?.relevantOperations, live?.operations?.rows, live?.operations?.details, live?.operations];
  for (const rows of candidates) {
    if (Array.isArray(rows) && rows.some(row => typeof row === 'object')) return rows;
  }
  return [];
}

function customerMatches(row: any, customer: string): boolean {
  const target = normalizeText(customer);
  return [row?.customer, row?.customerName, row?.customer_name].some(value => normalizeText(value) === target);
}

function deterministicDaliAnswer(prompt: string): string | null {
  const parsed = extractDaliChatData(prompt);
  if (!parsed) return null;
  const live = parsed.live;
  const question = parsed.question;
  const q = normalizeText(question);
  const ar = /[\u0600-\u06ff]/.test(question);

  if (isGreeting(question)) return ar ? 'أهلاً 👋 قولّي عايز تعرف إيه.' : 'Hi 👋 What do you need?';

  const totalFleetIntent =
    /^(?:total gensets?|how many gensets(?: do we have| are there)?(?: in total)?|how many gensets are in (?:the )?fleet|عدد المولدات|كام مولد عندنا|كام مولد لدينا|اجمالي المولدات|إجمالي المولدات)$/i.test(q);

  const customerOpsIntent =
    /(?:operations?|jobs?|work)\s+(?:for|of)\s+.+/i.test(question) ||
    /(?:عمليات|شغل|عمليات العميل|شغل العميل)\s+.+/i.test(question) ||
    /(?:operations?|jobs?|work).*\b(?:customer|client)\b/i.test(question);

  const requestedIntent =
    /(?:how many|how much|count|number of).*(?:genset|gensets).*(?:need|needs|required|requested|request)/i.test(question) ||
    /(?:genset|gensets).*(?:need|needs|required|requested)/i.test(question) ||
    /(?:كام|كم|عدد).*(?:مولد|مولدات).*(?:مطلوب|محتاج|محتاجه|احتياج)/i.test(question) ||
    /(?:مولد|مولدات).*(?:مطلوب|محتاج|احتياج)/i.test(question);

  if (requestedIntent) {
    const customer = resolveCustomer(question, live, prompt);
    const reservations = live?.reservations;
    const rows = Array.isArray(reservations?.pendingWorkNotLoadedIntoOperations) ? reservations.pendingWorkNotLoadedIntoOperations : [];
    const matches = customer
      ? rows.filter((r: any) => normalizeText(r.customer) === normalizeText(customer))
      : rows.filter((r: any) => normalizeText(r.customer).includes(normalizeText(extractCustomerName(question))));
    const total = matches.reduce((sum: number, r: any) => sum + (Number(r.gensetsNeeded ?? r.containersRequested) || 0), 0);
    const display = customer || extractCustomerName(question) || 'العميل';
    if (ar) {
      return total
        ? display + ': مطلوب ' + total + ' مولد مسجل كطلب ولم يتم تحميله على العمليات بعد.'
        : display + ': لا يوجد حالياً طلب مولدات مسجل كطلب معلق في النظام.';
    }
    return total
      ? display + ': ' + total + ' genset(s) are currently recorded as requested and not yet loaded into operations.'
      : display + ': no pending genset request is currently recorded in the system.';
  }

  if (customerOpsIntent) {
    const customer = resolveCustomer(question, live, prompt);
    const rows = getOperationRows(live);
    if (customer) {
      const matches = rows.filter(row => customerMatches(row, customer));
      if (matches.length) {
        const details = matches.slice(0, 10).map((r: any, i: number) => {
          const booking = r.booking || r.bookingNumber || r.booking_number || '-';
          const container = r.container || r.containerNumber || r.container_number || '-';
          const date = r.date || r.operationDate || r.operation_date || '-';
          const status = r.status || '-';
          const portIn = r.portIn || r.clipOnPort || r.clip_on_port || '';
          const portOut = r.portOut || r.clipOffPort || r.clip_off_port || '';
          return (i + 1) + '. Booking ' + booking + ' • Container ' + container + ' • ' + date + ' • ' + status + ((portIn || portOut) ? ' • ' + portIn + '-' + portOut : '');
        }).join('\n');
        return ar
          ? customer + ': ' + matches.length + ' عملية مسجلة.\n' + details
          : customer + ': ' + matches.length + ' recorded operation(s).\n' + details;
      }
      return ar ? customer + ': لا توجد عمليات مسجلة حالياً.' : customer + ': no recorded operations found.';
    }
  }

  if (totalFleetIntent && !requestedIntent) {
    const total = Number(live?.fleet?.total);
    if (Number.isFinite(total)) return ar ? 'إجمالي المولدات: ' + total : 'Total gensets: ' + total;
  }

  return null;
}

async function callAi(action: string, payload: any) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('No active Supabase session');

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken,
    },
    body: JSON.stringify({ action, payload }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.error || raw || 'HTTP ' + res.status;
    throw new Error('AI request failed (' + res.status + '): ' + detail);
  }

  if (!data) throw new Error('AI request returned an empty response.');
  return data;
}

export const getSafeApiKey = (): string | null => 'open-source-nile-ai';

export const translateBusinessEntities = async (names: string[]) => {
  if (names.length === 0) return {};
  try {
    return await callAi('translateBusinessEntities', { names });
  } catch (e) {
    console.error('Translation Node Error', e);
    return {};
  }
};

export const runThinkingAudit = async (prompt: string, budget: number = 1200) => {
  const deterministic = deterministicDaliAnswer(prompt);
  if (deterministic !== null) return deterministic;
  try {
    const { text, error, detail } = await callAi('runThinkingAudit', {
      prompt,
      model: OPEN_SOURCE_MODEL,
      maxTokens: Math.min(Math.max(budget, 200), 3000),
    });
    if (error) throw new Error(detail || error);
    return text || '';
  } catch (e) {
    console.error('DALI 4.0 DeepSeek route failed', e);
    throw e;
  }
};

export const scanImageForContainer = async (base64Data: string) => {
  try {
    const { text } = await callAi('scanImageForContainer', { base64Data });
    return text || 'NOT_FOUND';
  } catch (e) {
    console.error('DALI container scan failed', e);
    return 'ERROR';
  }
};

export const mapSpreadsheetToSchema = async (csvData: string): Promise<any[]> => {
  try {
    return await callAi('mapSpreadsheetToSchema', { csvData });
  } catch (e) {
    console.error('DALI spreadsheet mapping failed', e);
    return [];
  }
};
