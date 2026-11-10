import { transportDb } from './transportClient';

/**
 * What both DALIs in the Transport app share: the call to the AI proxy and chat memory.
 * Fuel and Customer Rates are separate sections, so each DALI keeps its own chat session
 * and only reads back its own memory (tagged by `app` in dali_conversations.entities).
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
/** 'transport' = Customer Rates (kept as the old tag so earlier rate chats stay), 'fuel' = Fuel. */
export type DaliApp = 'transport' | 'fuel';

export async function callAi<T = any>(action: string, payload: any): Promise<T> {
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

const SESSION_KEYS: Record<DaliApp, string> = { transport: 'nf_transport_dali_session', fuel: 'nf_fuel_dali_session' };

export function sessionId(app: DaliApp, reset = false): string {
  try {
    const key = SESSION_KEYS[app];
    let id = reset ? '' : localStorage.getItem(key) || '';
    if (!id) { id = `${app}-${Date.now().toString(36)}`; localStorage.setItem(key, id); }
    return id;
  } catch { return `${app}-local`; }
}

export async function remember(app: DaliApp, session: string, role: 'user' | 'assistant', message: string) {
  try {
    const { data } = await transportDb.auth.getUser();
    if (!data.user) return;
    await transportDb.from('dali_conversations').insert({ user_id: data.user.id, session_id: session, role, message: message.slice(0, 4000), entities: { app }, archived: false });
  } catch { /* memory is best effort */ }
}

/** This chat's turns, plus short lines from the user's other chats with the SAME DALI (fuel never sees rates chats and back). */
export async function loadMemory(app: DaliApp, session: string): Promise<{ turns: ChatTurn[]; earlier: string[] }> {
  try {
    const { data: u } = await transportDb.auth.getUser();
    if (!u.user) return { turns: [], earlier: [] };
    const { data } = await transportDb.from('dali_conversations').select('role,message,session_id,created_at')
      .eq('user_id', u.user.id).eq('archived', false).eq('entities->>app', app)
      .order('created_at', { ascending: false }).limit(120);
    const all = [...(data || [])].reverse() as { role: string; message: string; session_id: string; created_at: string }[];
    const turns = all.filter(m => m.session_id === session && (m.role === 'user' || m.role === 'assistant')).map(m => ({ role: m.role as ChatTurn['role'], content: m.message }));
    const earlier = all.filter(m => m.session_id !== session && m.role === 'user').slice(-25)
      .map(m => `${m.created_at.slice(0, 10)} asked: ${m.message.replace(/\s+/g, ' ').slice(0, 160)}`);
    return { turns: turns.slice(-30), earlier };
  } catch { return { turns: [], earlier: [] }; }
}
