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
  /** Extra terms printed under the prices (one rule per entry). */
  terms?: string[];
}

export const COMPANY = {
  nameEn: 'NILE FLEET for Transport and Logistics Service',
  nameAr: 'شركة أسطول النيل لخدمات النقل واللوجستيات',
  phones: '01000992858 / 01000044560',
  email: 'nilefleet@nilefleetlogistics.com',
  site: 'nilefleetlogistics.com',
};

export const DEFAULT_SIGNER = 'سمر حجازي';

/** Standard transport terms (demurrage, Goda yard pickup, diesel price). Editable in the export window. */
export const DEFAULT_TERMS: Record<ExportLang, string[]> = {
  ar: [
    'يتم حساب بياتة رقم 1 بقيمة 3,000 جنيه إذا تأخرت الحاوية من 10 إلى 12 ساعة عند العميل، تُحسب من وقت وصولها للعميل.',
    'يتم حساب بياتة رقم 2 بقيمة 6,000 جنيه إذا تأخرت الحاوية من 12 ساعة إلى 24 ساعة.',
    'يتم حساب بياتة رقم 3 بقيمة نصف نولون إذا تأخرت الحاوية من 24 ساعة إلى 48 ساعة.',
    'في حالة السحب من ساحة جودة يتم إضافة الإيصال على الفاتورة.',
    'في حالة تغيير سعر لتر السولار سيتم تغيير النولون بنسبة تتفق مع الزيادة.',
  ],
  en: [
    'Overnight charge no. 1: EGP 3,000 if the container is held at the customer for 10 to 12 hours, counted from its arrival at the customer.',
    'Overnight charge no. 2: EGP 6,000 if the container is held from 12 to 24 hours.',
    'Overnight charge no. 3: half the freight rate if the container is held from 24 to 48 hours.',
    'For pickups from the Goda yard, the yard receipt is added to the invoice.',
    'If the price of a litre of diesel changes, the freight rate changes in proportion to the increase.',
  ],
};

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
    ...(o.terms || []).filter(x => x.trim()).map((x, i) => [`${i + 1}. ${x.trim()}`]),
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
  lines.push('', t.currency);
  (o.terms || []).filter(x => x.trim()).forEach((x, i) => lines.push(`${i + 1}. ${x.trim()}`));
  lines.push('', `${t.phones}: ${COMPANY.phones}`, `${t.from} ${o.signer}`);
  return lines.join('\n');
}

/* --------------------------------- PDF --------------------------------- */

// One colour per container type, used on headers, price cells and chips.
const PRICE_COLORS: Record<PriceKey, { bg: string; ink: string; tint: string }> = {
  price_1x20: { bg: '#0f766e', ink: '#ffffff', tint: '#ecf8f6' },
  price_2x20: { bg: '#1d4ed8', ink: '#ffffff', tint: '#eef3fe' },
  price_40dc: { bg: '#c2a378', ink: '#07111f', tint: '#fbf5ea' },
  price_40rf: { bg: '#0284c7', ink: '#ffffff', tint: '#ebf6fc' },
};

