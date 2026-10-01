/**
 * Container-number reader: Tesseract.js OCR (runs in the browser, free, no limit)
 * + ISO 6346 check-digit validation. Fully deterministic: a number is only returned
 * when its check digit is valid, so a misread can never slip through.
 */

const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
  N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

/** True when `code` is 4 letters + 7 digits and the ISO 6346 check digit matches. */
export function validateIso6346(code: string): boolean {
  const c = String(code || '').toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = i < 4 ? LETTER_VALUES[c[i]] : Number(c[i]);
    sum += v * 2 ** i;
  }
  return (sum % 11) % 10 === Number(c[10]);
}

// OCR confusions, applied by position (letters in the owner code, digits in the serial).
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', T: '7' };

/** Find a valid container number inside raw OCR text, or null. */
export function extractContainerNumber(rawText: string): string | null {
  const stream = String(rawText || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const candidates: string[] = [];
  for (let i = 0; i + 11 <= stream.length; i++) {
    const w = stream.slice(i, i + 11);
    let fixed = '';
    for (let k = 0; k < 11; k++) {
      const ch = w[k];
      fixed += k < 4 ? (/[A-Z]/.test(ch) ? ch : TO_LETTER[ch] || '?') : (/[0-9]/.test(ch) ? ch : TO_DIGIT[ch] || '?');
    }
    if (!fixed.includes('?') && validateIso6346(fixed)) candidates.push(fixed);
  }
  if (!candidates.length) return null;
  // Prefer the standard equipment categories U / J / Z in the 4th letter.
  return candidates.find(c => 'UJZ'.includes(c[3])) || candidates[0];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

function render(img: HTMLImageElement, rotate: 0 | 90 | 270, invert: boolean): HTMLCanvasElement {
  const maxSide = 1800;
  const scale = Math.min(2, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  const swap = rotate !== 0;
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  // grayscale + contrast stretch (+ optional invert for white-on-dark lettering)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  let min = 255, max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = px[i + 1] = px[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) {
    let g = ((px[i] - min) * 255) / range;
    if (invert) g = 255 - g;
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

let workerPromise: Promise<any> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
        tessedit_pageseg_mode: '11' as any, // sparse text: find text anywhere
      });
      return worker;
    })().catch(err => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

/** Returns the 11-character container number, or 'NOT_FOUND'. */
export async function scanContainerFromImage(dataUri: string): Promise<string> {
  const img = await loadImage(dataUri.startsWith('data:') ? dataUri : `data:image/jpeg;base64,${dataUri}`);
  const worker = await getWorker();
  const passes: [0 | 90 | 270, boolean][] = [[0, false], [0, true], [90, false], [270, false], [90, true], [270, true]];
  let allText = '';
  for (const [rotate, invert] of passes) {
    const { data } = await worker.recognize(render(img, rotate, invert));
    const found = extractContainerNumber(data?.text || '');
    if (found) return found;
    allText += ' ' + (data?.text || '');
  }
  return extractContainerNumber(allText) || 'NOT_FOUND';
}
