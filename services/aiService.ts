import { supabase } from './supabaseClient';
import { db } from './supabaseDb';
import { answerDali, DaliData } from '../daliEngine';
import { getDaliCustomerAliases } from './daliCustomerAliases';

const AI_ENDPOINT = '/ai-proxy';
const OPEN_SOURCE_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';

async function callAi(action: string, payload: any) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('No active Supabase session');

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const raw = await res.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!res.ok) {
    const detail = data?.detail || data?.error || raw || `HTTP ${res.status}`;
    throw new Error(`AI request failed (${res.status}): ${detail}`);
  }
  if (!data) throw new Error('AI request returned an empty response.');
  return data;
}

function extractQuestion(prompt: string): string | null {
  const marker = '\nLATEST QUESTION:';
  const start = prompt.lastIndexOf(marker);
  if (start >= 0) {
    const after = prompt.slice(start + marker.length);
    const live = after.indexOf('\nLIVE CONTEXT:');
    const q = (live >= 0 ? after.slice(0, live) : after).trim();
    if (q) return q;
  }
  const legacy = prompt.lastIndexOf('\nUSER QUESTION:\n');
  if (legacy >= 0) {
    const q = prompt.slice(legacy + '\nUSER QUESTION:\n'.length).trim();
    if (q) return q;
  }
  return null;
}

async function buildDaliData(): Promise<DaliData> {
  const users = db.getUsers().filter((u: any) => String(u.role || '').toUpperCase() === 'CUSTOMER');
  const customers = users.map((u: any) => ({
    id: String(u.id),
    name: String(u.companyName || u.name || ''),
    nameAr: u.companyNameAr,
    pastOutstanding: Number(u.pastOutstandingAmount) || 0,
  }));
  const customerNameById = new Map(customers.map(c => [c.id, c.name]));
  let aliases: { alias: string; customer: string }[] = [];
  try {
    aliases = (await getDaliCustomerAliases())
      .map(a => ({ alias: a.alias, customer: customerNameById.get(String(a.customer_id)) || '' }))
      .filter(x => x.customer);
  } catch {
    // Live operational answers remain available even if the alias table is unavailable.
  }

  return {
    gensets: db.getStock(),
    operations: db.getOperations(),
    reservations: db.getReservations(),
    invoices: db.getInvoices(),
    payments: db.getPayments(),
    maintenance: db.getMaintenanceLogs(),
    customers,
    aliases,
    now: new Date(),
  };
}

export const getSafeApiKey = (): string | null => 'open-source-nile-ai';

export const runThinkingAudit = async (prompt: string, budget: number = 1200) => {
  // DALI's deterministic engine is the source of truth for operational questions.
  // This prevents the LLM from rewriting counts, locations, statuses, IDs or dates.
  const question = extractQuestion(prompt);
  if (question) {
    try {
      const liveData = await buildDaliData();
      const { data: sessionData } = await supabase.auth.getSession();
      const contextKey = sessionData.session?.user?.id || 'anonymous';
      const exact = answerDali(question, liveData, contextKey);
      if (exact) return exact;
    } catch (error) {
      console.warn('DALI deterministic route failed; falling back to AI:', error);
    }
  }

  // Only questions that the deterministic engine does not understand reach the model.
  try {
    const { text, error, detail } = await callAi('runThinkingAudit', {
      prompt,
      model: OPEN_SOURCE_MODEL,
      maxTokens: Math.min(Math.max(budget, 200), 3000),
    });
    if (error) throw new Error(detail || error);
    return text || '';
  } catch (e) {
    console.error('DALI DeepSeek route failed', e);
    throw e;
  }
};

export const translateBusinessEntities = async (names: string[]) => {
  if (names.length === 0) return {};
  try {
    return await callAi('translateBusinessEntities', { names });
  } catch (e) {
    console.error('Translation Node Error', e);
    return {};
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
