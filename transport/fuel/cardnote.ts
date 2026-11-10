import type { Lang } from '../i18n';
import type { FuelTx, Segment, TxView } from './math';

/**
 * The fuel-card report marks some rows "Wrong" with a short reason (often in Arabic).
 * These helpers say what that reason actually means, and what the app did about it,
 * instead of repeating the card's words.
 */
export type CardIssueKind = 'newStart' | 'sameKm' | 'belowMin' | 'aboveMax' | 'backwards' | 'noKm' | 'other';

const iso = (x: string) => `⁦${x}⁩`;
const f0 = (v: number) => iso(Math.round(v).toLocaleString('en-US'));
const f2 = (v: number) => iso(v.toFixed(2));

export function cardIssueKind(tx: Pick<FuelTx, 'cardValidity' | 'cardReason'>): CardIssueKind | null {
  const r = (tx.cardReason || '').replace(/\s+/g, ' ').trim();
  const wrong = /wrong/i.test(tx.cardValidity || '');
  if (!r && !wrong) return null;
  if (/بدايه|بداية|new (accounting|calculation)|reset|start/i.test(r)) return 'newStart';
  if (/نفس|same/i.test(r)) return 'sameKm';
  if (/اقل|أقل|below|less|min/i.test(r)) return 'belowMin';
  if (/اكبر|أكبر|اكثر|أكثر|above|more|max|exceed/i.test(r)) return 'aboveMax';
  if (/رجوع|سابق|backward|lower|previous/i.test(r)) return 'backwards';
  if (/بدون|لا يوجد|no (km|odometer|reading)|missing/i.test(r)) return 'noKm';
  return wrong || r ? 'other' : null;
}

const T = {
  en: {
    title: { newStart: 'Card restarted its km count', sameKm: 'Same km as the last fill', belowMin: 'Too few km for the card', aboveMax: 'Too many km for the card', backwards: 'km lower than before', noKm: 'No km reading', other: 'Card marked this row wrong' },
    meaning: {
      newStart: 'The card system did not accept an earlier km reading, so it started counting again from this row. Its km and km/L here are not a real measurement.',
      sameKm: 'The odometer is the same as the transaction before. This is the second part of one fill (the pump stops at 9,999 EGP), not a separate trip.',
      belowMin: 'Very few km since the last fill, so the card refused to measure it. Usually the tank was topped up soon after, or the fill before was not full.',
      aboveMax: 'More km than one tank can drive, so the card refused it. Usually a fill was missed in between, or the km was typed wrong.',
      backwards: 'The km reading is lower than the fill before, so it was typed wrong.',
      noKm: 'No km reading was typed at the pump, so nothing can be measured on this row alone.',
      other: (r: string) => `The card company marked this row as wrong${r ? ` ("${r}")` : ''}. Its own km/L for this row is not reliable.`,
    },
    did: {
      split: 'The app joined it with the other transaction into one fill.',
      fixed: (a: number, b: number) => `The app read the km ${f0(a)} as ${f0(b)} (extra digit) and measured normally.`,
      bad: 'The app skipped this km reading and counted its liters with the next good reading.',
      joined: (n: number) => `The app counted ${iso(String(n))} fills together so the tank is measured from full to full.`,
      measured: (km: number, kml: number) => `The app measured it from the real odometer: ${f0(km)} km, ${f2(kml)} km/L.`,
      pending: 'The app waits for the next full fill to measure it.',
      none: 'The app does not use the card\'s number. It measures from the odometer between full fills.',
    },
    upload: (n: number) => `${iso(String(n))} rows are marked wrong by the card. What they mean:`,
    count: (n: number) => `${iso(String(n))} ×`,
    handled: 'The app handles all of these by itself. Nothing to fix.',
  },
  ar: {
    title: { newStart: 'الكارت بدأ عدّ الكيلومترات من جديد', sameKm: 'نفس عداد التفويلة اللي قبلها', belowMin: 'مسافة قليلة على الكارت', aboveMax: 'مسافة كبيرة على الكارت', backwards: 'العداد أقل من اللي قبله', noKm: 'مفيش قراءة عداد', other: 'الكارت معلّم الصف ده غلط' },
    meaning: {
      newStart: 'سيستم الكارت ما قبلش قراءة عداد قبل كده، فبدأ يعد من أول الصف ده. الكيلومترات والكم/لتر بتوعه هنا مش قياس حقيقي.',
      sameKm: 'العداد هو نفس عداد المعاملة اللي قبلها. دي الجزء التاني من نفس التفويلة (الطلمبة بتقف عند 9,999 جنيه)، مش مشوار جديد.',
      belowMin: 'كيلومترات قليلة جداً من آخر تفويلة، فالكارت رفض يحسبها. غالباً التانك اتكمّل بعدها بشوية، أو التفويلة اللي قبلها ما كانتش كاملة.',
      aboveMax: 'كيلومترات أكتر من اللي تانك واحد يمشيه، فالكارت رفضها. غالباً في تفويلة ناقصة في النص أو العداد اتكتب غلط.',
      backwards: 'قراءة العداد أقل من التفويلة اللي قبلها، يعني اتكتبت غلط.',
      noKm: 'ما اتكتبش عداد عند الطلمبة، فمينفعش يتقاس من الصف ده لوحده.',
      other: (r: string) => `شركة الكارت معلّمة الصف ده غلط${r ? ` («${r}»)` : ''}. الكم/لتر بتاعها للصف ده مش مضمون.`,
    },
    did: {
      split: 'التطبيق دمجها مع المعاملة التانية في تفويلة واحدة.',
      fixed: (a: number, b: number) => `التطبيق قرا العداد ${f0(a)} على إنه ${f0(b)} (خانة زيادة) وحسب عادي.`,
      bad: 'التطبيق تجاهل قراءة العداد دي وحسب لتراتها مع أول قراءة سليمة بعدها.',
      joined: (n: number) => `التطبيق حسب ${iso(String(n))} تفويلات مع بعض علشان يقيس من تانك كامل لتانك كامل.`,
      measured: (km: number, kml: number) => `التطبيق قاسها من العداد الحقيقي: ${f0(km)} كم، ${f2(kml)} كم/لتر.`,
      pending: 'التطبيق مستني التفويلة الكاملة الجاية علشان يقيسها.',
      none: 'التطبيق مش بيستخدم رقم الكارت، بيقيس من العداد بين التفويلات الكاملة.',
    },
    upload: (n: number) => `${iso(String(n))} صفوف الكارت معلّمها غلط. معناها إيه:`,
    count: (n: number) => `${iso(String(n))} ×`,
    handled: 'التطبيق بيتعامل مع كل ده لوحده. مفيش حاجة محتاجة تتصلح.',
  },
};

