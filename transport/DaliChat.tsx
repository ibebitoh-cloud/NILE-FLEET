import React, { useEffect, useRef, useState } from 'react';
import * as api from './api';
import * as dali from './dali';
import { Lang } from './i18n';
import { PRICE_KEYS, PRICE_LABELS, PriceKey, Rate, RateDraft, TransportUser, emptyDraft } from './types';

const DALI_MARK = '/dali/dali-mark.png';

const TX = {
  en: {
    title: 'DALI', sub: 'Transport assistant', placeholder: 'Ask about prices, or tell DALI what to change…', send: 'Send', newChat: 'New chat',
    hello: (n: string) => `Hi ${n}. I know the whole price list, every customer and the quotation rules. Ask me a price, compare customers, write a quote message, or tell me what to change.`,
    thinking: 'DALI is thinking…', confirm: 'Confirm', cancel: 'Cancel', done: 'Done. Saved.', cancelled: 'Cancelled. Nothing was changed.',
    adminOnly: 'Only an admin can change prices. Your account is read only.', failed: 'Something went wrong', rowsUsed: (n: number) => `${n} price rows used`,
    notFound: 'I could not find a matching route. Name the customer and destination as they appear in the price list.',
    tooMany: (n: number) => `That matches ${n} routes. Name the customer, load port or destination so I change the right ones.`,
    needTarget: 'Tell me which customer, port or destination to change.',
    opened: (c: string) => `Opening the quotation for ${c}.`, showing: 'Here they are in the price list.',
    plan: { set_price: 'Change price', add_rate: 'Add route', adjust_prices: 'Adjust prices', delete_rate: 'Delete route', rename_customer: 'Rename customer' } as Record<string, string>,
    more: (n: number) => `+ ${n} more`,
    tries: ['Price for Insta Freight to Damietta?', 'Which customers have 40 RF to the 10th of Ramadan?', 'Raise Sea Sky prices 5%', 'Make a quotation for Royal Med'],
  },
  ar: {
    title: 'دالي', sub: 'مساعد النقل', placeholder: 'اسأل عن الأسعار، أو قول لدالي يغير إيه…', send: 'إرسال', newChat: 'محادثة جديدة',
    hello: (n: string) => `أهلاً ${n}. أنا عارف قائمة الأسعار كلها وكل العملاء وشروط عروض الأسعار. اسألني عن سعر، قارن بين العملاء، اكتب رسالة عرض سعر، أو قولي أغير إيه.`,
    thinking: 'دالي بيفكر…', confirm: 'تأكيد', cancel: 'إلغاء', done: 'تم الحفظ.', cancelled: 'تم الإلغاء. مفيش حاجة اتغيرت.',
    adminOnly: 'تعديل الأسعار للمسؤول فقط. حسابك عرض فقط.', failed: 'حصلت مشكلة', rowsUsed: (n: number) => `استخدمت ${n} سطر أسعار`,
    notFound: 'مش لاقي خط مطابق. اكتب اسم العميل والوجهة زي ما هما في قائمة الأسعار.',
    tooMany: (n: number) => `الطلب ده بيطابق ${n} خط. حدد العميل أو ميناء التحميل أو الوجهة عشان أغير الصح.`,
    needTarget: 'قولي أغير أسعار أنهي عميل أو ميناء أو وجهة.',
    opened: (c: string) => `بفتح عرض الأسعار لـ ${c}.`, showing: 'دي النتائج في قائمة الأسعار.',
    plan: { set_price: 'تغيير سعر', add_rate: 'إضافة خط', adjust_prices: 'تعديل أسعار', delete_rate: 'حذف خط', rename_customer: 'تغيير اسم عميل' } as Record<string, string>,
    more: (n: number) => `+ ${n} كمان`,
    tries: ['سعر انستا فريت لدمياط كام؟', 'مين عنده 40 ريفر للعاشر من رمضان؟', 'زود أسعار سي سكاي 5%', 'اعمل بيان سعر لرويال ميد'],
  },
};

type Change = { before: Rate; after: Rate };
type Plan = { kind: string; title: string; changes: Change[]; add?: RateDraft; deleteIds?: number[] };
type Msg = { id: number; role: 'user' | 'assistant'; content: string; rows?: number; plan?: Plan; state?: 'pending' | 'done' | 'cancelled' | 'error' };

const money = (n: number) => (n ? n.toLocaleString('en-US') : '—');
const round50 = (n: number) => Math.max(0, Math.round(n / 50) * 50);