function tableHtml(rows: Rate[], o: ExportOptions, withCustomer: boolean, groupByPort = false) {
  const t = L(o.lang);
  const cols = 4 + (withCustomer ? 1 : 0) + o.priceKeys.length + (o.showNotes ? 1 : 0);
  const head = `<tr><th class="n">${t.no}</th>${withCustomer ? `<th>${t.customer}</th>` : ''}<th>${t.load}</th><th>${t.dest}</th><th>${t.transit}</th>${o.priceKeys.map(k => `<th class="p" style="background:${PRICE_COLORS[k].bg};color:${PRICE_COLORS[k].ink}"><span dir="ltr">${PRICE_LABELS[k]}</span></th>`).join('')}${o.showNotes ? `<th class="notes">${t.notes}</th>` : ''}</tr>`;
  let lastPort: string | null = null;
  let n = 0;
  const body = rows.map(r => {
    let group = '';
    if (groupByPort && r.load_port !== lastPort) {
      lastPort = r.load_port;
      const count = rows.filter(x => x.load_port === r.load_port).length;
      group = `<tr class="grp"><td colspan="${cols}"><span class="dot"></span>${t.load}: <b>${esc(r.load_port) || '—'}</b><small>${count} ${t.routes}</small></td></tr>`;
    }
    n++;
    return `${group}<tr><td class="n">${n}</td>${withCustomer ? `<td>${esc(r.customer)}</td>` : ''}<td class="port">${esc(r.load_port) || '—'}</td><td class="dest">${esc(r.destination)}</td><td class="port">${esc(r.transit_port) || '—'}</td>${o.priceKeys.map(k => `<td class="p" style="background:${r[k] ? PRICE_COLORS[k].tint : 'transparent'}">${r[k] ? `${fmt(r[k])}` : '<span class="na">—</span>'}</td>`).join('')}${o.showNotes ? `<td class="notes">${esc(r.notes)}</td>` : ''}</tr>`;
  }).join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

const addDays = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export function buildPdfHtml(rows: Rate[], style: PdfStyle, o: ExportOptions, origin = window.location.origin): string {
  const t = L(o.lang);
  const rtl = o.lang === 'ar';
  const ref = `NF-TR-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(rows.length).padStart(3, '0')}`;
  const title = style === 'quote' ? t.quote : style === 'grouped' ? t.grouped : t.priceList;
  const landscape = style !== 'quote' || o.showNotes || o.priceKeys.length > 3;
  const ports = new Set(rows.map(r => r.load_port).filter(Boolean)).size;
  const dests = new Set(rows.map(r => r.destination)).size;
  const x = rtl
    ? { preparedFor: 'مقدم إلى', details: 'بيانات العرض', contact: 'للتواصل', validUntil: 'ساري حتى', allCustomers: 'كل العملاء', terms: 'الشروط', dests: 'وجهة', ports: 'ميناء تحميل', containers: 'أنواع الحاويات' }
    : { preparedFor: 'Prepared for', details: 'Quotation details', contact: 'Contact', validUntil: 'Valid until', allCustomers: 'All customers', terms: 'Terms', dests: 'destinations', ports: 'load ports', containers: 'Containers' };
  const termItems = [t.currency, ...(style === 'quote' && o.validDays ? [t.valid(o.validDays)] : []), ...(o.terms || []).map(x => x.trim()).filter(Boolean)];
  const termsHtml = `<div class="terms"><b>${x.terms}</b><ol>${termItems.map(i => `<li>${esc(i)}</li>`).join('')}</ol></div>`;
  const sortedRows = style === 'quote' ? [...rows].sort((a, b) => a.load_port.localeCompare(b.load_port, 'ar')) : rows;

  const chips = `
    <div class="chips">
      <div class="chip"><b>${rows.length}</b><span>${t.routes}</span></div>
      <div class="chip"><b>${dests}</b><span>${x.dests}</span></div>
      <div class="chip"><b>${ports}</b><span>${x.ports}</span></div>
      <div class="chip types"><span>${x.containers}</span>${o.priceKeys.map(k => `<i style="background:${PRICE_COLORS[k].bg};color:${PRICE_COLORS[k].ink}" dir="ltr">${PRICE_LABELS[k]}</i>`).join('')}</div>
    </div>`;

  const cards = `
    <div class="cards">
      <div class="card accent"><small>${x.preparedFor}</small><strong>${esc(o.customer || x.allCustomers)}</strong></div>
      <div class="card"><small>${x.details}</small>
        <div class="kv"><span>${t.ref}</span><b dir="ltr">${ref}</b></div>
        <div class="kv"><span>${t.date}</span><b dir="ltr">${today()}</b></div>
        ${style === 'quote' && o.validDays ? `<div class="kv"><span>${x.validUntil}</span><b dir="ltr">${addDays(o.validDays)}</b></div>` : ''}
      </div>
      <div class="card"><small>${x.contact}</small>
        <div class="kv"><span>☎</span><b dir="ltr">${COMPANY.phones}</b></div>
        <div class="kv"><span>✉</span><b dir="ltr">${COMPANY.email}</b></div>
        <div class="kv"><span>⌂</span><b dir="ltr">${COMPANY.site}</b></div>
      </div>
    </div>`;

  let content = '';
  if (style === 'quote') {
    content = `
      ${cards}
      <p class="greet">${t.greeting}</p>
      ${chips}
      ${tableHtml(sortedRows, o, false, true)}
      ${termsHtml}
      <p class="greet">${t.thanks}</p>
      <div class="closing">
        <div class="sig">
          <div class="regards">${t.regards}</div>
          <div class="co">${t.company}</div>
        </div>
        <div class="signer">
          <div class="from">${t.from}</div>
          <div class="name">${esc(o.signer)}</div>
          <div class="line"></div>
          <span>${t.sign}</span>
        </div>
        <div class="box stamp"><img src="${origin}/nf-mark-navy.png" alt=""><span>${t.stamp}</span></div>
      </div>`;
  } else if (style === 'grouped') {
    content = cards + chips + groupByCustomer(rows).map(([name, list]) => `
      <section class="group">
        <h3><span>${esc(name)}</span><small>${list.length} ${t.routes}</small></h3>
        ${tableHtml(list, o, false)}
      </section>`).join('') + `<p class="small">${t.total}: ${rows.length}</p>` + termsHtml;
  } else {
    content = `${cards}${chips}${tableHtml(rows, o, true)}<p class="small">${t.total}: ${rows.length}</p>${termsHtml}`;
  }

  const start = rtl ? 'right' : 'left';
  return `<!doctype html><html lang="${o.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)} - ${esc(o.customer || 'NILE FLEET')}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm 10mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { padding: 18px 22px; background: #fff; } }
  body { margin: 0; font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Sans Arabic", Arial, sans-serif; color: #14202e; font-size: 11px; }
  .wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .wm img { width: 62%; opacity: .045; }
  .page { position: relative; z-index: 1; }
  .band { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 22px; border-radius: 14px; background: linear-gradient(120deg, #07111f 0%, #0d2440 62%, #13345a 100%); color: #fff; }
  .band::after { content: ""; position: absolute; inset: auto 0 0 0; height: 5px; background: linear-gradient(90deg, #c2a378, #e8d3ad, #c2a378); }
  .band .ghost { position: absolute; ${rtl ? 'left' : 'right'}: -30px; top: -40px; height: 190px; opacity: .07; }
  .brand { display: flex; align-items: center; gap: 14px; position: relative; }
  .brand img { height: 54px; }
  .brand h1 { margin: 0; font-size: 24px; letter-spacing: 4px; font-weight: 900; font-style: italic; }
  .brand h1 span { color: #c2a378; }
  .brand p { margin: 3px 0 0; font-size: 10px; color: #b8c4d4; }
  .doc { text-align: ${rtl ? 'left' : 'right'}; position: relative; }
  .doc .kind { font-size: 9px; letter-spacing: 4px; color: #c2a378; font-weight: 800; }
  .doc h2 { margin: 4px 0 0; font-size: 22px; font-weight: 900; }
  .cards { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin: 14px 0 10px; }
  .card { border: 1px solid #e6dfd2; border-radius: 12px; padding: 10px 12px; background: #fff; }
  .card small { display: block; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #8a7350; font-weight: 800; margin-bottom: 6px; }
  .card strong { font-size: 16px; color: #07111f; line-height: 1.35; }
  .card.accent { background: linear-gradient(135deg, #fbf5ea, #f3e7d2); border-color: #e3cfae; border-${start}: 5px solid #c2a378; }
  .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; line-height: 1.75; color: #5b6878; }
  .kv b { color: #07111f; }
  .greet { font-size: 11.5px; line-height: 1.8; margin: 8px 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 10px; }
  .chip { display: flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 99px; background: #07111f; color: #fff; font-size: 10px; }
  .chip b { color: #c2a378; font-size: 12px; }
  .chip.types { background: #f4f1ea; color: #3a4757; }
  .chip.types i { font-style: normal; font-weight: 800; padding: 2px 7px; border-radius: 99px; font-size: 9px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 4px 0 8px; border: 1px solid #e3dccf; border-radius: 10px; overflow: hidden; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #07111f; color: #fff; font-size: 10px; padding: 8px 6px; font-weight: 800; text-align: ${start}; }
  th.p { text-align: center; min-width: 64px; }
  td { padding: 6px; border-top: 1px solid #efe9de; vertical-align: middle; }
  tbody tr:nth-child(even) td:not(.p) { background: #fcfaf6; }
  td.dest { font-weight: 800; color: #07111f; }
  td.port { color: #5b6878; font-size: 10px; }
  td.p { text-align: center; font-weight: 900; white-space: nowrap; font-variant-numeric: tabular-nums; color: #07111f; font-size: 11.5px; }
  .na { color: #c9ced6; font-weight: 400; }
  td.n, th.n { text-align: center; width: 30px; color: #8a96a6; }
  tr.grp td { background: #0d2440 !important; color: #fff; font-size: 10.5px; padding: 6px 10px; border-top: 0; }
  tr.grp b { color: #e8d3ad; }
  tr.grp small { float: ${rtl ? 'left' : 'right'}; color: #b8c4d4; }
  tr.grp .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #c2a378; margin-${rtl ? 'left' : 'right'}: 7px; }
  .notes { font-size: 9.5px; color: #4b5563; max-width: 260px; }
  .small { font-size: 9.5px; color: #6b7685; margin: 4px 0 10px; }
  .terms { margin: 10px 0; padding: 9px 14px; border-radius: 10px; background: #f4f8fc; border-${start}: 4px solid #0d2440; font-size: 10.5px; }
  .terms ol { margin: 4px 0 0; padding-${start}: 20px; color: #3a4757; line-height: 1.75; }
  .terms li::marker { color: #8a7350; font-weight: 800; }
  .terms { page-break-inside: avoid; }
  .group { page-break-inside: auto; margin-bottom: 14px; }
  .group h3 { margin: 12px 0 5px; font-size: 13px; color: #fff; display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 9px; background: linear-gradient(90deg, #07111f, #13345a); border-${start}: 5px solid #c2a378; }
  .group h3 small { color: #e8d3ad; font-size: 10px; }
  .closing { display: grid; grid-template-columns: 1fr 1.1fr auto; align-items: end; gap: 22px; margin-top: 14px; padding: 14px 18px; border-radius: 12px; border: 1px solid #e6dfd2; background: #fffdf9; page-break-inside: avoid; }
  .sig { line-height: 1.9; font-size: 12px; align-self: center; } .sig .co { font-weight: 900; color: #07111f; font-size: 14px; }
  .signer { text-align: center; font-size: 9.5px; color: #6b7685; }
  .signer .from { font-size: 10.5px; color: #5b6878; }
  .signer .name { font-size: 15px; font-weight: 900; color: #8a7350; margin: 2px 0 26px; }
  .signer .line { border-bottom: 1.5px solid #0d2440; margin-bottom: 5px; }
  .box.stamp { position: relative; display: flex; align-items: center; justify-content: center; border: 2px dashed #c2a378; border-radius: 50%; width: 96px; height: 96px; font-size: 9.5px; color: #6b7685; }
  .box.stamp img { position: absolute; width: 54px; opacity: .12; }
  .box.stamp span { position: relative; }
  .foot { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-radius: 12px; background: #07111f; color: #b8c4d4; font-size: 9.5px; page-break-inside: avoid; border-top: 4px solid #c2a378; }
  .foot .co { color: #fff; font-weight: 800; }
  .foot .dali { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .foot .dali b { font-size: 7.5px; letter-spacing: 5px; color: #fff; }
  .foot .dali img { height: 36px; }
</style></head><body>
  <div class="wm"><img src="${origin}/nf-mark-navy.png" alt=""></div>
  <div class="page">
  <div class="band">
    <img class="ghost" src="${origin}/nf-mark-white.png" alt="">
    <div class="brand"><img src="${origin}/nf-mark-white.png" alt="Nile Fleet"><div><h1>NILE <span>FLEET</span></h1><p>${rtl ? COMPANY.nameAr : COMPANY.nameEn}</p></div></div>
    <div class="doc"><div class="kind">TRANSPORT · ${style === 'quote' ? 'QUOTATION' : 'PRICE LIST'}</div><h2>${title}</h2></div>
  </div>
  ${content}
  <div class="foot">
    <div><div class="co">${rtl ? COMPANY.nameAr : COMPANY.nameEn}</div><div dir="ltr">${COMPANY.site} · ${COMPANY.email} · ☎ ${COMPANY.phones}</div></div>
    <div class="dali"><b>NILE FLEET</b><img src="${origin}/dali/dali-studio-on-dark.png" alt="Dali Studio"></div>
  </div>
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
