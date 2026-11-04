import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Makes an invoice fill an A4 sheet (inside a small margin printers can reach),
// shrinking it just enough when it has many rows. Very long invoices (statements)
// go onto several pages, cut only between rows, never through one.

const A4_W_MM = 210;
const A4_H_MM = 297;
/** White edge kept around the invoice, so no printer crops it. */
export const MARGIN_MM = 6;
const AREA_W_MM = A4_W_MM - MARGIN_MM * 2;
const AREA_H_MM = A4_H_MM - MARGIN_MM * 2;
const PX_PER_MM = 96 / 25.4;
// Below this the text gets too small to read; longer invoices use more pages instead.
const MIN_SCALE = 0.62;

const areaHeightPx = AREA_H_MM * PX_PER_MM;

const getSheet = (root: HTMLElement): HTMLElement =>
  (root.classList.contains('invoice-container') ? root : root.querySelector<HTMLElement>('.invoice-container')) || root;

/** Natural content height of the invoice when laid out at the given width. */
const measure = (sheet: HTMLElement, widthMm: number): number => {
  sheet.style.transition = 'none';
  const prevWidth = sheet.style.width;
  const prevMin = sheet.style.minHeight;
  sheet.style.width = `${widthMm}mm`;
  sheet.style.minHeight = '0';
  const h = sheet.scrollHeight;
  sheet.style.width = prevWidth;
  sheet.style.minHeight = prevMin;
  return h;
};

/** Scale (≤ 1) that lets the invoice fit on one page, or MIN_SCALE when it can't. */
export const fitScale = (root: HTMLElement): number => {
  const sheet = getSheet(root);
  let scale = 1;
  let h = measure(sheet, AREA_W_MM);
  for (let i = 0; i < 6 && h * scale > areaHeightPx; i++) {
    scale = Math.max(MIN_SCALE, (areaHeightPx / h) * scale * 0.99);
    if (scale === MIN_SCALE) break;
    // A wider layout wraps less, so measure again at the width it will really have.
    h = measure(sheet, AREA_W_MM / scale);
  }
  return scale;
};

/** Lays the sheet out so that, after scaling, it is exactly the page width and at least the page height. */
const applyFit = (sheet: HTMLElement, scale: number): (() => void) => {
  const prev = { width: sheet.style.width, minHeight: sheet.style.minHeight, zoom: (sheet.style as any).zoom as string };
  // The sheet animates size changes on screen; capture/print need the final size at once.
  sheet.style.transition = 'none';
  sheet.style.width = `${AREA_W_MM / scale}mm`;
  sheet.style.minHeight = `${(AREA_H_MM - 0.8) / scale}mm`;
  return () => {
    sheet.style.width = prev.width;
    sheet.style.minHeight = prev.minHeight;
    (sheet.style as any).zoom = prev.zoom;
    sheet.style.transition = '';
  };
};

/** CSS for the printed page: A4 with the same small margin the PDF uses. */
export const PRINT_PAGE_CSS = `@page { size: A4 portrait; margin: ${MARGIN_MM}mm; }`;

/** Prepares the on-page print copy: full page width, shrunk to one page when possible. */
export const fitForPrint = (printRoot: HTMLElement, measureRoot: HTMLElement): (() => void) => {
  const scale = fitScale(measureRoot);
  const sheet = getSheet(printRoot);
  const restore = applyFit(sheet, scale);
  (sheet.style as any).zoom = String(scale);
  return restore;
};

/** Points (in sheet px from the top) where a page may be cut without splitting content. */
const safeBreaks = (sheet: HTMLElement): number[] => {
  const top = sheet.getBoundingClientRect().top;
  const points = new Set<number>();
  sheet.querySelectorAll<HTMLElement>('tr, .render-header, .render-bill-to, .render-statement-summary, .no-break, table')
    .forEach(el => points.add(Math.round(el.getBoundingClientRect().bottom - top)));
  return Array.from(points).sort((a, b) => a - b);
};

/** Renders the invoice into an A4 PDF that fills the page and never crops content. */
export const buildInvoicePdf = async (root: HTMLElement): Promise<jsPDF> => {
  const sheet = getSheet(root);
  const scale = fitScale(root);
  const restore = applyFit(sheet, scale);
  try {
    // Let the browser lay the sheet out at its new width.
    await new Promise(r => requestAnimationFrame(() => r(null)));
    const sheetH = sheet.offsetHeight;
    const sheetW = sheet.offsetWidth;
    const pagePx = sheetW * (AREA_H_MM / AREA_W_MM); // one page of content, in sheet px
    const breaks = safeBreaks(sheet);

    // Keep the real window width so the app's phone layout rules never apply to the copy.
    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: sheetW,
      height: sheetH,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const ratio = canvas.height / sheetH; // canvas px per sheet px

    // Cut into pages at the last safe point that still fits.
    let start = 0;
    let first = true;
    while (start < sheetH - 2) {
      let end = Math.min(sheetH, start + pagePx);
      if (end < sheetH) {
        const fit = breaks.filter(b => b > start + 40 && b <= end);
        if (fit.length) end = fit[fit.length - 1];
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.max(1, Math.ceil((end - start) * ratio));
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.floor(start * ratio), canvas.width, slice.height, 0, 0, canvas.width, slice.height);

      if (!first) pdf.addPage();
      const hMm = ((end - start) / sheetW) * AREA_W_MM;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, AREA_W_MM, Math.min(hMm, AREA_H_MM), undefined, 'FAST');
      first = false;
      start = end;
    }
    return pdf;
  } finally {
    restore();
  }
};