function buildPlan(a: dali.DaliAction, rates: Rate[], tx: typeof TX.en): Plan | string {
  const title = tx.plan[a.type] || a.type;
  if (a.type === 'add_rate') {
    if (!a.customer?.trim() || !a.destination?.trim()) return tx.notFound;
    const d: RateDraft = { ...emptyDraft(), customer: dali.bestCustomer(rates, a.customer) || a.customer.trim(), load_port: a.loadPort || '', destination: a.destination.trim(), transit_port: a.transitPort || a.loadPort || '', notes: a.notes || '' };
    Object.entries(a.prices || {}).forEach(([k, v]) => { const key = dali.CONTAINER_KEY[k]; if (key) d[key] = Number(v) || 0; });
    return { kind: a.type, title, changes: [], add: d };
  }
  if (a.type === 'rename_customer') {
    const c = dali.bestCustomer(rates, a.customer);
    if (!c || !a.newName?.trim()) return tx.notFound;
    return { kind: a.type, title, changes: rates.filter(r => r.customer === c).map(r => ({ before: r, after: { ...r, customer: a.newName.trim() } })) };
  }
  if (a.type !== 'set_price' && a.type !== 'adjust_prices' && a.type !== 'delete_rate') return tx.notFound;
  if (!a.customer && !a.destination && !a.loadPort) return tx.needTarget;
  const rows = dali.findRows(rates, a);
  if (!rows.length) return tx.notFound;
  const cap = a.type === 'adjust_prices' ? 600 : 25;
  if (rows.length > cap) return tx.tooMany(rows.length);
  if (a.type === 'delete_rate') return { kind: a.type, title, changes: rows.map(r => ({ before: r, after: r })), deleteIds: rows.map(r => r.id) };
  if (a.type === 'set_price') {
    const key = dali.CONTAINER_KEY[a.container];
    if (!key || !(Number(a.price) >= 0)) return tx.notFound;
    return { kind: a.type, title, changes: rows.map(r => ({ before: r, after: { ...r, [key]: Number(a.price) } })) };
  }
  const keys: PriceKey[] = a.containers?.length ? a.containers.map(c => dali.CONTAINER_KEY[c]).filter(Boolean) : [...PRICE_KEYS];
  const v = Number(a.value) || 0;
  if (!v) return tx.needTarget;
  const changes = rows.map(r => {
    const after = { ...r };
    keys.forEach(k => { if (r[k]) after[k] = round50(a.mode === 'amount' ? r[k] + v : r[k] * (1 + v / 100)); });
    return { before: r, after };
  }).filter(c => keys.some(k => c.after[k] !== c.before[k]));
  if (!changes.length) return tx.notFound;
  return { kind: a.type, title: `${title} \u2066${v > 0 ? '+' : ''}${v}${a.mode === 'amount' ? ' EGP' : '%'}\u2069`, changes };
}

