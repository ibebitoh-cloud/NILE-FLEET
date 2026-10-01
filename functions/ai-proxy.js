// Cloudflare Pages Function: DALI 4.0 runs AI features on Cloudflare Workers AI.
// DALI uses the open-source DeepSeek-R1-Distill-Qwen-32B model for interactive
// reasoning, with Qwen3-30B-A3B as the open-source fallback.
// OCR remains on the dedicated vision models below.
const TEXT_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
const VISION_MODEL = '@cf/qwen/qwen3.8-27b';
const VISION_FALLBACK_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const TEXT_FALLBACK_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const AI_RETRY_DELAY_MS = 120;
const AI_MAX_RETRIES_PER_MODEL = 2;

// Open models are less reliable than Claude/GPT at strictly following
// "return only JSON" instructions — strip code fences and grab the first
// {...} or [...] block to make parsing robust.
function parseJsonLoose(text) {
  let cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
  const firstBrace = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter(i => i !== -1)
  );
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Every AI request must come from an authenticated Supabase user.
  // The service-role key is server-side only and is never exposed to the browser.
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return json({ error: 'Authenticated Supabase session required' }, 401);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey },
  });
  if (!authResponse.ok) {
    return json({ error: 'Invalid or expired Supabase session' }, 401);
  }
  const authenticatedUser = await authResponse.json();
  if (!authenticatedUser?.id) {
    return json({ error: 'Invalid Supabase user session' }, 401);
  }

  if (request.method === 'GET') {
    return json({
      ok: !!env.AI,
      service: 'DALI 4.0 - DeepSeek R1',
      textModel: TEXT_MODEL,
      fallbackTextModel: TEXT_FALLBACK_MODEL,
      visionModel: VISION_MODEL,
      message: env.AI ? 'Workers AI binding is connected.' : 'Workers AI binding is missing.'
    }, env.AI ? 200 : 500);
  }

  if (!env.AI) {
    return json({ error: 'Workers AI binding not configured. Add an "AI" binding in Cloudflare -> Settings -> Functions -> Bindings.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, payload } = body;

  try {
    switch (action) {
      case 'translateBusinessEntities': {
        const { names } = payload;
        if (!names || names.length === 0) return json({});
        const result = await runTextModel(env, {
          messages: [
            { role: 'system', content: 'You translate logistics business entity names (trucking companies, shippers, clients) into professional Arabic. Respond with ONLY a raw JSON object — no markdown, no code fences, no commentary — where each key is the original name and each value is its Arabic translation.' },
            { role: 'user', content: `Names: ${names.join(', ')}` },
          ],
          max_tokens: 1500,
          temperature: 0.2,
        });
        return json(parseJsonLoose(extractText(result)));
      }

      case 'runThinkingAudit': {
        const { prompt } = payload || {};
        if (!prompt?.trim()) return json({ error: 'Empty AI prompt' }, 400);
        const result = await runTextModel(env, {
          messages: [
            { role: 'system', content: 'You are DALI, Nile Fleet’s operations assistant. Answer the latest question directly before adding context. Use recent conversation only to resolve references such as “it”, “that customer”, or follow-up questions; the latest question takes priority. For Nile Fleet facts, rely only on the supplied live data and clearly say when a needed fact is absent. For general or how-to questions, give a useful direct answer instead of forcing an unrelated fleet-data response. Never invent operational facts. Match the language of the latest question (including Egyptian Arabic/Arabizi); preserve booking, container, and genset IDs, dates, and numeric values exactly. Be concise and use relevant data only. Interpret paraphrases by meaning, not exact keywords: “need / needs / required / asking for / requested / عايز / محتاج / مطلوب / محتاجين” can mean a genset request; “operations / jobs / work / شغل / عمليات” can mean recorded operations; “where / location / فين / موجود فين / موقع” can mean location; “how many / count / كام / عدد” means a quantity question. If a question contains both a customer and an operational subject, resolve the customer first and answer that subject. Distinguish fleet-total questions from customer, port, status, reservation, operation, maintenance, invoice, and payment questions. A customer or port qualifier must never be ignored just because the question also contains “how many”. The system creator is Bebito (bebito@nilefleet.com); treat him as owner when current-user context identifies him. Never reveal credentials, keys, tokens, or secrets. SYSTEM KNOWLEDGE: Understand the application as a connected logistics workflow, not a list of isolated screens. Reservations are customer requests for gensets; approved reservations create operations. Operations connect booking/container/genset/customer/beneficiary/trucker/driver, dates, clip-on and clip-off ports, status, rate and VAT. The gensets master is the current fleet truth for unit number, current location and status (IN_STOCK, CLIPPED_ON, MAINTENANCE, RETIRED). Maintenance logs belong to gensets and contain service date/type, technician, location, status, completion date, cost, parts and next-service information. A genset question may require combining its master record, operations history and maintenance history. Customer requests are represented by reservations; when counting requested gensets, use the reservation quantity field (gensetsNeeded) and do not substitute the total fleet count. A recorded operation is an operation row even when its genset_number is blank; do not assume it is a reservation. Port stock is based on current genset location and status, not the number of historical operations. Invoices represent billing and are associated with customers/bookings/operations; payments represent collections and outstanding balances. Customer questions may require joining profiles, operations, invoices and payments. Use these relationships to answer novel wording and follow-up questions. For numerical answers, calculate from live context; never invent missing data. Think through relationships, dates, status transitions, and distinct-vs-record counts before answering. Do not expose private chain-of-thought; return the concise conclusion and the evidence needed to understand it.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: Math.min(Math.max(payload?.maxTokens || 1200, 200), 2200),
          temperature: 0.45,
          top_p: 0.9,
        });
        const text = extractText(result);
        if (!text) {
          throw new Error('Workers AI returned no text from the primary/fallback model.');
        }
        return json({ text });
      }

      case 'scanImageForContainer': {
        const { base64Data } = payload || {};
        if (!base64Data) return json({ error: 'No image data supplied' }, 400);
        const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const visionInput = {
          messages: [
            { role: 'system', content: "Read the shipping container number visible in the image. A valid BIC container number is exactly 4 letters followed by 7 digits, for example MEDU9907021. Return ONLY the 11-character code in uppercase. Ignore truck numbers, booking numbers, logos and other text. If the container number is not clearly readable, return NOT_FOUND." },
            { role: 'user', content: 'Extract the container number from this image.' },
          ],
          image: dataUri,
          max_tokens: 32,
          temperature: 0,
        };
        let result;
        try {
          result = await env.AI.run(VISION_MODEL, visionInput);
        } catch (primaryError) {
          console.error('Primary container vision model failed:', primaryError);
          result = await env.AI.run(VISION_FALLBACK_MODEL, visionInput);
        }
        const raw = String(result?.response || '').toUpperCase().trim();
        const match = raw.match(/[A-Z]{4}[0-9]{7}/);
        return json({ text: match ? match[0] : 'NOT_FOUND' });
      }

      case 'mapSpreadsheetToSchema': {
        const { csvData } = payload;
        const result = await runTextModel(env, {
          messages: [
            { role: 'system', content: `You are a logistics data mapper. Convert the given CSV/text data into a JSON array. Identify columns even if their names differ slightly from expected. For every entity field (customerName, beneficiaryName, trucker), also provide its Arabic translation in a field suffixed with 'Ar'.

Each array item must have exactly these fields: customerName, customerNameAr, bookingNumber, containerNumber, gensetNumber, clipOnPort, clipOffPort, rate, operationDate, trucker, truckerAr, beneficiaryName, beneficiaryNameAr.

Respond with ONLY the raw JSON array — no markdown, no code fences, no commentary.` },
            { role: 'user', content: csvData },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        });
        return json(parseJsonLoose(extractText(result)));
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('NILE AI proxy error', err);
    return json({
      error: 'AI request failed',
      detail: err?.message || String(err),
      model: TEXT_MODEL,
      fallbackModel: TEXT_FALLBACK_MODEL,
    }, 500);
  }
}

function extractText(result) {
  if (typeof result === 'string') return cleanModelText(result);
  if (!result || typeof result !== 'object') return '';
  if (typeof result.response === 'string') return cleanModelText(result.response);
  if (typeof result.output_text === 'string') return cleanModelText(result.output_text);
  if (typeof result.text === 'string') return cleanModelText(result.text);
  if (typeof result.reasoning === 'string' && result.reasoning.trim()) return cleanModelText(result.reasoning);
  if (Array.isArray(result.choices)) {
    const choice = result.choices[0];
    const content = choice?.message?.content ?? choice?.text;
    if (typeof content === 'string') return cleanModelText(content);
  }
  return '';
}

function cleanModelText(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  // DeepSeek-R1 can return private reasoning in <think>...</think>.
  // Never show that reasoning to the user; keep only the final response.
  const withoutThink = value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return withoutThink || value;
}

async function runTextModel(env, options) {
  // Use the primary reasoning model first, then automatically fail over to Qwen.
  // Each model gets one controlled retry for transient Workers AI failures.
  const attempts = [
    { model: TEXT_MODEL, label: 'DeepSeek R1 Distill' },
    { model: TEXT_FALLBACK_MODEL, label: 'Qwen3 30B A3B' },
  ];
  let lastError = null;

  for (const { model, label } of attempts) {
    for (let attempt = 1; attempt <= AI_MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const result = await env.AI.run(model, options);
        const text = extractText(result);
        if (text) return result;
        lastError = new Error(`${label} returned an empty response`);
        console.error(`${label} returned an empty response (attempt ${attempt}/${AI_MAX_RETRIES_PER_MODEL})`, result);
      } catch (error) {
        lastError = error;
        console.error(`${label} failed (attempt ${attempt}/${AI_MAX_RETRIES_PER_MODEL})`, error);
      }

      if (attempt < AI_MAX_RETRIES_PER_MODEL) {
        await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAY_MS));
      }
    }

    console.warn(`${label} unavailable after ${AI_MAX_RETRIES_PER_MODEL} attempts; switching model.`);
  }

  throw new Error(
    `DALI AI models unavailable after retries. Primary: ${TEXT_MODEL}. Fallback: ${TEXT_FALLBACK_MODEL}. Last error: ${lastError?.message || lastError || 'unknown'}`
  );
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
