/**
 * Plain-language "why" behind each number: how a fill's km/L was worked out, and why a truck's
 * health is Good / Watch / Check maintenance. Used on screen (tap a fill) and in the printed reports.
 * Pure functions: no React, so the fuel tests can run them.
 */
import type { Lang } from '../i18n';
import type { FuelSettings, Segment } from './math';
import type { TruckHealth } from './alerts';

// Numbers and dates are left-to-right isolates so they read right inside Arabic sentences.
const iso = (x: string) => `⁦${x}⁩`;
const f0 = (v: number) => iso(Math.round(v || 0).toLocaleString('en-US'));
const f1 = (v: number) => iso((v || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }));
const f2 = (v: number) => iso((v || 0).toFixed(2));
const pc = (v: number) => iso(`${v > 0 ? '+' : ''}${(v || 0).toFixed(1)}%`);
const dt = (at: string) => iso(`${at.slice(0, 10)} ${at.slice(11, 16)}`.trim());

export type TargetSource = 'truck' | 'type' | 'auto';
export const targetSource = (s: Segment | TruckHealth, settings: FuelSettings): TargetSource =>
  settings.truckTargets[s.plate] ? 'truck' : settings.typeTargets[s.vehicleType] ? 'type' : 'auto';

export interface Explanation {
  /** The steps, in order, each one sentence. */
  steps: string[];
  /** One sentence: the verdict and why. */
  verdict: string;
  /** One line for report tables. */
  short: string;
  /** The simple version: 2–4 short lines anyone can read at a glance. */
  simple: string[];
}

