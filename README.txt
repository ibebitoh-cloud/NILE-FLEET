NILE FLEET - DALI without AI limits
===================================
Copy these files into your NILE-FLEET repo (same paths), then:

  1) DELETE the folder  functions/   (it only contained ai-proxy.js - no longer needed)
  2) Replace package.json + package-lock.json (adds tesseract.js for container scanning)
  3) Commit + push with GitHub Desktop. Cloudflare / Vercel will rebuild.

Files
  services/aiService.ts        new routing (no server calls)
  services/daliEngine.ts       exact answers from live data (EN/AR, follow-ups)
  services/daliAudits.ts       deterministic reports (Intelligence views, Financial audit, Access review)
  services/daliLocalModel.ts   in-browser backup model (downloads once, ~350 MB, cached)
  services/containerScan.ts    Tesseract OCR + ISO 6346 check-digit validation
  screens/Intelligence.tsx     comment-only change
  wrangler.jsonc               removed the "ai" binding (not needed any more)

Do NOT use the earlier ai-proxy.js fix - that file is deleted now.
No AI provider, no API key, no daily limit. Works on Cloudflare or Vercel.