export interface CardIssue { kind: CardIssueKind; title: string; meaning: string; did: string }

/** What a card "Wrong" row means and what the app did with it (null when the card has no complaint). */
export function explainCardIssue(v: TxView, seg: Segment | undefined, lang: Lang): CardIssue | null {
  const x = v.tx;
  const kind = cardIssueKind(x);
  if (!kind) return null;
  const w = T[lang];
  const fill = seg?.fills.find(f => f.txs.some(t => t.id === x.id));
  const fixed = fill?.fixedKm.find(k => k.from === x.km);
  let did: string;
  if (fixed) did = w.did.fixed(fixed.from, fixed.to);
  else if (v.flags.includes('badKm')) did = w.did.bad;
  else if (v.flags.includes('split')) did = w.did.split;
  else if (seg && seg.fills.length > 1) did = w.did.joined(seg.fills.length);
  else if (seg && seg.status === 'pending') did = w.did.pending;
  else if (seg && seg.distance > 0) did = w.did.measured(seg.distance, seg.kmL);
  else did = w.did.none;
  const meaning = kind === 'other' ? w.meaning.other(x.cardReason) : w.meaning[kind];
  return { kind, title: w.title[kind], meaning, did };
}

/** Upload summary: each kind of card complaint in the file, how many rows, and what it means. */
export function summarizeCardIssues(rows: FuelTx[], lang: Lang): { head: string; items: { title: string; count: number; meaning: string }[]; handled: string } | null {
  const w = T[lang];
  const by = new Map<CardIssueKind, { n: number; reason: string }>();
  for (const r of rows) {
    if (!/wrong/i.test(r.cardValidity || '')) continue;
    const k = cardIssueKind(r);
    if (!k) continue;
    const cur = by.get(k) || { n: 0, reason: r.cardReason };
    cur.n++;
    by.set(k, cur);
  }
  if (!by.size) return null;
  const total = [...by.values()].reduce((s, x) => s + x.n, 0);
  return {
    head: w.upload(total),
    items: [...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => ({ title: w.title[k], count: x.n, meaning: k === 'other' ? w.meaning.other(x.reason) : w.meaning[k] })),
    handled: w.handled,
  };
}
