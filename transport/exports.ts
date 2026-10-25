import { PRICE_KEYS, PRICE_LABELS, PriceKey, Rate } from './types';

export type PdfStyle = 'quote' | 'list' | 'grouped';
export type ExportLang = 'ar' | 'en';

export interface ExportOptions {
  lang: ExportLang;
  priceKeys: PriceKey[];
  showNotes: boolean;
  signer: string;
  /** Title for the document (customer name for a quotation). */
  customer?: string;
  validDays?: number;
}

export const COMPANY = {
  nameEn: 'NILE FLEET for Transport and Logistics Service',
  nameAr: 'شركة أسطول النيل لخدمات النقل واللوجستيات',
  phones: '01000992858 / 01000044560',
  email: 'nilefleet@nilefleetlogistics.com',
  site: 'nilefleetlogistics.com',
};

export const DEFAULT_SIGNER = 'سمر حجازي';

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const fileStamp = () => new Date().toISOString().slice(0, 10);

const safeName = (s: string) => (s || 'ALL').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);

const fmt = (n: number) => (n ? n.toLocaleString('en-US') : '—');

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const L = (lang: ExportLang) => lang === 'ar'
  ? {
      no: 'م', customer: 'العميل', load: 'ميناء التحميل', dest: 'الوجهة', transit: 'ميناء العودة', notes: 'ملاحظات',
      quote: 'عرض أسعار نقل', priceList: 'قائمة أسعار النقل', grouped: 'أسعار النقل حسب العميل',
      to: 'السادة /', date: 'التاريخ', ref: 'رقم المرجع', currency: 'الأسعار بالجنيه المصري',
      greeting: 'نتشرف بالتعامل معكم، ويسعدنا أن نقدم لسيادتكم عرض الأسعار التالي لخدمات نقل الحاويات:',
      thanks: 'نشكركم على ثقتكم وتعاونكم المستمر، وفي حال وجود أي استفسارات لا تترددوا في التواصل معنا.',
      regards: 'مع وافر الشكر والتقدير ،،', company: 'شركة / أسطول النيل', from: 'مع تحيات الأستاذة /',
      sign: 'التوقيع المعتمد', stamp: 'ختم الشركة', valid: (d: number) => `هذا العرض ساري لمدة ${d} يومًا من تاريخه.`,
      routes: 'خط', total: 'إجمالي الخطوط', phones: 'تليفونات الشركة',
    }
  : {
      no: 'No.', customer: 'Customer', load: 'Load port', dest: 'Destination', transit: 'Transit port', notes: 'Notes',
      quote: 'Transport Price Quotation', priceList: 'Transport Price List', grouped: 'Transport Rates by Customer',
      to: 'To:', date: 'Date', ref: 'Ref.', currency: 'Prices in Egyptian Pounds (EGP)',
      greeting: 'We are honored to work with you, and we are pleased to present our price quotation for container transport below.',
      thanks: 'Thank you for your trust and continued cooperation. For any questions, please do not hesitate to contact us.',
      regards: 'With best regards,', company: 'NILE FLEET', from: 'Sincerely,',
      sign: 'Authorized signature', stamp: 'Company stamp', valid: (d: number) => `This quotation is valid for ${d} days from its date.`,
      routes: 'routes', total: 'Total routes', phones: 'Company phones',
    };

/* ----------------------------- CSV / Excel ----------------------------- */

const headerRow = (o: ExportOptions, withCustomer = true) => {
  const t = L(o.lang);
  return [t.no, ...(withCustomer ? [t.customer] : []), t.load, t.dest, t.transit, ...o.priceKeys.map(k => PRICE_LABELS[k]), ...(o.showNotes ? [t.notes] : [])];
};

const dataRow = (r: Rate, i: number, o: ExportOptions, withCustomer = true) => [
  i + 1, ...(withCustomer ? [r.customer] : []), r.load_port, r.destination, r.transit_port,
  ...o.priceKeys.map(k => r[k] || 0), ...(o.showNotes ? [r.notes] : []),
];