const W = {
  en: {
    start: (at: string, km: number) => `Start: the full fill on ${dt(at)} at odometer ${f0(km)} km.`,
    fill: (at: string, st: string, L: number) => `${dt(at)}${st ? ` at ${st}` : ''}: ${f1(L)} L.`,
    split: (n: number, h: number) => `${n} card transactions within ${h} h were joined into one fill (the pump stops at 9,999 EGP, so one full tank comes as 2 transactions).`,
    fixed: (a: number, b: number) => `Odometer ${f0(a)} was typed with an extra digit; read as ${f0(b)}.`,
    bad: (km: number | null, r: string) => `Odometer ${km == null ? '—' : f0(km)} was skipped (${r === 'sameKm' ? 'same km as the fill before' : r === 'backwards' ? 'lower than the fill before' : 'too far from the fill before'}); its liters are counted with the next good reading.`,
    partial: (n: number, x: number) => `${n} fills are counted together: on its own, a fill gave more than ${f2(x)} km/L (1.5 × target), which is impossible, so that tank was not filled to full.`,
    paired: (a: number, b: number, n: number) => `Two fills are counted together: alone, the first gave ${f2(a)} km/L and the next ${f2(b)} km/L. One tank was not filled to full (or filled higher than the other), so one looks too good and the other too bad. Counted together they are the real consumption.`,
    pending: 'No full fill after this one yet, so the km driven on these liters is not known. The verdict comes with the next upload.',
    dist: (to: number, from: number, d: number) => `Distance: ${f0(to)} − ${f0(from)} = ${f0(d)} km.`,
    liters: (L: number) => `Fuel used: every liter put in after the start fill, up to and including the closing fill = ${f1(L)} L.`,
    kml: (d: number, L: number, k: number, l100: number) => `km/L = ${f0(d)} km ÷ ${f1(L)} L = ${f2(k)} km/L (${f1(l100)} L per 100 km).`,
    target: (t: number, src: TargetSource, type: string) => `Target ${f2(t)} km/L (${src === 'truck' ? 'set for this truck' : src === 'type' ? `set for ${type || 'this type'}` : `average of ${type || 'the fleet'} trucks in the data`}).`,
    expected: (d: number, t: number, e: number, m: number, a: number) => `At target this trip needs ${f0(d)} ÷ ${f2(t)} = ${f0(e)} L. One fill gets a ± ${iso(m + '%')} margin, so up to ${f0(a)} L is still normal.`,
    ok: (L: number, a: number, v: number) => `Normal: ${f1(L)} L is within the ${f0(a)} L allowed (${pc(v)} vs target).`,
    high: (d: number, over: number, price: number, loss: number, v: number) => `Over consumption: ${f0(d)} L more than target (${pc(v)}); ${f1(over)} L above the margin × ${f2(price)} EGP = ${f0(loss)} EGP lost.`,
    low: (v: number) => `Too good (${pc(v)} vs target): a truck can't really do this, so usually the tank was not filled to full or a km reading is wrong. Check the next fill.`,
    card: (d: number, k: number | null) => `The card report says ${f0(d)} km${k != null ? ` and ${f2(k)} km/L` : ''}: it counts each transaction alone, so split fills, part fills and bad readings make its number wrong.`,
    shortSplit: 'split joined', shortPartial: 'part fill joined', shortFixed: 'km fixed', shortBad: 'bad km skipped',
    s1: (d: number, L: number, k: number) => `Drove ${f0(d)} km on ${f0(L)} L = ${f2(k)} km per liter.`,
    s2: (t: number, e: number) => `Target is ${f2(t)} km/L, so it should use about ${f0(e)} L.`,
    sGood: (L: number, e: number) => `✓ Normal: used ${f0(L)} L, close to the ${f0(e)} L expected.`,
    sBad: (x: number, loss: number) => `✗ Used ${f0(x)} L more than it should${loss ? `, about ${f0(loss)} EGP lost` : ''}.`,
    sToo: '⚠ Too good to be true: the tank was probably not filled to full, or a km reading is wrong.',
    sWait: (L: number) => `⏳ ${f0(L)} L filled. We need the next full fill to know how many km it drove.`,
    sFix: (x: string) => `Fixed automatically: ${x}.`,
    hShort: { good: '✓ Good: doing its normal km/L.', watch: '⚠ Watch: a bit below target or getting worse. Keep an eye on it.', service: '✗ Check maintenance: it is burning clearly more than it should.', noData: '⏳ Not enough km yet to judge.' } as Record<string, string>,
    hs: (h: TruckHealth) => `Last ${f0(h.recentKm)} km: ${f2(h.recentKmL)} km/L. Target ${f2(h.target)}, its usual ${f2(h.baseKmL)}.`,
    sOk: 'normal', sHigh: (l: number) => `over by ${f0(l)} EGP`, sLow: 'too good, check fill/km', sPending: 'waiting next fill',
    h: {
      good: 'Good: the last stretch is within target and close to its own normal.',
      watch: 'Watch: below target or getting worse than its own normal. Keep an eye on the next fills.',
      service: 'Check maintenance: well below target, or below target and falling fast. Common causes: injectors, air/fuel filters, tyre pressure, a leak, or driving style.',
      noData: (km: number) => `Not enough data: needs ${f0(km)} km of full-to-full fills.`,
      line: (h: TruckHealth) => `Last ${f0(h.recentKm)} km: ${f2(h.recentKmL)} km/L vs target ${f2(h.target)} (${pc(h.vsTargetPct)}) and vs its own normal ${f2(h.baseKmL)} (${pc(h.trendPct)}).`,
    },
    method: [
      'How the numbers are worked out:',
      'km/L is measured from one full tank to the next: km between the two odometer readings ÷ the liters put in after the first one.',
      'Two card transactions close together are one fill (the pump stops at 9,999 EGP). A fill that gives impossible km/L was not full, so it is joined with the next one.',
      'Odometer readings with an extra digit are fixed; readings that go backwards or jump too far are skipped and their liters move to the next good reading.',
      'Each fill is compared with the truck\'s target (± the fill margin); the truck\'s overall km/L uses the tighter truck margin. Liters above the margin × diesel price = the loss.',
      'Truck health compares the last 1,500 km with the target and with the truck\'s own earlier km/L, to spot a truck that needs maintenance.',
    ],
  },
  ar: {
    start: (at: string, km: number) => `البداية: التفويلة الكاملة يوم ${dt(at)} وعداد ${f0(km)} كم.`,
    fill: (at: string, st: string, L: number) => `${dt(at)}${st ? ` في ${st}` : ''}: ${f1(L)} لتر.`,
    split: (n: number, h: number) => `تم دمج ${f0(n)} معاملات كارت خلال ${f0(h)} ساعات في تفويلة واحدة (الطلمبة بتقف عند 9,999 جنيه، فالتانك الكامل بيطلع معاملتين).`,
    fixed: (a: number, b: number) => `العداد ${f0(a)} مكتوب بخانة زيادة، واتقرا ${f0(b)}.`,
    bad: (km: number | null, r: string) => `تم تجاهل العداد ${km == null ? '—' : f0(km)} (${r === 'sameKm' ? 'نفس كيلومتر التفويلة السابقة' : r === 'backwards' ? 'أقل من التفويلة السابقة' : 'بعيد جدًا عن التفويلة السابقة'})، ولتراته اتحسبت مع أول قراءة سليمة بعده.`,
    partial: (n: number, x: number) => `${f0(n)} تفويلات اتحسبوا مع بعض: تفويلة لوحدها كانت هتدي أكتر من ${f2(x)} كم/لتر (1.5 × المستهدف) وده مستحيل، يعني التانك ما اتملاش للآخر.`,
    paired: (a: number, b: number, n: number) => `تفويلتين اتحسبوا مع بعض: الأولى لوحدها ادت ${f2(a)} كم/لتر واللي بعدها ${f2(b)} كم/لتر. تانك اتملا أكتر من التاني، فواحدة باينة أحسن والتانية أسوأ. مع بعض هما الاستهلاك الحقيقي.`,
    pending: 'لسه مفيش تفويلة كاملة بعد دي، فالكيلومترات اللي اتمشت باللترات دي مش معروفة. الحكم هيظهر مع الرفع الجاي.',
    dist: (to: number, from: number, d: number) => `المسافة: ${f0(to)} − ${f0(from)} = ${f0(d)} كم.`,
    liters: (L: number) => `السولار المستهلك: كل اللترات اللي اتحطت بعد تفويلة البداية لحد تفويلة النهاية = ${f1(L)} لتر.`,
    kml: (d: number, L: number, k: number, l100: number) => `كم/لتر = ${f0(d)} كم ÷ ${f1(L)} لتر = ${f2(k)} كم/لتر (${f1(l100)} لتر لكل 100 كم).`,
    target: (t: number, src: TargetSource, type: string) => `المستهدف ${f2(t)} كم/لتر (${src === 'truck' ? 'محدد للسيارة دي' : src === 'type' ? `محدد لنوع ${type || 'السيارة'}` : `متوسط سيارات ${type || 'الأسطول'} في البيانات`}).`,
    expected: (d: number, t: number, e: number, m: number, a: number) => `على المستهدف المشوار ده محتاج ${f0(d)} ÷ ${f2(t)} = ${f0(e)} لتر. التفويلة الواحدة ليها هامش ± ${iso(m + '%')}، يعني لحد ${f0(a)} لتر يعتبر طبيعي.`,
    ok: (L: number, a: number, v: number) => `طبيعي: ${f1(L)} لتر داخل الـ ${f0(a)} لتر المسموح (${pc(v)} عن المستهدف).`,
    high: (d: number, over: number, price: number, loss: number, v: number) => `استهلاك زائد: ${f0(d)} لتر أكتر من المستهدف (${pc(v)})؛ ${f1(over)} لتر فوق الهامش × ${f2(price)} جنيه = ${f0(loss)} جنيه خسارة.`,
    low: (v: number) => `أحسن من الطبيعي (${pc(v)} عن المستهدف): العربية مش بتعمل كده فعلًا، فغالبًا التانك ما اتملاش للآخر أو قراءة العداد غلط. راجع التفويلة الجاية.`,
    card: (d: number, k: number | null) => `تقرير الكارت بيقول ${f0(d)} كم${k != null ? ` و ${f2(k)} كم/لتر` : ''}: بيحسب كل معاملة لوحدها، فالتفويل المقسوم والناقص والقراءات الغلط بتخلي رقمه غلط.`,
    shortSplit: 'دمج تفويل مقسوم', shortPartial: 'دمج تفويل ناقص', shortFixed: 'تصحيح عداد', shortBad: 'تجاهل عداد خاطئ',
    s1: (d: number, L: number, k: number) => `مشيت ${f0(d)} كم بـ ${f0(L)} لتر = ${f2(k)} كم لكل لتر.`,
    s2: (t: number, e: number) => `المستهدف ${f2(t)} كم/لتر، يعني المفروض تصرف حوالي ${f0(e)} لتر.`,
    sGood: (L: number, e: number) => `✓ طبيعي: صرفت ${f0(L)} لتر، قريب من الـ ${f0(e)} لتر المتوقعين.`,
    sBad: (x: number, loss: number) => `✗ صرفت ${f0(x)} لتر زيادة عن المفروض${loss ? `، خسارة حوالي ${f0(loss)} جنيه` : ''}.`,
    sToo: '⚠ أحسن من الطبيعي بزيادة: غالبًا التانك ما اتملاش للآخر، أو قراءة العداد غلط.',
    sWait: (L: number) => `⏳ اتحط ${f0(L)} لتر. محتاجين التفويلة الكاملة الجاية علشان نعرف مشيت كام كم.`,
    sFix: (x: string) => `اتصلح تلقائيًا: ${x}.`,
    hShort: { good: '✓ جيدة: ماشية بمعدلها الطبيعي.', watch: '⚠ تحت المتابعة: أقل شوية من المستهدف أو بتسوء. خلي عينك عليها.', service: '✗ محتاجة كشف صيانة: بتصرف أكتر من المفروض بوضوح.', noData: '⏳ لسه الكيلومترات مش كفاية للحكم.' } as Record<string, string>,
    hs: (h: TruckHealth) => `آخر ${f0(h.recentKm)} كم: ${f2(h.recentKmL)} كم/لتر. المستهدف ${f2(h.target)}، والمعتاد بتاعها ${f2(h.baseKmL)}.`,
    sOk: 'طبيعي', sHigh: (l: number) => `زيادة ${f0(l)} جنيه`, sLow: 'أحسن من الطبيعي، راجع التفويل/العداد', sPending: 'ينتظر التفويلة الجاية',
    h: {
      good: 'جيدة: آخر مسافة داخل المستهدف وقريبة من معدلها المعتاد.',
      watch: 'تحت المتابعة: أقل من المستهدف أو بتسوء عن معدلها المعتاد. تابع التفويلات الجاية.',
      service: 'محتاجة صيانة: أقل من المستهدف بكتير، أو أقل منه وبتنزل بسرعة. أسباب شائعة: البخاخات، فلاتر الهوا/السولار، ضغط الكاوتش، تسريب، أو طريقة السواقة.',
      noData: (km: number) => `بيانات غير كافية: محتاجة ${f0(km)} كم من تفويل كامل لكامل.`,
      line: (h: TruckHealth) => `آخر ${f0(h.recentKm)} كم: ${f2(h.recentKmL)} كم/لتر مقابل المستهدف ${f2(h.target)} (${pc(h.vsTargetPct)}) ومقابل معدلها المعتاد ${f2(h.baseKmL)} (${pc(h.trendPct)}).`,
    },
    method: [
      'طريقة الحساب:',
      'الكم/لتر بيتحسب من تانك كامل للتانك الكامل اللي بعده: الكيلومترات بين قراءتين العداد ÷ اللترات اللي اتحطت بعد الأولى.',
      'معاملتين كارت قريبين من بعض = تفويلة واحدة (الطلمبة بتقف عند 9,999 جنيه). التفويلة اللي بتدي كم/لتر مستحيل ما كانتش كاملة، فبتندمج مع اللي بعدها.',
      'قراءات العداد اللي فيها خانة زيادة بتتصحح، واللي بترجع لورا أو بتقفز جدًا بتتجاهل ولتراتها بتنتقل لأول قراءة سليمة.',
      'كل تفويلة بتتقارن بمستهدف السيارة (± هامش التفويلة)، والسيارة ككل بهامش أضيق. اللترات فوق الهامش × سعر السولار = الخسارة.',
      'حالة السيارة بتقارن آخر 1,500 كم بالمستهدف وبمعدل السيارة نفسها قبل كده، علشان نعرف لو محتاجة صيانة.',
    ],
  },
};

