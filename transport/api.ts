import { transportDb } from './transportClient';
import { Rate, RateDraft, TransportRole, TransportUser } from './types';
import type { FuelSettings, FuelTx } from './fuel/math';

const COLUMNS = 'id,customer,load_port,destination,transit_port,price_1x20,price_2x20,price_40dc,price_40rf,currency,notes,active,updated_at';

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalize = (r: any): Rate => ({
  id: r.id,
  customer: r.customer || '',
  load_port: r.load_port || '',
  destination: r.destination || '',
  transit_port: r.transit_port || '',
  price_1x20: toNumber(r.price_1x20),
  price_2x20: toNumber(r.price_2x20),
  price_40dc: toNumber(r.price_40dc),
  price_40rf: toNumber(r.price_40rf),
  currency: r.currency || 'EGP',
  notes: r.notes || '',
  active: r.active !== false,
  updated_at: r.updated_at,
});

const clean = (d: RateDraft) => ({
  customer: d.customer.trim(),
  load_port: d.load_port.trim(),
  destination: d.destination.trim(),
  transit_port: d.transit_port.trim(),
  price_1x20: toNumber(d.price_1x20),
  price_2x20: toNumber(d.price_2x20),
  price_40dc: toNumber(d.price_40dc),
  price_40rf: toNumber(d.price_40rf),
  currency: (d.currency || 'EGP').trim(),
  notes: (d.notes || '').trim(),
  active: d.active !== false,
});

async function resolveUser(): Promise<TransportUser | null> {
  const { data: auth } = await transportDb.auth.getUser();
  const u = auth.user;
  if (!u) return null;
  const { data: role, error } = await transportDb.rpc('my_transport_role');
  if (error || (role !== 'ADMIN' && role !== 'VIEWER')) return null;
  const { data: row } = await transportDb.from('transport_users').select('name').eq('user_id', u.id).maybeSingle();
  return {
    id: u.id,
    email: u.email || '',
    name: row?.name || (u.email || '').split('@')[0],
    role: role as TransportRole,
  };
}

export async function signIn(email: string, password: string): Promise<{ user?: TransportUser; error?: string }> {
  const { error } = await transportDb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: error.message };
  const user = await resolveUser();
  if (!user) {
    await transportDb.auth.signOut();
    return { error: 'NO_ACCESS' };
  }
  return { user };
}

export const currentUser = () => resolveUser().catch(() => null);
export const signOut = () => transportDb.auth.signOut();

export async function loadRates(): Promise<Rate[]> {
  const page = 1000;
  const all: Rate[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await transportDb
      .from('transport_rates')
      .select(COLUMNS)
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    all.push(...(data || []).map(normalize));
    if (!data || data.length < page) break;
  }
  return all;
}

export async function saveRate(d: RateDraft): Promise<Rate> {
  const body = clean(d);
  const q = d.id
    ? transportDb.from('transport_rates').update(body).eq('id', d.id).select(COLUMNS).single()
    : transportDb.from('transport_rates').insert(body).select(COLUMNS).single();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function deleteRates(ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await transportDb.from('transport_rates').delete().in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}

/** Inserts many rows (Excel import). Returns the inserted rows. */
export async function insertRates(rows: RateDraft[], onProgress?: (done: number) => void): Promise<Rate[]> {
  const out: Rate[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await transportDb.from('transport_rates').insert(rows.slice(i, i + 500).map(clean)).select(COLUMNS);
    if (error) throw new Error(error.message);
    out.push(...(data || []).map(normalize));
    onProgress?.(Math.min(i + 500, rows.length));
  }
  return out;
}

/** Updates many existing rows (bulk price change). */
export async function updateRates(rows: Rate[], onProgress?: (done: number) => void): Promise<Rate[]> {
  const out: Rate[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({ id: r.id, ...clean(r) }));
    const { data, error } = await transportDb.from('transport_rates').upsert(chunk, { onConflict: 'id' }).select(COLUMNS);
    if (error) throw new Error(error.message);
    out.push(...(data || []).map(normalize));
    onProgress?.(Math.min(i + 500, rows.length));
  }
  return out;
}

export async function listTransportUsers(): Promise<{ name: string; email: string; role: string }[]> {
  const { data, error } = await transportDb.from('transport_users').select('name,email,role').order('role');
  if (error) return [];
  return data || [];
}

/* ============================== Fuel ============================== */


const FUEL_LOCAL = 'nf_transport_fuel_v1';
const FUEL_SETTINGS_LOCAL = 'nf_transport_fuel_settings_v1';
/** True when the fuel tables are not in the database yet (data then stays in this browser). */
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));

const readLocal = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const writeLocal = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full */ } };

export interface FuelLoad { txs: FuelTx[]; local: boolean }

export async function loadFuel(): Promise<FuelLoad> {
  const page = 1000;
  const all: FuelTx[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await transportDb.from('transport_fuel_tx').select('data').order('at').range(from, from + page - 1);
    if (missingTable(error)) return { txs: readLocal<FuelTx[]>(FUEL_LOCAL, []), local: true };
    if (error) throw new Error(error.message);
    all.push(...(data || []).map(r => r.data as FuelTx));
    if (!data || data.length < page) break;
  }
  return { txs: all, local: false };
}

/** Adds or replaces transactions (same card transaction number = same row). */
export async function saveFuel(txs: FuelTx[], local: boolean): Promise<void> {
  if (local) {
    const m = new Map(readLocal<FuelTx[]>(FUEL_LOCAL, []).map(t => [t.id, t]));
    txs.forEach(t => m.set(t.id, t));
    writeLocal(FUEL_LOCAL, [...m.values()]);
    return;
  }
  for (let i = 0; i < txs.length; i += 500) {
    const rows = txs.slice(i, i + 500).map(t => ({ id: t.id, at: t.at, plate: t.plate, data: t }));
    const { error } = await transportDb.from('transport_fuel_tx').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
}

export async function deleteFuel(ids: string[], local: boolean): Promise<void> {
  if (local) {
    const gone = new Set(ids);
    writeLocal(FUEL_LOCAL, readLocal<FuelTx[]>(FUEL_LOCAL, []).filter(t => !gone.has(t.id)));
    return;
  }
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await transportDb.from('transport_fuel_tx').delete().in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}

export async function loadFuelSettings(): Promise<Partial<FuelSettings>> {
  const { data, error } = await transportDb.from('transport_settings').select('value').eq('key', 'fuel').maybeSingle();
  if (error || !data) return readLocal<Partial<FuelSettings>>(FUEL_SETTINGS_LOCAL, {});
  return data.value as Partial<FuelSettings>;
}

export async function saveFuelSettings(s: FuelSettings): Promise<void> {
  writeLocal(FUEL_SETTINGS_LOCAL, s);
  const { error } = await transportDb.from('transport_settings').upsert({ key: 'fuel', value: s }, { onConflict: 'key' });
  if (error && !missingTable(error)) throw new Error(error.message);
}
