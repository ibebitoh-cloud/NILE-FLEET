import { supabase } from './supabaseClient';

export type DaliMemoryMessage = {
  role: 'user' | 'assistant' | 'system';
  message: string;
  entities?: Record<string, any>;
  created_at?: string;
  session_id?: string;
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
  });

  if (error) throw new Error(`DALI memory save failed: ${error.message}`);
}

export async function getDaliRecentMemory(limit = 24): Promise<DaliMemoryMessage[]> {
  const userId = await currentUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 100));

  const { data, error } = await supabase
    .from('dali_conversations')
    .select('role,message,entities,created_at,session_id')
    .eq('user_id', userId)
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
    .select('role,message,entities,created_at,session_id')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`DALI session memory load failed: ${error.message}`);
  return [...(data || [])].reverse() as DaliMemoryMessage[];
}
