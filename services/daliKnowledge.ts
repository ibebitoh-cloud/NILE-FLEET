import { supabase } from './supabaseClient';

export const DALI_TRAINING_CREATOR_ID = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5';

export async function canEditDaliTraining(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id === DALI_TRAINING_CREATOR_ID;
}

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
  if (auth.user.id !== DALI_TRAINING_CREATOR_ID) throw new Error('Only the Manual Training Node creator can add or edit training data.');
  const { data, error } = await supabase.from('dali_knowledge').insert({
    category: input.category || 'company_rule', title: input.title.trim(), content: input.content.trim(),
    keywords: input.keywords || [], applies_to: input.applies_to || [], source: input.source || 'User taught DALI',
    priority: input.priority ?? 70, active: true, created_by: auth.user.id
  }).select('*').single();
  if (error) throw new Error(`DALI teaching failed: ${error.message}`);
  return data as DaliKnowledge;
}

/** Reads an uploaded document as plain text. PDF and Excel readers load only when needed. */
export async function readDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      pages.push(text.items.map((item: any) => ('str' in item ? item.str : '') + (item.hasEOL ? '\n' : ' ')).join(''));
    }
    return pages.join('\n\n');
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return book.SheetNames.map(sheet => `${sheet}\n${XLSX.utils.sheet_to_csv(book.Sheets[sheet])}`).join('\n\n');
  }
  return file.text();
}

/** Splits text into paragraph-aligned chunks small enough for DALI's prompt. */
export function chunkDocument(text: string, size = 1400): string[] {
  const paragraphs = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    for (let i = 0; i < p.length; i += size) {
      const piece = p.slice(i, i + size);
      if (current && current.length + piece.length + 2 > size) { chunks.push(current); current = ''; }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Saves a document as searchable knowledge rows, one per chunk. Staff-only through row-level security. */
export async function teachDaliDocument(input: { fileName: string; text: string; category?: string; keywords?: string[] }): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) throw new Error('No active user');
  if (auth.user.id !== DALI_TRAINING_CREATOR_ID) throw new Error('Only the Manual Training Node creator can add or edit training data.');
  const chunks = chunkDocument(input.text);
  if (!chunks.length) throw new Error('No readable text was found in this document.');
  if (chunks.length > 200) throw new Error(`This document is too long (${chunks.length} parts). Split it into smaller files.`);
  const baseTitle = input.fileName.replace(/\.[^.]+$/, '');
  const nameWords = baseTitle.split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3);
  const rows = chunks.map((content, i) => ({
    category: input.category || 'document',
    title: chunks.length > 1 ? `${baseTitle} (part ${i + 1}/${chunks.length})` : baseTitle,
    content,
    keywords: [...new Set([...nameWords, ...(input.keywords || [])])],
    applies_to: [],
    source: `Document: ${input.fileName}`,
    priority: 60,
    active: true,
    created_by: auth.user!.id,
  }));
  const { error } = await supabase.from('dali_knowledge').insert(rows);
  if (error) throw new Error(`DALI document save failed: ${error.message}`);
  return rows.length;
}
