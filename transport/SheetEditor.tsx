import React, { useMemo, useRef, useState } from 'react';
import DaliLoader from '../components/DaliLoader';
import * as api from './api';
import { Strings } from './i18n';
import { PRICE_KEYS, PRICE_LABELS, Rate, RateDraft, emptyDraft } from './types';

/**
 * Spreadsheet-style editor: every rate of a customer (or of the current list)
 * in one grid. Cells are edited in place, Excel ranges can be pasted, rows can
 * be added or marked for deletion, and one Save writes all changes.
 */

type Col = 'customer' | 'load_port' | 'destination' | 'transit_port' | typeof PRICE_KEYS[number] | 'notes';
type Row = RateDraft & { key: string; removed?: boolean };

export interface SheetResult { updated: Rate[]; added: Rate[]; deleted: number[] }

const isPrice = (c: Col) => c.startsWith('price_');
const toNum = (v: string) => { const n = Number(String(v).replace(/[, ]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };

const SheetEditor: React.FC<{
  t: Strings; rows: Rate[]; customer?: string; options: { customers: string[]; ports: string[]; dests: string[] };
  onClose: () => void; onDone: (r: SheetResult) => void;
}> = ({ t, rows, customer, options, onClose, onDone }) => {
  const original = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const [data, setData] = useState<Row[]>(() => rows.map(r => ({ ...r, key: `r${r.id}` })));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const seq = useRef(0);
  const gridRef = useRef<HTMLTableSectionElement>(null);

  const cols: Col[] = [...(customer ? [] : ['customer' as Col]), 'load_port', 'destination', 'transit_port', ...PRICE_KEYS, 'notes'];
  const label = (c: Col) => isPrice(c) ? PRICE_LABELS[c as typeof PRICE_KEYS[number]] : t[({ customer: 'customer', load_port: 'loadPort', destination: 'destination', transit_port: 'transitPort', notes: 'notes' } as const)[c as 'customer']];

  const changedCell = (r: Row, c: Col) => {
    if (!r.id) return true;
    const o = original.get(r.id);
    return !!o && String(o[c] ?? '') !== String(r[c] ?? '');
  };
  const isDirty = (r: Row) => !r.id || r.removed || cols.some(c => changedCell(r, c));
  const dirty = data.filter(isDirty);
  const counts = {
    edited: dirty.filter(r => r.id && !r.removed).length,
    added: dirty.filter(r => !r.id && !r.removed && r.destination.trim()).length,
    removed: dirty.filter(r => r.id && r.removed).length,
  };
  const total = counts.edited + counts.added + counts.removed;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.map((r, i) => ({ r, i })).filter(({ r }) => !s || !r.id || `${r.customer} ${r.load_port} ${r.destination} ${r.transit_port} ${r.notes}`.toLowerCase().includes(s));
  }, [data, q]);

  const setCell = (i: number, c: Col, v: string) => setData(d => d.map((r, j) => j === i ? { ...r, [c]: isPrice(c) ? toNum(v) : v } : r));
  const newRow = (base?: Partial<RateDraft>): Row => ({ ...emptyDraft(), customer: customer || '', ...base, id: undefined, key: `n${++seq.current}` });
  const addRow = () => {
    const last = data[data.length - 1];
    setData(d => [...d, newRow({ customer: customer || last?.customer || '', load_port: last?.load_port || '', transit_port: last?.transit_port || '' })]);
    setQ('');
    setTimeout(() => { const el = gridRef.current?.querySelector<HTMLInputElement>('tr:last-child input[data-col="destination"]'); el?.focus(); el?.scrollIntoView({ block: 'center' }); }, 30);
  };
  const toggleRemove = (i: number) => setData(d => d[i].id ? d.map((r, j) => j === i ? { ...r, removed: !r.removed } : r) : d.filter((_, j) => j !== i));

  // Paste a block copied from Excel: fills right and down from the cell, adding rows when needed.
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number, c: Col) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const start = cols.indexOf(c);
    setData(d => {
      const next = [...d];
      lines.forEach((cells, k) => {
        const at = i + k;
        if (!next[at]) next[at] = newRow();
        const row = { ...next[at] } as any;
        cells.forEach((v, n) => { const col = cols[start + n]; if (col) row[col] = isPrice(col) ? toNum(v) : v.trim(); });
        next[at] = row;
      });
      return next;
    });
  };

  // Enter / arrow keys move between rows like a spreadsheet.
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const down = e.key === 'Enter' || e.key === 'ArrowDown';
    if (!down && e.key !== 'ArrowUp') return;
    const cell = e.currentTarget;
    const tr = cell.closest('tr');
    const target = (down ? tr?.nextElementSibling : tr?.previousElementSibling)?.querySelector<HTMLInputElement>(`input[data-col="${cell.dataset.col}"]`);
    if (target) { e.preventDefault(); target.focus(); target.select(); }
  };

  const fillDown = (c: Col) => {
    const first = shown.find(({ r }) => !r.removed)?.r;
    if (!first) return;
    const v = first[c];
    const idx = new Set(shown.map(s => s.i));
    setData(d => d.map((r, j) => idx.has(j) && !r.removed ? { ...r, [c]: v } : r));
  };

  const save = async () => {
    const bad = dirty.find(r => !r.removed && (r.id || r.destination.trim() || PRICE_KEYS.some(k => r[k])) && (!r.customer.trim() || !r.destination.trim()));
    if (bad) { setErr(t.required); return; }
    setErr(''); setBusy('save');
    try {
      const strip = ({ key, removed, ...r }: Row) => r;
      const edited = dirty.filter(r => r.id && !r.removed).map(r => strip(r) as Rate);
      const fresh = dirty.filter(r => !r.id && !r.removed && r.destination.trim()).map(strip);
      const gone = dirty.filter(r => r.id && r.removed).map(r => r.id!);
      const updated = edited.length ? await api.updateRates(edited) : [];
      const added = fresh.length ? await api.insertRates(fresh) : [];
      if (gone.length) await api.deleteRates(gone);
      onDone({ updated, added, deleted: gone });
    } catch (e: any) { setErr(`${t.failed}: ${e.message}`); setBusy(''); }
  };

  const close = () => { if (!total || window.confirm(t.sheetDiscard)) onClose(); };
  const cellCls = 'h-9 w-full border-0 bg-transparent px-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#c2a378]';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f6f1e8]" role="dialog" aria-modal="true" aria-label={t.sheetTitle}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#07111f] px-4 py-3 text-white sm:px-6">
        <div className="me-auto">
          <div className="text-[10px] font-black uppercase tracking-[.3em] text-[#c2a378]">{t.sheetTitle}</div>
          <div className="text-lg font-black">{customer || t.sheetAll(rows.length)}</div>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.sheetSearch}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-[#c2a378] sm:w-64" />
        <div className="text-xs font-bold text-white/70">
          {total ? t.sheetChanges(counts.edited, counts.added, counts.removed) : t.sheetNoChanges}
        </div>
        {busy && <DaliLoader size={20} />}
        <button onClick={close} className="rounded-xl border border-white/25 px-4 py-2 text-xs font-black">{t.cancel}</button>
        <button onClick={save} disabled={!total || !!busy} className="rounded-xl bg-[#c2a378] px-5 py-2 text-xs font-black text-[#07111f] disabled:opacity-40">✓ {t.sheetSave}</button>
      </div>
      {err && <div role="alert" className="bg-red-50 px-6 py-2 text-sm font-bold text-red-800">{err}</div>}
      <div className="px-4 py-2 text-[11px] font-bold text-slate-500 sm:px-6">{t.sheetHint}</div>

      <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6">
        <table className="w-full min-w-[1000px] border-separate border-spacing-0 rounded-2xl border border-[#e3dccf] bg-white text-sm">
          <thead className="sticky top-0 z-10 bg-[#07111f] text-[11px] text-white">
            <tr>
              <th className="w-10 px-2 py-2.5">#</th>
              {cols.map(c => (
                <th key={c} className={`px-2 py-2.5 text-start font-black uppercase tracking-wider ${isPrice(c) ? 'w-28' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    {isPrice(c) ? <span dir="ltr" className="text-[#c2a378]">{label(c)}</span> : <span>{label(c)}</span>}
                    {!isPrice(c) && c !== 'notes' && <button type="button" onClick={() => fillDown(c)} title={t.sheetFill} className="text-[10px] font-bold text-white/50 hover:text-[#c2a378]">⇣</button>}
                  </div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody ref={gridRef}>
            {/* selected-row opts these rows out of the site-wide !important cell background in index.html */}
            {shown.map(({ r, i }, n) => (
              <tr key={r.key} className={`selected-row ${r.removed ? 'bg-red-50 opacity-60 [&_input]:line-through' : !r.id ? 'bg-emerald-50' : n % 2 ? 'bg-[#fbf8f2]' : 'bg-white'}`}>
                <td className="border-b border-[#efe8dc] px-2 text-center text-[11px] font-bold text-slate-400">{r.id ? n + 1 : '＋'}</td>
                {cols.map(c => (
                  <td key={c} className={`border-b border-s border-[#efe8dc] p-0 ${changedCell(r, c) && r.id ? 'bg-amber-100' : ''}`}>
                    <input
                      data-col={c}
                      value={isPrice(c) ? (r[c] ? String(r[c]) : '') : String(r[c] ?? '')}
                      onChange={e => setCell(i, c, e.target.value)}
                      onPaste={e => onPaste(e, i, c)}
                      onKeyDown={onKey}
                      onFocus={e => e.currentTarget.select()}
                      disabled={r.removed}
                      inputMode={isPrice(c) ? 'numeric' : undefined}
                      dir={isPrice(c) ? 'ltr' : undefined}
                      list={c === 'customer' ? 'nf-sheet-customers' : c === 'load_port' || c === 'transit_port' ? 'nf-sheet-ports' : c === 'destination' ? 'nf-sheet-dests' : undefined}
                      placeholder={isPrice(c) ? '—' : ''}
                      className={`${cellCls} ${isPrice(c) ? 'text-end font-black tabular-nums' : ''}`}
                      style={{ minHeight: 0 }}
                    />
                  </td>
                ))}
                <td className="border-b border-s border-[#efe8dc] text-center">
                  <button type="button" onClick={() => toggleRemove(i)} title={r.removed ? t.sheetRestore : t.del} style={{ minHeight: 0 }}
                    className={`h-8 w-8 rounded-lg text-sm font-black ${r.removed ? 'text-emerald-700' : 'text-red-400 hover:bg-red-50 hover:text-red-600'}`}>{r.removed ? '↺' : '×'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="mt-3 rounded-xl border border-dashed border-[#c2a378] bg-white px-4 py-2 text-xs font-black text-[#8a7350] hover:bg-[#fbf3e4]">＋ {t.sheetAddRow}</button>
      </div>

      <datalist id="nf-sheet-customers">{options.customers.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="nf-sheet-ports">{options.ports.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="nf-sheet-dests">{options.dests.map(x => <option key={x} value={x} />)}</datalist>
    </div>
  );
};

export default SheetEditor;