/** Step-by-step: how one fill's km/L, verdict and loss were worked out. */
export function explainSegment(s: Segment, settings: FuelSettings, price: number, lang: Lang): Explanation {
  const w = W[lang];
  const steps: string[] = [w.start(s.fromAt, s.fromKm)];
  const tags: string[] = [];
  for (const f of s.fills) {
    let line = w.fill(f.at, f.station, f.liters);
    if (f.txs.length > 1) line += ` ${w.split(f.txs.length, settings.splitHours)}`;
    for (const x of f.fixedKm) line += ` ${w.fixed(x.from, x.to)}`;
    for (const x of f.badKm) line += ` ${w.bad(x.km, x.reason)}`;
    steps.push(line);
  }
  if (s.notes.includes('split')) tags.push(w.shortSplit);
  if (s.notes.includes('partial')) { steps.push(w.partial(s.fills.length, s.target * 1.5)); tags.push(w.shortPartial); }
  if (s.notes.includes('paired') && s.pair) { steps.push(w.paired(s.pair[0], s.pair[1], s.fills.length)); if (!tags.includes(w.shortPartial)) tags.push(w.shortPartial); }
  if (s.notes.includes('fixedKm')) tags.push(w.shortFixed);
  if (s.notes.includes('badKm')) tags.push(w.shortBad);
  const tagText = tags.length ? ` · ${tags.join(' · ')}` : '';

  if (s.status === 'pending') {
    steps.push(w.pending);
    const simple = [w.sWait(s.liters), ...(tags.length ? [w.sFix(tags.join('، '))] : [])];
    return { steps, verdict: w.pending, short: `${f1(s.liters)} L · ${w.sPending}${tagText}`, simple };
  }
  steps.push(w.dist(s.toKm, s.fromKm, s.distance), w.liters(s.liters), w.kml(s.distance, s.liters, s.kmL, s.l100));
  steps.push(w.target(s.target, targetSource(s, settings), s.vehicleType));
  steps.push(w.expected(s.distance, s.target, s.expectedL, settings.fillMarginPct, s.allowedL));
  const verdict = s.status === 'high' ? w.high(s.diffL, s.overMarginL, price, s.lossEgp, s.vsTargetPct)
    : s.status === 'low' ? w.low(s.vsTargetPct) : w.ok(s.liters, s.allowedL, s.vsTargetPct);
  const cardOff = s.card.kmL != null && s.kmL && Math.abs(s.card.kmL - s.kmL) > 0.05;
  if ((s.card.distance || s.card.kmL != null) && (cardOff || Math.abs(s.card.distance - s.distance) > 5)) steps.push(w.card(s.card.distance, s.card.kmL));
  const sv = s.status === 'high' ? w.sHigh(s.lossEgp) : s.status === 'low' ? w.sLow : w.sOk;
  const short = `${f0(s.distance)} ÷ ${f1(s.liters)} = ${f2(s.kmL)} (${f2(s.target)}) → ${sv}${tagText}`;
  const simple = [
    w.s1(s.distance, s.liters, s.kmL),
    w.s2(s.target, s.expectedL),
    s.status === 'high' ? w.sBad(s.diffL, s.lossEgp) : s.status === 'low' ? w.sToo : w.sGood(s.liters, s.expectedL),
    ...(tags.length ? [w.sFix(tags.join(lang === 'ar' ? '، ' : ', '))] : []),
  ];
  return { steps, verdict, short, simple };
}

/** Truck health in one short line (the numbers only). */
export const healthSimple = (h: TruckHealth, lang: Lang): string[] => (h.status === 'noData' ? [W[lang].hShort.noData] : [W[lang].hs(h), W[lang].hShort[h.status]]);

/** Why a truck got its health status, in one or two sentences. */
export function explainHealth(h: TruckHealth, lang: Lang, healthKm: number): string {
  const w = W[lang].h;
  if (h.status === 'noData') return w.noData(healthKm);
  return `${w.line(h)} ${w[h.status]}`;
}

/** The method box printed at the top of every report. */
export const methodText = (lang: Lang) => W[lang].method;
