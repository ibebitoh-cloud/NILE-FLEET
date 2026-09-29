import { supabase } from './supabaseClient';

const AI_ENDPOINT = '/ai-proxy';
const OPEN_SOURCE_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

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
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.error || raw || `HTTP ${res.status}`;
    throw new Error(`AI request failed (${res.status}): ${detail}`);
  }

  if (!data) {
    throw new Error('AI request returned an empty response.');
  }

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
  try {
    const { text, error, detail } = await callAi('runThinkingAudit', {
      prompt,
      model: OPEN_SOURCE_MODEL,
      maxTokens: Math.min(Math.max(budget, 120), 700),
    });
    if (error) throw new Error(detail || error);
    return text || '';
  } catch (e) {
    console.error('DALI 1.0 failed', e);
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
