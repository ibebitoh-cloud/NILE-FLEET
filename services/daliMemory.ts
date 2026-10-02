import { supabase } from './supabaseClient';

export type DaliMemoryMessage = {
  role: 'user' | 'assistant' | 'system';
  message: string;
  entities?: Record<string, any>;
  created_at?: string;
  session_id?: string;
  archived?: boolean;
};

export type DaliChatSession = {
  session_id: string;
  title: string;
  preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  archived: boolean;
};

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) throw new Error('No active Supabase user for DALI memory');
  return data.user.id;
}

export async function saveDaliConversationMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  entities?: Record<string, any>;
}): Promise<void> {
  const userId = await currentUserId();
  const message = String(input.message || '').trim();
  if (!message) return;

  const { error } = await supabase.from('dali_conversations').insert({
    user_id: userId,
    session_id: input.sessionId,
    role: input.role,
    message,
    entities: input.entities || {},
    archived: false,
  });

  if (error) throw new Error(`DALI memory save failed: ${error.message}`);
}

export async function getDaliRecentMemory(limit = 24): Promise<DaliMemoryMessage[]> {
  const userId = await currentUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 100));

  const { data, error } = await supabase
    .from('dali_conversations')
    .select('role,message,entities,created_at,session_id,archived')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`DALI memory load failed: ${error.message}`);
  return [...(data || [])].reverse() as DaliMemoryMessage[];
}

export async function getDaliConversationMemory(sessionId: string, limit = 16): Promise<DaliMemoryMessage[]> {
  const userId = await currentUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 16, 100));

  const { data, error } = await supabase
    .from('dali_conversations')
    .select('role,message,entities,created_at,session_id,archived')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`DALI session memory load failed: ${error.message}`);
  return [...(data || [])].reverse() as DaliMemoryMessage[];
}

export async function getDaliChatSessions(includeArchived = true): Promise<DaliChatSession[]> {
  const userId = await currentUserId();
  let query = supabase
    .from('dali_conversations')
    .select('session_id,role,message,created_at,archived')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!includeArchived) query = query.eq('archived', false);

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(`DALI chat history load failed: ${error.message}`);

  const grouped = new Map<string, DaliChatSession>();
  for (const row of (data || []) as any[]) {
    const sessionId = String(row.session_id || '').trim();
    if (!sessionId) continue;
    const message = String(row.message || '').trim();
    const existing = grouped.get(sessionId);
    const timestamp = String(row.created_at || new Date().toISOString());
    if (!existing) {
      grouped.set(sessionId, {
        session_id: sessionId,
        title: row.role === 'user' && message ? message.slice(0, 72) : 'DALI conversation',
        preview: message.slice(0, 110),
        message_count: 1,
        created_at: timestamp,
        updated_at: timestamp,
        archived: Boolean(row.archived),
      });
    } else {
      existing.message_count += 1;
      existing.updated_at = timestamp;
      existing.preview = message.slice(0, 110) || existing.preview;
      if (row.role === 'user' && existing.title === 'DALI conversation' && message) existing.title = message.slice(0, 72);
      existing.archived = existing.archived && Boolean(row.archived);
    }
  }

  return [...grouped.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function archiveDaliConversation(sessionId: string, archived = true): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('dali_conversations')
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq('user_id', userId)
    .eq('session_id', sessionId);

  if (error) throw new Error(`DALI archive update failed: ${error.message}`);
}