const download = (blob: Blob, name: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

export function exportCsv(rows: Rate[], o: ExportOptions) {
  const lines = [headerRow(o), ...rows.map((r, i) => dataRow(r, i, o))]
    .map(cells => cells.map(c => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  // BOM so Excel opens Arabic text correctly.
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `NileFleet-Transport-${safeName(o.customer || 'ALL')}-${fileStamp()}.csv`);
}

/** Branded workbook laid out like the company's price-history sheet. */
export async function exportExcelBranded(rows: Rate[], o: ExportOptions) {
  const XLSX = await import('xlsx-js-style');
  const t = L(o.lang);
  const head = headerRow(o);
  const width = head.length;
  const title = `NILE FLEET  |  ${o.customer ? t.quote : t.priceList}  |  ${t.date}: ${today()}  |  ${t.customer}: ${o.customer || 'ALL CUSTOMERS'}  |  ${t.phones}: ${COMPANY.phones}`;
  const aoa: any[][] = [
    [title], [],
    [`${o.lang === 'ar' ? COMPANY.nameAr : COMPANY.nameEn}\n${t.greeting}`], [],
    head,
    ...rows.map((r, i) => dataRow(r, i, o)),
    [],
    [t.thanks], [t.regards], [t.company], [`${t.from} ${o.signer}`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastCol = width - 1;
  ws['!merges'] = [0, 2, aoa.length - 4, aoa.length - 3, aoa.length - 2, aoa.length - 1]
    .map(r => ({ s: { r, c: 0 }, e: { r, c: lastCol } }));
  ws['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 6 : /notes|ملاحظات/i.test(String(h)) ? 50 : String(h).length < 8 ? 12 : 26 }));
  ws['!rows'] = [{ hpt: 30 }, {}, { hpt: 42 }];
  if (o.lang === 'ar') (ws as any)['!views'] = [{ RTL: true }];

  const gold = 'C2A378', navy = '07111F';
  const border = { style: 'thin', color: { rgb: 'D8CCB8' } };
  const allBorders = { top: border, bottom: border, left: border, right: border };
  const set = (r: number, c: number, s: any) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = s;
  };
  for (let c = 0; c <= lastCol; c++) {
    set(0, c, { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, fill: { fgColor: { rgb: navy } }, alignment: { horizontal: 'center', vertical: 'center' } });
    set(2, c, { font: { bold: true, color: { rgb: navy }, sz: 11 }, fill: { fgColor: { rgb: 'F6F1E8' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } });
    set(4, c, { font: { bold: true, color: { rgb: navy } }, fill: { fgColor: { rgb: gold } }, alignment: { horizontal: 'center', vertical: 'center' }, border: allBorders });
  }
  rows.forEach((_, i) => {
    for (let c = 0; c <= lastCol; c++) {
      const isPrice = typeof aoa[5 + i][c] === 'number' && c > 0;
      set(5 + i, c, {
        fill: { fgColor: { rgb: i % 2 ? 'FBF8F3' : 'FFFFFF' } },
        alignment: { horizontal: isPrice ? 'center' : (o.lang === 'ar' ? 'right' : 'left'), vertical: 'center', wrapText: true },
        numFmt: isPrice ? '#,##0' : undefined,
        border: allBorders,
      });
    }
  });
  for (let k = 4; k >= 1; k--) set(aoa.length - k, 0, { font: { bold: k <= 2, color: { rgb: navy } }, alignment: { horizontal: 'center' } });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (o.customer || 'ALL CUSTOMERS').slice(0, 28).replace(/[\\/?*[\]:]/g, '-'));
  XLSX.writeFile(wb, `NileFleet-Transport-${safeName(o.customer || 'ALL')}-${fileStamp()}.xlsx`);
}

/** Plain data workbook, one sheet per customer plus an ALL sheet. Re-importable. */
export async function exportExcelData(rows: Rate[], o: ExportOptions) {
  const XLSX = await import('xlsx-js-style');
  const all = { ...o, lang: 'en' as ExportLang, priceKeys: [...PRICE_KEYS], showNotes: true };
  const wb = XLSX.utils.book_new();
  const sheet = (list: Rate[]) => {
    const ws = XLSX.utils.aoa_to_sheet([headerRow(all), ...list.map((r, i) => dataRow(r, i, all))]);
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 22 }, { wch: 26 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 50 }];
    ws['!autofilter'] = { ref: `A1:J${list.length + 1}` };
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, sheet(rows), 'ALL');
  const used = new Set<string>(['ALL']);
  groupByCustomer(rows).forEach(([name, list]) => {
    let n = name.slice(0, 28).replace(/[\\/?*[\]:]/g, '-') || 'Customer';
    while (used.has(n)) n = n.slice(0, 25) + '~' + used.size;
    used.add(n);
    XLSX.utils.book_append_sheet(wb, sheet(list), n);
  });
  XLSX.writeFile(wb, `NileFleet-Transport-Data-${fileStamp()}.xlsx`);
}

export function groupByCustomer(rows: Rate[]): [string, Rate[]][] {
  const m = new Map<string, Rate[]>();
  rows.forEach(r => { const k = r.customer || '—'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));
}

export function whatsappText(rows: Rate[], o: ExportOptions): string {
  const t = L(o.lang);
  const lines: string[] = [`🚚 *NILE FLEET* — ${o.customer ? t.quote : t.priceList}`, `${t.date}: ${today()}`];
  if (o.customer) lines.push(`${t.to} ${o.customer}`);
  lines.push('');
  rows.forEach((r, i) => {
    const prices = o.priceKeys.filter(k => r[k]).map(k => `${PRICE_LABELS[k]}: ${fmt(r[k])}`).join(' | ');
    lines.push(`${i + 1}. ${r.load_port || '—'} ← ${r.destination}${r.transit_port && r.transit_port !== r.load_port ? ` ← ${r.transit_port}` : ''}`);
    if (prices) lines.push(`   ${prices}`);
    if (o.showNotes && r.notes) lines.push(`   📝 ${r.notes}`);
  });
  lines.push('', t.currency, `${t.phones}: ${COMPANY.phones}`, `${t.from} ${o.signer}`);
  return lines.join('\n');
}

/* --------------------------------- PDF --------------------------------- */

function tableHtml(rows: Rate[], o: ExportOptions, withCustomer: boolean) {
  const t = L(o.lang);
  const head = `<tr><th class="n">${t.no}</th>${withCustomer ? `<th>${t.customer}</th>` : ''}<th>${t.load}</th><th>${t.dest}</th><th>${t.transit}</th>${o.priceKeys.map(k => `<th class="p">${PRICE_LABELS[k]}</th>`).join('')}${o.showNotes ? `<th class="notes">${t.notes}</th>` : ''}</tr>`;
  const body = rows.map((r, i) => `<tr><td class="n">${i + 1}</td>${withCustomer ? `<td>${esc(r.customer)}</td>` : ''}<td>${esc(r.load_port) || '—'}</td><td><b>${esc(r.destination)}</b></td><td>${esc(r.transit_port) || '—'}</td>${o.priceKeys.map(k => `<td class="p">${fmt(r[k])}</td>`).join('')}${o.showNotes ? `<td class="notes">${esc(r.notes)}</td>` : ''}</tr>`).join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function buildPdfHtml(rows: Rate[], style: PdfStyle, o: ExportOptions, origin = window.location.origin): string {
  const t = L(o.lang);
  const rtl = o.lang === 'ar';
  const ref = `NF-TR-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(rows.length).padStart(3, '0')}`;
  const title = style === 'quote' ? t.quote : style === 'grouped' ? t.grouped : t.priceList;
  const landscape = style !== 'quote' || o.showNotes || o.priceKeys.length > 3;

  let content = '';
  if (style === 'quote') {
    content = `
      <div class="to"><span>${t.to}</span> <b>${esc(o.customer || '')}</b></div>
      <p class="greet">${t.greeting}</p>
      ${tableHtml(rows, o, false)}
      <p class="small">${t.currency}${o.validDays ? ' · ' + t.valid(o.validDays) : ''}</p>
      <p class="greet">${t.thanks}</p>
      <div class="closing">
        <div class="sig">
          <div class="regards">${t.regards}</div>
          <div class="co">${t.company}</div>
          <div class="who">${t.from} <b>${esc(o.signer)}</b></div>
        </div>
        <div class="boxes">
          <div class="box"><div class="line"></div><span>${t.sign}</span></div>
          <div class="box stamp"><span>${t.stamp}</span></div>
        </div>
      </div>`;
  } else if (style === 'grouped') {
    content = groupByCustomer(rows).map(([name, list]) => `
      <section class="group">
        <h3><span>${esc(name)}</span><small>${list.length} ${t.routes}</small></h3>
        ${tableHtml(list, o, false)}
      </section>`).join('') + `<p class="small">${t.total}: ${rows.length} · ${t.currency}</p>`;
  } else {
    content = `${tableHtml(rows, o, true)}<p class="small">${t.total}: ${rows.length} · ${t.currency}</p>`;
  }

  return `<!doctype html><html lang="${o.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)} - ${esc(o.customer || 'NILE FLEET')}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Sans Arabic", Arial, sans-serif; color: #14202e; font-size: 11px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 3px solid #c2a378; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 58px; }
  .brand h1 { margin: 0; font-size: 22px; letter-spacing: 3px; color: #07111f; font-weight: 900; }
  .brand h1 span { color: #c2a378; }
  .brand p { margin: 2px 0 0; font-size: 10px; color: #5b6878; }
  .meta { text-align: ${rtl ? 'left' : 'right'}; font-size: 10px; color: #3a4757; line-height: 1.6; }
  .meta b { color: #07111f; }
  .title { margin: 14px 0 10px; display: flex; align-items: baseline; justify-content: space-between; }
  .title h2 { margin: 0; font-size: 17px; color: #07111f; }
  .title .pill { background: #07111f; color: #c2a378; padding: 3px 10px; border-radius: 99px; font-size: 9px; letter-spacing: 2px; font-weight: 800; }
  .to { font-size: 13px; margin-bottom: 6px; } .to span { color: #6b7685; }
  .greet { font-size: 11.5px; line-height: 1.8; margin: 6px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #07111f; color: #fff; font-size: 10px; padding: 6px 5px; font-weight: 800; border: 1px solid #07111f; }
  th.p { background: #c2a378; color: #07111f; border-color: #c2a378; }
  td { padding: 5px; border: 1px solid #e3dccf; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #faf7f1; }
  td.p { text-align: center; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.n, th.n { text-align: center; width: 28px; color: #6b7685; }
  .notes { font-size: 9.5px; color: #4b5563; max-width: 260px; }
  .small { font-size: 9.5px; color: #6b7685; margin: 4px 0 10px; }
  .group { page-break-inside: auto; margin-bottom: 14px; }
  .group h3 { margin: 10px 0 4px; font-size: 13px; color: #07111f; display: flex; justify-content: space-between; border-${rtl ? 'right' : 'left'}: 4px solid #c2a378; padding: 2px 8px; background: #f6f1e8; }
  .group h3 small { color: #8a7350; font-size: 10px; }
  .closing { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 18px; page-break-inside: avoid; }
  .sig { line-height: 1.9; font-size: 12px; } .sig .co { font-weight: 900; color: #07111f; }
  .boxes { display: flex; gap: 18px; }
  .box { width: 170px; height: 74px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; font-size: 9.5px; color: #6b7685; }
  .box .line { width: 100%; border-bottom: 1.5px solid #14202e; margin-bottom: 5px; }
  .box.stamp { border: 1.5px dashed #c2a378; border-radius: 50%; width: 92px; height: 92px; justify-content: center; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e3dccf; display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #6b7685; page-break-inside: avoid; }
  .foot .dali { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .foot .dali b { font-size: 8px; letter-spacing: 5px; color: #26231f; }
  .foot .dali img { height: 38px; }
</style></head><body>
  <div class="head">
    <div class="brand"><img src="${origin}/nile-fleet-logo.png" alt="Nile Fleet"><div><h1>NILE <span>FLEET</span></h1><p>${rtl ? COMPANY.nameAr : COMPANY.nameEn}</p></div></div>
    <div class="meta"><div>${t.date}: <b>${today()}</b></div><div>${t.ref}: <b>${ref}</b></div><div dir="ltr">☎ ${COMPANY.phones}</div><div dir="ltr">${COMPANY.email}</div></div>
  </div>
  <div class="title"><h2>${title}</h2><span class="pill">TRANSPORT</span></div>
  ${content}
  <div class="foot">
    <div>${rtl ? COMPANY.nameAr : COMPANY.nameEn} · ${COMPANY.site}</div>
    <div class="dali"><b>NILE FLEET</b><img src="${origin}/dali/dali-studio-on-light.png" alt="Dali Studio"></div>
  </div>
</body></html>`;
}

/** Opens the print dialog (Save as PDF) for the given document, without a pop-up window. */
export function printPdf(rows: Rate[], style: PdfStyle, o: ExportOptions) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(buildPdfHtml(rows, style, o));
  doc.close();
  const go = () => {
    const imgs = Array.from(doc.images);
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })))
      .then(() => {
        frame.contentWindow!.focus();
        frame.contentWindow!.print();
        setTimeout(() => frame.remove(), 60_000);
      });
  };
  setTimeout(go, 50);
}
