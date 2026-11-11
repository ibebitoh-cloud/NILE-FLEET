import type { Lang } from '../i18n';
import type { FuelStrings } from './i18n';

/** One table to export: header labels + rows of plain values. */
export interface Sheet { name: string; head: string[]; rows: (string | number | null)[][] }

const stamp = () => new Date().toISOString().slice(0, 10);
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export async function exportFuelExcel(sheets: Sheet[], lang: Lang, title: string) {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  const head = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '07111F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
  const titleStyle = { font: { bold: true, sz: 13, color: { rgb: '07111F' } } };
  for (const sh of sheets) {
    const aoa = [[`NILE FLEET  |  ${title}  |  ${stamp()}`], [], sh.head, ...sh.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, sh.head.length - 1) } }];
    ws['!cols'] = sh.head.map((h, i) => ({ wch: Math.max(10, Math.min(36, Math.max(String(h).length, ...sh.rows.slice(0, 200).map(r => String(r[i] ?? '').length)) + 2)) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 3 };
    if (ws.A1) ws.A1.s = titleStyle;
    sh.head.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 2, c }); if (ws[ref]) ws[ref].s = head; });
    if (lang === 'ar') (ws as any)['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `NileFleet-Fuel-${stamp()}.xlsx`);
}

export interface PrintKpi { label: string; value: string; sub?: string }

