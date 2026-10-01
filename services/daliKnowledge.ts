import { supabase } from './supabaseClient';

export type DaliKnowledge = {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  applies_to: string[];
  source?: string | null;
  priority: number;
  active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getDaliKnowledge(limit = 250): Promise<DaliKnowledge[]> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 250, 500));
  const { data, error } = await supabase.from('dali_knowledge').select('*')
    .eq('active', true).order('priority', { ascending: false }).order('updated_at', { ascending: false }).limit(safeLimit);
  if (error) throw new Error(`DALI knowledge load failed: ${error.message}`);
  return (data || []) as DaliKnowledge[];
}

export async function searchDaliKnowledge(question: string, limit = 12): Promise<DaliKnowledge[]> {
  const rows = await getDaliKnowledge();
  const tokens = String(question || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2);
  if (!tokens.length) return rows.slice(0, limit);
  return rows.map(row => {
    const hay = [row.title, row.content, ...(row.keywords || []), ...(row.applies_to || [])].join(' ').toLowerCase();
    const score = tokens.reduce((n, token) => n + (hay.includes(token) ? 1 : 0), 0) * 10 + Number(row.priority || 0);
    return { row, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, limit).map(x => x.row);
}

export async function teachDaliKnowledge(input: {
  category?: string; title: string; content: string; keywords?: string[]; applies_to?: string[]; source?: string; priority?: number;
}): Promise<DaliKnowledge> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) throw new Error('No active user');
  const { data, error } = await supabase.from('dali_knowledge').insert({
    category: input.category || 'company_rule', title: input.title.trim(), content: input.content.trim(),
    keywords: input.keywords || [], applies_to: input.applies_to || [], source: input.source || 'User taught DALI',
    priority: input.priority ?? 70, active: true, created_by: auth.user.id
  }).select('*').single();
  if (error) throw new Error(`DALI teaching failed: ${error.message}`);
  return data as DaliKnowledge;
}
