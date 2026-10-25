import { RateDraft } from './types';

/**
 * Reads a price sheet in the company's "Price History" layout (title rows,
 * then a header row: no. | Customer | Load port | Destination | Transit port |
 * 1*20 | 2*20 | 40 DC | 40 RF | NOTES) or the system's own data export.
 * Every sheet in the workbook is scanned.
 */
const HEADERS: Record<string, keyof RateDraft> = {
  customer: 'customer', 'العميل': 'customer',
  'load port': 'load_port', 'ميناء التحميل': 'load_port',
  destination: 'destination', 'الوجهة': 'destination',
  'transit port': 'transit_port', 'ميناء العودة': 'transit_port',
  '1*20': 'price_1x20', '1x20': 'price_1x20',
  '2*20': 'price_2x20', '2x20': 'price_2x20',
  '40 dc': 'price_40dc', '40dc': 'price_40dc',
  '40 rf': 'price_40rf', '40rf': 'price_40rf',
  notes: 'notes', 'ملاحظات': 'notes',
};

const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export async function parseRateWorkbook(file: File, fallbackCustomer = ''): Promise<RateDraft[]> {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const out: RateDraft[] = [];
  for (const name of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const headerIndex = rows.findIndex(r => r.some(c => HEADERS[String(c).trim().toLowerCase()] === 'destination'));
    if (headerIndex < 0) continue;
    const map = rows[headerIndex].map(c => HEADERS[String(c).trim().toLowerCase()]);
    for (const r of rows.slice(headerIndex + 1)) {
      const d: any = { customer: '', load_port: '', destination: '', transit_port: '', price_1x20: 0, price_2x20: 0, price_40dc: 0, price_40rf: 0, currency: 'EGP', notes: '', active: true };
      map.forEach((key, i) => {
        if (!key) return;
        d[key] = key.startsWith('price_') ? num(r[i]) : String(r[i] ?? '').trim();
      });
      if (!d.customer) d.customer = fallbackCustomer || (name !== 'ALL' && name !== 'ALL CUSTOMERS' ? name : '');
      if (!d.destination || !d.customer) continue;
      out.push(d as RateDraft);
    }
  }
  return out;
}
