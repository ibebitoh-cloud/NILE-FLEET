/**
 * In-browser backup model for open-ended questions the deterministic engine does not
 * understand. It runs on the user's own device (WebGPU, or WASM as fallback): no server,
 * no cost, no usage limit. The model file (~350 MB) downloads ONCE and is then cached
 * by the browser.
 *
 * transformers.js is loaded from a CDN at runtime (not bundled) so it adds nothing to
 * the app's install/build and cannot break deployment.
 */
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

export type LocalModelState = 'idle' | 'loading' | 'ready' | 'error';
let state: LocalModelState = 'idle';
let progress = 0;
let lastError = '';
let generatorPromise: Promise<any> | null = null;

export const getLocalModelStatus = () => ({ state, progress, error: lastError });

async function load(): Promise<any> {
  if (generatorPromise) return generatorPromise;
  state = 'loading';
  progress = 0;
  generatorPromise = (async () => {
    const tf: any = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    const hasGpu = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
    const progress_callback = (p: any) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') progress = Math.round(p.progress);
    };
    try {
      return await tf.pipeline('text-generation', MODEL_ID, { device: hasGpu ? 'webgpu' : 'wasm', dtype: hasGpu ? 'q4f16' : 'q4', progress_callback });
    } catch (gpuErr) {
      if (!hasGpu) throw gpuErr;
      return await tf.pipeline('text-generation', MODEL_ID, { device: 'wasm', dtype: 'q4', progress_callback });
    }
  })()
    .then(g => { state = 'ready'; progress = 100; return g; })
    .catch(err => { state = 'error'; lastError = err?.message || String(err); generatorPromise = null; throw err; });
  return generatorPromise;
}

/** Start downloading/loading the model in the background (safe to call repeatedly). */
export function warmUpLocalModel(): void {
  if (state === 'idle' || state === 'error') load().catch(() => { /* surfaced via status */ });
}

/**
 * Ask the local model. `facts` is a compact, exact summary of the live data: the model
 * is told to use ONLY those facts. Returns null while the model is still loading.
 */
export async function askLocalModel(question: string, facts: string, arabic: boolean): Promise<string | null> {
  if (state !== 'ready') { warmUpLocalModel(); return null; }
  const generator = await load();
  const system =
    'You are DALI, the assistant of Nile Fleet (clip-on genset services for refrigerated containers at Egyptian ports). ' +
    'Answer in ' + (arabic ? 'Arabic' : 'English') + ', in 1-3 short sentences. ' +
    'Use ONLY the FACTS below for any number, name or status. If the answer is not in the FACTS, say you do not have that information and suggest asking about fleet stock, operations, requests, maintenance or invoices. ' +
    'Never invent numbers.\n\nFACTS:\n' + facts;
  const out = await generator(
    [{ role: 'system', content: system }, { role: 'user', content: question }],
    { max_new_tokens: 160, do_sample: false, return_full_text: false }
  );
  const first = Array.isArray(out) ? out[0] : out;
  const gen = first?.generated_text;
  const text = typeof gen === 'string' ? gen : Array.isArray(gen) ? gen[gen.length - 1]?.content : '';
  return String(text || '').trim() || null;
}