export function printFuelReport(o: {
  lang: Lang; t: FuelStrings; period: string; filters: string; kpis: PrintKpi[]; tables: Sheet[];
  /** 'How we calculate' box under the totals: first line is the heading. */
  method?: string[];
  /** A cleaner, large-type layout for weekly fleet snapshot PDFs. */
  focus?: 'weekly';
}) {
  const rtl = o.lang === 'ar';
  const origin = window.location.origin;
  const table = (sh: Sheet) => `
    <h3>${esc(sh.name)}</h3>
    <table><thead><tr>${sh.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${sh.rows.map(r => `<tr>${r.map(c => `<td${typeof c === 'number' ? ' class="n"' : ''}>${esc(typeof c === 'number' ? c.toLocaleString('en-US', { maximumFractionDigits: 2 }) : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const html = `<!doctype html><html lang="${o.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(o.t.reportTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 11mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${rtl ? "'Cairo', 'Segoe UI', Tahoma" : "'Inter', 'Segoe UI', Arial"}, sans-serif; color: #17283b; font-size: 9px; background:#fff; }
  .band { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:space-between; gap:24px; background:linear-gradient(112deg,#071827 0%,#102d43 68%,#17485a 100%); color:#fff; padding:20px 24px; border-radius:14px; border-bottom:4px solid #d5a94f; min-height:92px; }
  .band:after { content:""; position:absolute; width:220px; height:220px; border:1px solid rgba(255,255,255,.09); border-radius:50%; inset-inline-end:-65px; top:-105px; box-shadow:0 0 0 22px rgba(255,255,255,.025),0 0 0 46px rgba(255,255,255,.02); }
  .brand { display:flex; align-items:center; gap:13px; position:relative; z-index:1; }
  .brand img { height:38px; }
  .brand h1 { margin:0; font-size:23px; font-style:italic; letter-spacing:-.6px; } .brand h1 span { color:#e1bb70; }
  .doc { text-align:end; position:relative; z-index:1; } .doc .k { font-size:9px; letter-spacing:2.4px; color:#e1bb70; font-weight:900; } .doc h2 { margin:5px 0 0; font-size:20px; line-height:1.15; font-weight:900; }
  .meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:13px 2px 16px; color:#526579; font-size:10px; }
  .meta b { display:inline-block; background:#edf4f7; color:#15374d; border:1px solid #d9e7ed; border-radius:6px; padding:5px 9px; }
  .kpis { display:grid; grid-template-columns:repeat(${o.focus === 'weekly' ? 3 : Math.min(6, o.kpis.length)},1fr); gap:${o.focus === 'weekly' ? '14px' : '6px'}; margin:${o.focus === 'weekly' ? '0 0 23px' : '8px 0 4px'}; }
  .kpi { border:1px solid #dce5ea; border-radius:13px; padding:${o.focus === 'weekly' ? '19px 20px' : '6px 8px'}; border-top:4px solid #1b7890; ${o.focus === 'weekly' ? 'min-height:126px; display:flex; flex-direction:column; justify-content:center; background:linear-gradient(145deg,#f5fafc,#edf4f7);' : ''} }
  .kpi:nth-child(2) { border-top-color:#c3943f; ${o.focus === 'weekly' ? 'background:linear-gradient(145deg,#fffaf0,#f8f0df);' : ''} }
  .kpi:nth-child(3) { border-top-color:#32866d; ${o.focus === 'weekly' ? 'background:linear-gradient(145deg,#f1faf6,#e8f4ee);' : ''} }
  .kpi b { display:block; font-size:${o.focus === 'weekly' ? '11px' : '7px'}; letter-spacing:${o.focus === 'weekly' ? '1.3px' : '1.5px'}; color:#526b7b; text-transform:uppercase; }
  .kpi div { font-size:${o.focus === 'weekly' ? '36px' : '13px'}; font-weight:900; margin-top:${o.focus === 'weekly' ? '10px' : '2px'}; line-height:1.05; color:#102b40; font-variant-numeric:tabular-nums; } .kpi i { font-style:normal; color:#607586; font-size:${o.focus === 'weekly' ? '10px' : '7.5px'}; margin-top:7px; }
  ${o.focus === 'weekly' ? '.meta { font-size:11px; margin:14px 2px 18px; } h3 { margin:0 0 10px; padding:10px 13px; border-radius:8px; background:#eaf2f5; border-inline-start:4px solid #1b7890; color:#12364c; font-size:13px; letter-spacing:.3px; } th { padding:10px 11px; font-size:9.5px; background:#12364c; } td { padding:9px 11px; font-size:9.5px; }' : ''}
  .method { margin:8px 0 2px; border:1px solid #e3dccf; border-inline-start:3px solid #c2a378; border-radius:8px; padding:6px 10px; background:#fbf8f2; }
  .method b { font-size:9px; color:#07111f; } .method ol { margin:3px 0 0; padding-inline-start:16px; } .method li { margin:1px 0; line-height:1.45; }
  h3 { margin:12px 0 4px; font-size:11px; color:#07111f; }
  table { width:100%; border-collapse:separate; border-spacing:0; page-break-inside:auto; border:1px solid #dce5ea; border-radius:9px; overflow:hidden; }
  tr { page-break-inside:avoid; }
  th { background:#07111f; color:#fff; padding:4px 5px; font-size:7.5px; text-align:start; }
  td { padding:3px 5px; border-bottom:1px solid #e7edf0; } td.n { text-align:end; font-variant-numeric:tabular-nums; }
  tbody tr:nth-child(even) td { background:#f2f7f9; }
  tbody tr:last-child td { border-bottom:0; }
  .foot { margin-top:18px; display:flex; justify-content:space-between; align-items:center; background:#102d43; color:#fff; padding:10px 16px; border-radius:10px; }
  .dali { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .dali b { font-size: 7px; letter-spacing: 4px; } .dali i { font-style: normal; font-size: 5.5px; letter-spacing: 2px; color: rgba(255,255,255,.6); }
  .dali .ds { display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 900; letter-spacing: 2px; } .dali .ds img { height: 10px; } .dali .ds em { font-style: normal; color: #c2a378; }
</style></head><body>
  <div class="band">
    <div class="brand"><img src="${origin}/nf-mark-white.png" alt="Nile Fleet"><h1>NILE <span>FLEET</span></h1></div>
    <div class="doc"><div class="k">${o.focus === 'weekly' ? (rtl ? 'إدارة النقل · أداء الوقود' : 'TRANSPORT DIVISION  /  FUEL INTELLIGENCE') : 'TRANSPORT · FUEL'}</div><h2>${esc(o.focus === 'weekly' ? (rtl ? 'تقرير أداء الأسطول الأسبوعي' : 'WEEKLY FLEET PERFORMANCE') : o.t.reportTitle)}</h2></div>
  </div>
  <div class="meta"><span>${esc(o.t.period)}</span><b dir="ltr">${esc(o.period)}</b>${o.filters ? `<span>· ${esc(o.filters)}</span>` : ''}<span>· ${esc(o.t.generated)}</span><b dir="ltr">${stamp()}</b></div>
  <div class="kpis">${o.kpis.map(k => `<div class="kpi"><b>${esc(k.label)}</b><div>${esc(k.value)}</div>${k.sub ? `<i>${esc(k.sub)}</i>` : ''}</div>`).join('')}</div>
  ${o.method?.length ? `<div class="method"><b>${esc(o.method[0])}</b><ol>${o.method.slice(1).map(m => `<li>${esc(m)}</li>`).join('')}</ol></div>` : ''}
  ${o.tables.map(table).join('')}
  <div class="foot">
    <div>${o.focus === 'weekly' ? (rtl ? 'نظرة تشغيلية أسبوعية · NILE FLEET' : 'WEEKLY OPERATIONS REVIEW  ·  NILE FLEET') : 'NILE FLEET · nilefleet.app'}</div>
    <div class="dali"><b>NILE FLEET</b><i>POWERED BY</i><span class="ds"><img src="${origin}/dali/dali-mark.png" alt=""><em>DALI</em> STUDIO</span><i>IDEAS INTO DIGITAL</i><i>MOHAMED ALAA · +20 114 647 5759</i></div>
  </div>
</body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    const imgs = Array.from(doc.images);
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; }))).then(() => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 60_000);
    });
  }, 50);
}