const PlanCard: React.FC<{ plan: Plan; tx: typeof TX.en; state?: Msg['state']; onConfirm: () => void; onCancel: () => void }> = ({ plan, tx, state, onConfirm, onCancel }) => {
  const shown = plan.changes.slice(0, 10);
  const diff = (c: Change) => PRICE_KEYS.filter(k => c.before[k] !== c.after[k]);
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-[#c2a378]/60 bg-[#fffaf0] text-[12px]">
      <div className="flex items-center justify-between bg-[#07111f] px-3 py-2 text-white">
        <span className="font-black">{plan.title}</span>
        <span className="text-[10px] font-bold text-[#c2a378]">{plan.add ? 1 : plan.changes.length}</span>
      </div>
      <div className="divide-y divide-[#efe3cc]">
        {plan.add && (
          <div className="px-3 py-2">
            <b>{plan.add.customer}</b> · {plan.add.load_port || '—'} → <b>{plan.add.destination}</b>
            <div className="mt-1 flex flex-wrap gap-2" dir="ltr">{PRICE_KEYS.filter(k => plan.add![k]).map(k => <span key={k} className="rounded bg-emerald-100 px-1.5 font-black text-emerald-800">{PRICE_LABELS[k]} {money(plan.add![k])}</span>)}</div>
          </div>
        )}
        {shown.map(c => (
          <div key={c.before.id} className={`px-3 py-2 ${plan.kind === 'delete_rate' ? 'bg-red-50 line-through' : ''}`}>
            <div><b>{plan.kind === 'rename_customer' ? `${c.before.customer} → ${c.after.customer}` : c.before.customer}</b> · {c.before.load_port || '—'} → <b>{c.before.destination}</b></div>
            {plan.kind !== 'delete_rate' && plan.kind !== 'rename_customer' && (
              <div className="mt-1 flex flex-wrap gap-2" dir="ltr">
                {diff(c).map(k => <span key={k} className="rounded bg-amber-100 px-1.5"><span className="text-slate-500">{PRICE_LABELS[k]}</span> <s className="text-slate-400">{money(c.before[k])}</s> <b>{money(c.after[k])}</b></span>)}
              </div>
            )}
          </div>
        ))}
        {plan.changes.length > shown.length && <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500">{tx.more(plan.changes.length - shown.length)}</div>}
      </div>
      {state === 'pending' && (
        <div className="flex justify-end gap-2 border-t border-[#efe3cc] bg-white px-3 py-2">
          <button onClick={onCancel} style={{ minHeight: 0 }} className="rounded-lg border border-[#d9d0c0] px-3 py-1.5 text-[11px] font-black">{tx.cancel}</button>
          <button onClick={onConfirm} style={{ minHeight: 0 }} className="rounded-lg bg-[#c2a378] px-3 py-1.5 text-[11px] font-black text-[#07111f]">✓ {tx.confirm}</button>
        </div>
      )}
    </div>
  );
};

const DaliChat: React.FC<{
  lang: Lang; user: TransportUser; rates: Rate[]; isAdmin: boolean;
  setRates: React.Dispatch<React.SetStateAction<Rate[] | null>>;
  onQuote: (customer: string) => void; onShow: (f: { customer: string; loadPort: string; destination: string }) => void;
}> = ({ lang, user, rates, isAdmin, setRates, onQuote, onShow }) => {
  // Staff talk to DALI in Arabic, so the chat stays Arabic whatever the app language.
  const tx = TX.ar;
  void lang;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [earlier, setEarlier] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef(dali.sessionId());
  const seq = useRef(0);
  const loaded = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    dali.loadMemory(session.current).then(m => {
      setEarlier(m.earlier);
      setMsgs(prev => [...m.turns.map(tn => ({ id: ++seq.current, role: tn.role, content: tn.content })), ...prev]);
    });
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const history = (): dali.ChatTurn[] => msgs.filter(m => m.content).map(m => ({ role: m.role, content: m.content })).slice(-20);
  const push = (m: Omit<Msg, 'id'>) => setMsgs(list => [...list, { ...m, id: ++seq.current }]);
  const reply = (content: string, extra: Partial<Msg> = {}) => { push({ role: 'assistant', content, ...extra }); dali.remember(session.current, 'assistant', content); };

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy) return;
    setInput('');
    push({ role: 'user', content: q });
    dali.remember(session.current, 'user', q);
    setBusy(true);
    try {
      const h = history();
      if (dali.looksLikeAction(q)) {
        const a = await dali.parseAction(q, rates, h);
        if (a.type === 'quote') {
          const c = dali.bestCustomer(rates, a.customer);
          if (c) { reply(tx.opened(c)); onQuote(c); setOpen(false); return; }
        } else if (a.type === 'show') {
          const c = a.customer ? dali.bestCustomer(rates, a.customer) || a.customer : '';
          const rows = dali.findRows(rates, { ...a, customer: c });
          onShow({ customer: c && rows.some(r => r.customer === c) ? c : '', loadPort: rows[0] && a.loadPort ? rows[0].load_port : '', destination: rows[0] && a.destination ? rows[0].destination : '' });
          reply(tx.showing); setOpen(false); return;
        } else if (dali.WRITE_ACTIONS.has(a.type)) {
          if (!isAdmin) { reply(tx.adminOnly); return; }
          const plan = buildPlan(a, rates, tx);
          if (typeof plan === 'string') reply(plan);
          else push({ role: 'assistant', content: '', plan, state: 'pending' });
          return;
        }
      }
      const { text, rows } = await dali.ask(rates, user, q, h, earlier);
      reply(text, { rows: rows.length });
    } catch (e: any) {
      push({ role: 'assistant', content: `${tx.failed}: ${e.message || e}`, state: 'error' });
    } finally { setBusy(false); }
  };

  const setState = (id: number, state: Msg['state']) => setMsgs(list => list.map(m => m.id === id ? { ...m, state } : m));
  const confirm = async (m: Msg) => {
    const p = m.plan!;
    setState(m.id, 'done'); setBusy(true);
    try {
      if (p.add) {
        const added = await api.insertRates([p.add]);
        setRates(list => [...(list || []), ...added]);
      } else if (p.deleteIds) {
        await api.deleteRates(p.deleteIds);
        const gone = new Set(p.deleteIds);
        setRates(list => (list || []).filter(r => !gone.has(r.id)));
      } else {
        const updated = await api.updateRates(p.changes.map(c => c.after));
        const map = new Map(updated.map(r => [r.id, r]));
        setRates(list => (list || []).map(r => map.get(r.id) || r));
      }
      reply(`${tx.done} (${p.title}: ${p.add ? 1 : p.changes.length})`);
    } catch (e: any) {
      setState(m.id, 'pending');
      push({ role: 'assistant', content: `${tx.failed}: ${e.message || e}`, state: 'error' });
    } finally { setBusy(false); }
  };
  const cancel = (m: Msg) => { setState(m.id, 'cancelled'); reply(tx.cancelled); };
  const newChat = () => { session.current = dali.sessionId(true); setMsgs([]); };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={tx.title}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#07111f] py-2 pe-4 ps-2 text-white shadow-[0_10px_30px_rgba(7,17,31,.35)] ring-1 ring-[#c2a378]/50 transition hover:-translate-y-0.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#c2a378]/15"><img src={DALI_MARK} alt="" className="h-6 w-6 object-contain" /></span>
          <span className="text-start leading-none"><span className="block text-sm font-black tracking-wider">{tx.title}</span><span className="text-[10px] font-bold text-[#c2a378]">{tx.sub}</span></span>
        </button>
      )}
      {open && (
        <div role="dialog" dir="rtl" lang="ar" aria-label={tx.title} className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[#c2a378]/40 bg-[#f8f4ec] shadow-[0_20px_60px_rgba(7,17,31,.35)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[640px] sm:max-h-[calc(100vh-110px)] sm:w-[440px]">
          <div className="flex items-center gap-3 bg-[#07111f] px-4 py-3 text-white">
            <img src={DALI_MARK} alt="" className="h-8 w-8 object-contain" />
            <div className="me-auto leading-tight"><div className="font-black tracking-wider">{tx.title}</div><div className="text-[10px] font-bold text-[#c2a378]">{tx.sub}</div></div>
            <button onClick={newChat} style={{ minHeight: 0 }} className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black text-white/80 hover:border-[#c2a378]">{tx.newChat}</button>
            <button onClick={() => setOpen(false)} style={{ minHeight: 0 }} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-lg text-white/70 hover:bg-white/10">×</button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            <div className="max-w-[88%] rounded-2xl rounded-ss-sm bg-white px-3.5 py-2.5 text-[13px] leading-6 shadow-sm">{tx.hello(user.name.split(' ')[0] || user.name)}</div>
            {!msgs.length && (
              <div className="flex flex-wrap gap-2">
                {tx.tries.map(s => <button key={s} onClick={() => send(s)} style={{ minHeight: 0 }} className="rounded-full border border-[#c2a378]/60 bg-white px-3 py-1.5 text-[11px] font-bold text-[#6f5a3a] hover:bg-[#fbf3e4]">{s}</button>)}
              </div>
            )}
            {msgs.map(m => m.role === 'user' ? (
              <div key={m.id} className="ms-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-se-sm bg-[#07111f] px-3.5 py-2.5 text-[13px] leading-6 text-white">{m.content}</div>
            ) : (
              <div key={m.id} className="max-w-[92%]">
                {m.content && <div className={`whitespace-pre-wrap rounded-2xl rounded-ss-sm px-3.5 py-2.5 text-[13px] leading-6 shadow-sm ${m.state === 'error' ? 'bg-red-50 text-red-800' : 'bg-white'}`}>{m.content}</div>}
                {m.plan && <PlanCard plan={m.plan} tx={tx} state={m.state} onConfirm={() => confirm(m)} onCancel={() => cancel(m)} />}
                {!!m.rows && <div className="mt-1 px-1 text-[10px] font-bold text-slate-400">{tx.rowsUsed(m.rows)}</div>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-slate-500"><img src={DALI_MARK} alt="" className="h-4 w-4 animate-spin object-contain" style={{ animationDuration: '.6s' }} />{tx.thinking}</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-[#e3dccf] bg-white p-2.5">
            <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={tx.placeholder} style={{ minHeight: 0 }}
              className="max-h-32 flex-1 resize-none rounded-xl border border-[#d9d0c0] px-3 py-2 text-[13px] outline-none focus:border-[#c2a378]" />
            <button type="submit" disabled={!input.trim() || busy} style={{ minHeight: 0 }} className="rounded-xl bg-[#c2a378] px-4 py-2 text-xs font-black text-[#07111f] disabled:opacity-40">{tx.send}</button>
          </form>
        </div>
      )}
    </>
  );
};

export default DaliChat;
