import type { Lang } from '../i18n';
import type { AlertKind, AlertLevel, FuelAlert } from './alerts';

// Numbers, dates and % are wrapped in left-to-right isolates so they read right inside Arabic sentences.
const iso = (x: string) => `\u2066${x}\u2069`;
const f0 = (v: unknown) => iso(Math.round(Number(v) || 0).toLocaleString('en-US'));
const f2 = (v: unknown) => iso((Number(v) || 0).toFixed(2));
const plain = (v: unknown) => iso(String(v ?? ''));
const pctS = (v: unknown) => { const n = Number(v) || 0; return n ? iso(`${n > 0 ? '+' : ''}${n.toFixed(1)}%`) : '—'; };

const en = {
  tab: 'Fuel',
  title: 'Fuel consumption (km/L)',
  sub: 'Fuel-card transactions, corrected for split fills, partial fills, reversals and bad odometer readings.',
  upFail: 'Could not read this file',
  upNoHeader: (cells: string) => `This is not the fuel-card "Fuel Transactions" report: it has no Plate number and Liters columns.${cells ? ` Its first cells read: ${cells}.` : ''} Download the transactions report from the fuel-card site (Excel or CSV) and upload that file.`,
  upBadDate: (n: number, ex: string) => `${n} rows were skipped because their date can't be read${ex ? ` (for example "${ex}")` : ''}. Dates should look like "10 نوفمبر 2026" or 10/11/2026. Check the Date column wasn't changed in Excel.`,
  upBadLiters: (n: number, ex: string) => `${n} rows were skipped because Liters is not a number${ex ? ` (for example "${ex}")` : ''}. Usually these are total or empty lines at the end of the sheet.`,
  upNoPlate: (n: number) => `${n} rows were skipped because they have no plate number.`,
  upSkipped: 'Rows not added',
  appResult: 'App result (main)', cardRef: 'Card report', cardRefHint: 'reference only, tap to open',
  txPreview: 'Card transaction', editTx: 'Edit', saveTx: 'Save changes', cancel: 'Cancel', restoreTx: 'Restore original', deleteTx: 'Delete transaction',
  deleteTxConfirm: 'Delete this transaction? The fill math is recalculated without it.', editedTag: 'edited', editedOn: (d: string) => `Edited ${d}. Original values are kept and can be restored.`,
  origWas: 'was', txSaved: 'Transaction saved. km/L recalculated.', txDeleted: 'Transaction deleted.', txRestored: 'Original values restored.', note: 'Note',
  inFill: 'In this fill', openFill: 'Open fill calculation', tapTxHint: 'Tap a transaction to see it or edit it.', time: 'Time', vehicleType: 'Vehicle type', txType: 'Type', pricePerL: 'EGP / L', noChange: 'Nothing changed.',
  editHint: 'Changes recalculate km/L for this truck right away. A new upload never overwrites an edited transaction.',
  mergedRef: 'Card transactions (reference)', mergedHint: (n: number) => `${n} transactions joined into one calculation`, startRow: 'Start (full tank)', mergedWith: 'Joined with', txIds: 'Card transactions #', roleSplit: 'joined (pump stop)', rolePartial: 'part fill', roleFixed: 'km fixed', roleBad: 'km skipped', roleClose: 'closing', readFull: 'Read full explanation', hideFull: 'Hide full explanation', why: 'Why / how calculated', howCalc: 'How this was calculated', result: 'Result', tapHint: 'Tap any fill to see how its km/L was calculated.', whyHealth: 'Why this status', method: 'How we calculate',
  home: 'Home', more: 'More', filters: 'Filters', actions: 'Actions', sort: 'Sort', done: 'Done', close: 'Close',
  upload: 'Upload fuel report', uploading: 'Reading file…', exportXls: 'Excel', print: 'Print / PDF', clearAll: 'Delete all fuel data',
  clearConfirm: 'Delete every saved fuel transaction? Type DELETE to confirm.',
  localNote: 'Saved in this browser only. Run fuel-setup.sql in Supabase so everyone sees the same data.',
  empty: 'No fuel data yet. Upload the "Fuel Transactions" Excel export from the fuel card system.',
  emptyViewer: 'No fuel data yet. An admin uploads the fuel card report here.',
  noMatch: 'Nothing matches these filters.',
  found: (n: number, from: string, to: string) => `The file has ${n} transactions from ${from} to ${to}. Checked against what is already saved:`,
  upNew: 'New, will be added', upInSystem: 'Already in the system, skipped', upRepeated: 'Repeated in the file, skipped',
  upOnlyNew: 'Only the new transactions are added. Nothing already saved is added again.', upNothing: 'Nothing new in this file. Everything is already saved.',
  foundNone: 'No transactions found. The sheet needs columns like Date, Plate Number, Liters, KM reading.',
  saveUpload: 'Save', saved: (n: number) => `Saved ${n} transactions.`,
  // filters
  search: 'Search truck, driver, station, transaction #…', from: 'From', to: 'To', allTrucks: 'All trucks', allDrivers: 'All drivers',
  allStations: 'All stations', allTypes: 'All vehicle types', anyStatus: 'Any status', clear: 'Clear filters',
  // kpis
  liters: 'Liters', cost: 'Fuel cost', charged: 'Card charged', fees: 'card fees', trackedKm: 'Tracked km', fleetKmL: 'Fleet km/L',
  target: 'Target', overMargin: 'Over margin', checks: 'To check', fillsOutside: 'fills outside margin', badReadings: 'bad km readings',
  perLiter: 'EGP / L', auto: 'auto',
  cardVsActual: 'Card report vs actual', cardKm: 'Card km', actual: 'Actual', actualKm: 'Actual km', cardKmL: 'Card km/L', actualKmL: 'Actual km/L',
  cardWrong: 'rows the card marks "Wrong"', diff: 'Difference',
  cardVsActualHint: 'Card = the uploaded file\'s own Distance column over the rows it does not mark Wrong. Actual = our odometer math after joining split and partial fills and skipping bad readings.',
  // views
  trucks: 'Trucks', drivers: 'Drivers', fills: 'Fills', transactions: 'Transactions', weeks: 'Weekly', week: 'Week (Sat → Fri)', vsLastWeek: 'vs last week', soFar: 'so far', months: 'Monthly', stations: 'Stations', settings: 'Margins & targets',
  // columns
  truck: 'Truck', type: 'Type', driver: 'Driver', station: 'Station', date: 'Date', month: 'Month', count: 'Fills', txs: 'Transactions',
  km: 'km', distance: 'Distance', kmL: 'km/L', l100: 'L/100km', vsTarget: 'vs target', diffL: 'Diff L', diffEgp: 'Diff EGP',
  overL: 'Over margin L', loss: 'Loss EGP', splits: 'Split', partials: 'Partial', bad: 'Bad km', status: 'Status', notes: 'Notes',
  fromKm: 'From km', toKm: 'To km', cardDistance: 'Card km', kmDiff: 'km diff', amount: 'Amount', total: 'Charged', fee: 'Fee',
  pumpVar: 'Pump var.', odometer: 'KM reading', ourKm: 'Actual km', cardSays: 'Card says', flags: 'Flags', share: 'Share', expected: 'Expected L',
  // statuses
  st_ok: 'Normal', st_high: 'Over consumption', st_low: 'Too good, check', st_pending: 'Waiting next fill',
  st_badKm: 'Bad km reading', st_split: 'Split fill', st_partial: 'Partial fill', st_reversed: 'Reversed',
  n_split: 'Split fill joined (pump stopped at 9,999)', n_partial: 'Partial fill joined with next fill', n_badKm: 'Bad km reading skipped', n_reversal: 'Reversal', n_fixedKm: 'km typed with an extra digit, fixed',
  f_reversed: 'Reversed', f_reversal: 'Reversal', f_split: 'Split', f_badKm: 'Bad km', f_fixedKm: 'km fixed', f_opening: 'First reading',
  // settings
  setHint: 'Targets and margins decide what is normal. Leave a target empty to use the fleet average for that type.',
  price: 'Diesel price (EGP/L)', priceHint: 'Values liters over the margin. 0 = take it from the report. Fuel cost always uses what was paid.', truckMargin: 'Truck margin ± %', truckMarginHint: 'For a truck over the whole period',
  fillMargin: 'Single fill margin ± %', fillMarginHint: 'One fill swings more, so it gets a wider margin',
  splitHours: 'Join fills within (hours)', splitHoursHint: 'Pump stopped at 9,999 EGP and the truck refilled',
  minKm: 'Join fills closer than (km)', maxKm: 'Max km on one tank', maxKmHint: 'Longer jumps are bad readings',
  typeTargets: 'Target km/L per vehicle type', truckTargets: 'Target km/L per truck', fleetAvg: 'fleet avg',
  saveSettings: 'Save settings', reset: 'Reset', readOnly: 'Only an admin can change these.',
  how: 'How the math works',
  howLines: [
    'Every fill is counted full-to-full: the liters put in replace what the truck burned since the last fill.',
    'Two transactions of the same truck within a few hours (or at almost the same km) are one fill. Some pumps stop at 9,999 EGP.',
    'A fill with impossible km/L was not filled to full, so it is joined with the next fill.',
    'A km reading typed with one extra digit (7552921 for 755292) is fixed automatically. Other typos, same km and readings going backwards are skipped, and their liters move to the next good reading so totals stay right.',
    'A reversal cancels the transaction it refunds.',
    'Over margin = liters above what the target allows after the margin. Loss = those liters × price.',
  ],
  // alerts + weekly report
  alerts: 'Alerts', alertsBanner: (n: number) => `${n} alert${n === 1 ? '' : 's'} need a look`, openAlerts: 'Open alerts',
  noAlerts: 'No alerts. Everything is within the margins.', showChecked: 'Show checked', markChecked: 'Mark checked', undoChecked: 'Undo',
  checkedBy: 'checked', allKinds: 'All alert types', allLevels: 'All levels', lvl: { high: 'Urgent', medium: 'Check', low: 'Info' } as Record<AlertLevel, string>,
  kind: {
    overUse: 'Used too much fuel', weekDrop: 'Bad week', tooFewLiters: 'Too few liters for the km', overTank: 'Fill bigger than the tank',
    badKm: 'Wrong km reading', noKm: 'No km reading', pumpVar: 'Paid ≠ pump', idle: 'No fill for days', reversal: 'Reversed transaction',
    maintenance: 'Check maintenance', dropping: 'km/L dropping',
    splitJoined: 'Transactions joined (split fill)', partialJoined: 'Fills joined (not filled to full)', kmFixed: 'km reading corrected',
  } as Record<AlertKind, string>,
  alertText: (a: FuelAlert): string => {
    const i = a.info;
    switch (a.kind) {
      case 'overUse': return `${f0(i.km)} km at ${f2(i.kmL)} km/L (target ${f2(i.target)}) since ${plain(i.fromAt)}. ${f0(a.liters)} L over the margin ≈ ${f0(a.egp)} EGP.`;
      case 'weekDrop': return `Week of ${plain(i.week)}: ${f2(i.kmL)} km/L over ${f0(i.km)} km, target ${f2(i.target)}. ${f0(a.liters)} L over the margin ≈ ${f0(a.egp)} EGP.`;
      case 'tooFewLiters': return (i.open
        ? `${f0(i.km)} km since ${plain(i.fromAt)} on only ${f0(i.liters)} L (${f2(i.kmL)} km/L). The next full fill should be about ${f0(a.liters)} L. If it isn't, fuel came from outside the card or a km reading is wrong.`
        : `${f0(i.km)} km on ${f0(i.liters)} L (${f2(i.kmL)} km/L, target ${f2(i.target)}). About ${f0(a.liters)} L missing: fuel bought outside the card, or a wrong km reading.`)
        + (Number(i.revL) ? ` A ${f0(i.revL)} L transaction on ${plain(i.revAt)} was reversed in this period (#${plain(i.revIds)}): if that fuel went into the truck and was paid another way, it explains most of this.` : '');
      case 'overTank': return `${f0(i.liters)} L in one fill, the tank holds ${f0(i.tank)} L. ${f0(a.liters)} L too many ≈ ${f0(a.egp)} EGP.`;
      case 'badKm': return `km ${f0(i.km)} was skipped (${i.reason === 'sameKm' ? 'same km as the last fill' : i.reason === 'backwards' ? 'lower than the last fill' : 'too far from the last fill'}). Its ${f0(a.liters)} L moved to the next good reading.`;
      case 'noKm': return `No km reading on this fill (${f0(a.liters)} L). Its liters moved to the next good reading.`;
      case 'pumpVar': return i.rawMismatch
        ? `Transaction ${plain(i.id)}: recorded pump reading ${f2(i.pump)} vs paid amount ${f2(i.paid)}; imported variance is ${f2(i.variance)}. Source values do not reconcile. Check the original fuel-card report before editing.`
        : i.misread
          ? `Transaction ${plain(i.id)}: paid ${f2(i.paid)} but the pump photo was read as ${f2(i.pump)}. This may be a reading/import error, not missing money. Check the original report.`
          : `Transaction ${plain(i.id)}: paid and pump reading differ by ${f2(i.variance)}.`;
      case 'idle': return `Last fill ${iso(a.at.slice(0, 10))}, ${f0(i.days)} days before the last data (${plain(i.lastData)}). Parked, or fuelled outside the card?`;
      case 'reversal': return `Transaction ${plain(i.id)} of ${f0(a.liters)} L (${f0(a.egp)} EGP) was reversed.`;
      case 'maintenance': case 'dropping': return `Last ${f0(i.recentKm)} km (since ${plain(i.recentFrom)}): ${f2(i.recentKmL)} km/L. Target ${f2(i.target)} (${pctS(i.vsTargetPct)}). Its own normal before: ${i.baseKmL ? f2(i.baseKmL) : '—'} (${pctS(i.trendPct)}).${a.kind === 'maintenance' ? ' Check engine, injectors, tyres and air filter, or ask the driver.' : ' Keep an eye on it.'}`;
      case 'splitJoined': return `${f0(i.count)} transactions counted as one fill of ${f0(a.liters)} L (pump stopped and the truck refilled): # ${plain(i.ids)}.`;
      case 'partialJoined': return `${f0(i.fills)} fills since ${plain(i.fromAt)} counted together (${f0(a.liters)} L${i.open ? ', waiting for the next fill' : `, ${f0(i.km)} km = ${f2(i.kmL)} km/L`}) because one wasn't filled to full: # ${plain(i.ids)}.`;
      case 'kmFixed': return `km ${f0(i.from)} looks typed with an extra digit, used ${f0(i.to)} instead: # ${plain(i.ids)}.`;
    }
  },
  health: 'Truck health (km/L)', healthHint: (km: number) => `Each truck's last ${km.toLocaleString('en-US')} km compared with its target and with its own normal before. Closed full-to-full fills only.`,
  h_good: 'Good', h_watch: 'Watch', h_service: 'Check maintenance', h_noData: 'Not enough km yet', recent: 'Recent', normal: 'Own normal', trend: 'Trend',
  tank: 'Tank size (L)', tankHint: 'A fill bigger than this raises an alert. 0 = off.', idleDays: 'Alert when no fill for (days)', idleHint: '0 = off',
  weeklyReport: 'Weekly report', weeklyTitle: 'Weekly fuel report', thisWeek: 'This week', lastWeek: 'Last week', change: 'Change', egp: 'EGP',
  level: 'Level', alert: 'Alert', details: 'Details', L: 'L',
  summary: 'Summary', summarySub: (wk: string, last: string) => `Each truck's overall km/L (all data), this week (${wk}) and its last fill. Last upload: ${last}. Tap a truck to see all its data.`,
  overall: 'Overall', lastFill: 'Last fill', daysAgo: (n: number) => (n <= 0 ? 'same day as last upload' : `${n} day${n === 1 ? '' : 's'} before last upload`),
  noFillWeek: 'No closed fill this week yet', allTrucks2: 'All trucks', truckData: 'All data for this truck', openAlertsN: (n: number) => `${n} open alert${n === 1 ? '' : 's'}`,
  assignedDriver: 'Assigned driver', branch: 'Branch', model: 'Model', year: 'Year', truckDetails: 'Truck details', truckDetailsHint: 'Assigned driver, branch, model and year per plate number. Fuel-card driver names are never changed.',
  firstFill: 'First fill', kmTotal: 'Tracked km', fillsDone: 'Fills', overallHint: 'Overall = every closed full-to-full fill in the data, not only the filter dates.',
  reportTitle: 'Fuel consumption report', period: 'Period', flagged: 'Fills to check', generated: 'Generated',
};

const ar: typeof en = {
  tab: 'السولار',
  title: 'استهلاك السولار (كم/لتر)',
  sub: 'معاملات كارت الوقود بعد تصحيح التفويل المقسوم والتفويل الناقص والمرتجعات وقراءات العداد الخاطئة.',
  upFail: 'مقدرناش نقرا الملف ده',
  upNoHeader: (cells: string) => `ده مش تقرير «معاملات الوقود» بتاع الكارت: مفيهوش عمود رقم اللوحة ولا عمود الكمية (اللترات).${cells ? ` أول خانات فيه: ${cells}.` : ''} نزّل تقرير المعاملات من موقع الكارت (Excel أو CSV) وارفعه.`,
  upBadDate: (n: number, ex: string) => `اتشال ${n} صف لأن التاريخ مش مفهوم${ex ? ` (مثلاً «${ex}»)` : ''}. التاريخ لازم يكون زي «10 نوفمبر 2026» أو 10/11/2026. اتأكد إن عمود التاريخ ما اتغيرش في Excel.`,
  upBadLiters: (n: number, ex: string) => `اتشال ${n} صف لأن الكمية مش رقم${ex ? ` (مثلاً «${ex}»)` : ''}. غالباً دي سطور إجمالي أو سطور فاضية في آخر الشيت.`,
  upNoPlate: (n: number) => `اتشال ${n} صف لأن مفيهوش رقم لوحة.`,
  upSkipped: 'صفوف ما اتضافتش',
  appResult: 'نتيجة التطبيق (الأساس)', cardRef: 'تقرير الكارت', cardRefHint: 'للمرجعية فقط، اضغط للفتح',
  txPreview: 'معاملة الكارت', editTx: 'تعديل', saveTx: 'حفظ التعديل', cancel: 'إلغاء', restoreTx: 'رجّع الأصل', deleteTx: 'حذف المعاملة',
  deleteTxConfirm: 'حذف المعاملة دي؟ الحساب هيتعمل من غيرها.', editedTag: 'معدّلة', editedOn: (d: string) => `اتعدلت ${iso(d)}. القيم الأصلية محفوظة وممكن ترجعها.`,
  origWas: 'كانت', txSaved: 'اتحفظت المعاملة واتحسب الكم/لتر من جديد.', txDeleted: 'اتحذفت المعاملة.', txRestored: 'رجعت القيم الأصلية.', note: 'ملاحظة',
  inFill: 'في التفويلة دي', openFill: 'افتح حساب التفويلة', tapTxHint: 'اضغط على أي معاملة تشوفها أو تعدلها.', time: 'الوقت', vehicleType: 'نوع العربية', txType: 'النوع', pricePerL: 'جنيه / لتر', noChange: 'مفيش تغيير.',
  editHint: 'أي تعديل بيعيد حساب الكم/لتر للعربية فوراً. ورفع ملف جديد مش بيكتب فوق معاملة معدّلة.',
  mergedRef: 'معاملات الكارت (مرجع)', mergedHint: (n: number) => `${n} معاملات اتدمجت في حساب واحد`, startRow: 'البداية (تانك كامل)', mergedWith: 'مدموجة مع', txIds: 'أرقام معاملات الكارت', roleSplit: 'دمج (وقوف الطلمبة)', rolePartial: 'تفويل ناقص', roleFixed: 'عداد مُصحح', roleBad: 'عداد متجاهل', roleClose: 'النهاية', readFull: 'اقرأ الشرح كامل', hideFull: 'إخفاء الشرح الكامل', why: 'التفسير / طريقة الحساب', howCalc: 'إزاي اتحسبت', result: 'النتيجة', tapHint: 'اضغط على أي تفويلة علشان تشوف الكم/لتر اتحسب إزاي.', whyHealth: 'ليه الحالة دي', method: 'طريقة الحساب',
  home: 'الرئيسية', more: 'المزيد', filters: 'الفلاتر', actions: 'إجراءات', sort: 'ترتيب', done: 'تم', close: 'إغلاق',
  upload: 'رفع تقرير الوقود', uploading: 'جاري قراءة الملف…', exportXls: 'إكسل', print: 'طباعة / PDF', clearAll: 'حذف كل بيانات الوقود',
  clearConfirm: 'حذف كل معاملات الوقود المحفوظة؟ اكتب DELETE للتأكيد.',
  localNote: 'محفوظ في هذا المتصفح فقط. شغّل fuel-setup.sql في Supabase ليرى الجميع نفس البيانات.',
  empty: 'لا توجد بيانات وقود بعد. ارفع ملف "Fuel Transactions" من نظام كارت الوقود.',
  emptyViewer: 'لا توجد بيانات وقود بعد. المسؤول يرفع تقرير الكارت هنا.',
  noMatch: 'لا يوجد ما يطابق الفلاتر.',
  found: (n, from, to) => `الملف به ${n} معاملة من ${from} إلى ${to}. تمت المقارنة بالمحفوظ في النظام:`,
  upNew: 'جديدة، سيتم إضافتها', upInSystem: 'موجودة في النظام، تم تجاهلها', upRepeated: 'مكررة في الملف، تم تجاهلها',
  upOnlyNew: 'تتم إضافة المعاملات الجديدة فقط. لا يتم إضافة أي شيء محفوظ مرة أخرى.', upNothing: 'لا يوجد جديد في هذا الملف. كل شيء محفوظ بالفعل.',
  foundNone: 'لم يتم العثور على معاملات. يجب أن يحتوي الملف على أعمدة مثل Date و Plate Number و Liters و KM reading.',
  saveUpload: 'حفظ', saved: n => `تم حفظ ${n} معاملة.`,
  search: 'بحث بالسيارة أو السائق أو المحطة أو رقم المعاملة…', from: 'من', to: 'إلى', allTrucks: 'كل السيارات', allDrivers: 'كل السائقين',
  allStations: 'كل المحطات', allTypes: 'كل الأنواع', anyStatus: 'أي حالة', clear: 'مسح الفلاتر',
  liters: 'اللترات', cost: 'تكلفة السولار', charged: 'المخصوم من الكارت', fees: 'رسوم الكارت', trackedKm: 'الكيلومترات المحسوبة', fleetKmL: 'كم/لتر للأسطول',
  target: 'المستهدف', overMargin: 'فوق الهامش', checks: 'للمراجعة', fillsOutside: 'تفويلة خارج الهامش', badReadings: 'قراءة عداد خاطئة',
  perLiter: 'جنيه / لتر', auto: 'تلقائي',
  cardVsActual: 'تقرير الكارت مقابل الفعلي', cardKm: 'كم الكارت', actual: 'الفعلي', actualKm: 'كم الفعلي', cardKmL: 'كم/لتر الكارت', actualKmL: 'كم/لتر الفعلي',
  cardWrong: 'صفوف يعتبرها الكارت "Wrong"', diff: 'الفرق',
  cardVsActualHint: 'الكارت = عمود المسافة في الملف المرفوع للصفوف غير المعلمة Wrong. الفعلي = حسابنا من العداد بعد دمج التفويل المقسوم والناقص وتجاهل القراءات الخاطئة.',
  trucks: 'السيارات', drivers: 'السائقون', fills: 'التفويلات', transactions: 'المعاملات', weeks: 'أسبوعي', week: 'الأسبوع (سبت ← جمعة)', vsLastWeek: 'مقابل الأسبوع السابق', soFar: 'حتى الآن', months: 'شهري', stations: 'المحطات', settings: 'الهوامش والمستهدف',
  truck: 'السيارة', type: 'النوع', driver: 'السائق', station: 'المحطة', date: 'التاريخ', month: 'الشهر', count: 'تفويلات', txs: 'معاملات',
  km: 'كم', distance: 'المسافة', kmL: 'كم/لتر', l100: 'لتر/100كم', vsTarget: 'مقابل المستهدف', diffL: 'فرق لتر', diffEgp: 'فرق جنيه',
  overL: 'لتر فوق الهامش', loss: 'خسارة جنيه', splits: 'مقسوم', partials: 'ناقص', bad: 'عداد خاطئ', status: 'الحالة', notes: 'ملاحظات',
  fromKm: 'من كم', toKm: 'إلى كم', cardDistance: 'كم الكارت', kmDiff: 'فرق كم', amount: 'المبلغ', total: 'المخصوم', fee: 'رسوم',
  pumpVar: 'فرق الطلمبة', odometer: 'قراءة العداد', ourKm: 'كم الفعلي', cardSays: 'الكارت', flags: 'علامات', share: 'النسبة', expected: 'لتر متوقع',
  st_ok: 'طبيعي', st_high: 'استهلاك زائد', st_low: 'أفضل من المعتاد، راجع', st_pending: 'ينتظر التفويلة القادمة',
  st_badKm: 'قراءة عداد خاطئة', st_split: 'تفويل مقسوم', st_partial: 'تفويل ناقص', st_reversed: 'مرتجع',
  n_split: 'تم دمج تفويل مقسوم (الطلمبة توقفت عند 9,999)', n_partial: 'تفويل ناقص دُمج مع التالي', n_badKm: 'تم تجاهل قراءة عداد خاطئة', n_reversal: 'مرتجع', n_fixedKm: 'قراءة عداد بخانة زائدة وتم تصحيحها',
  f_reversed: 'مُلغى', f_reversal: 'مرتجع', f_split: 'مقسوم', f_badKm: 'عداد خاطئ', f_fixedKm: 'عداد مُصحح', f_opening: 'أول قراءة',
  setHint: 'المستهدف والهوامش تحدد ما هو طبيعي. اترك المستهدف فارغًا لاستخدام متوسط الأسطول لهذا النوع.',
  price: 'سعر السولار (جنيه/لتر)', priceHint: 'لتقييم اللترات فوق الهامش. 0 = من التقرير. تكلفة السولار تستخدم المدفوع فعلاً.', truckMargin: 'هامش السيارة ± %', truckMarginHint: 'للسيارة خلال الفترة كلها',
  fillMargin: 'هامش التفويلة الواحدة ± %', fillMarginHint: 'التفويلة الواحدة تتغير أكثر فلها هامش أوسع',
  splitHours: 'دمج التفويلات خلال (ساعات)', splitHoursHint: 'الطلمبة توقفت عند 9,999 جنيه وتم التفويل مرة أخرى',
  minKm: 'دمج التفويلات الأقرب من (كم)', maxKm: 'أقصى كم على تانك واحد', maxKmHint: 'القفزات الأطول قراءات خاطئة',
  typeTargets: 'المستهدف كم/لتر لكل نوع', truckTargets: 'المستهدف كم/لتر لكل سيارة', fleetAvg: 'متوسط الأسطول',
  saveSettings: 'حفظ الإعدادات', reset: 'استعادة', readOnly: 'المسؤول فقط يمكنه التغيير.',
  how: 'طريقة الحساب',
  howLines: [
    'كل تفويلة تُحسب من فل إلى فل: اللترات المضافة تعوض ما استهلكته السيارة منذ آخر تفويلة.',
    'معاملتان لنفس السيارة خلال ساعات قليلة (أو عند نفس الكيلومتر تقريبًا) تفويلة واحدة. بعض الطلمبات تتوقف عند 9,999 جنيه.',
    'التفويلة ذات كم/لتر غير منطقي لم تُملأ للآخر، فتُدمج مع التفويلة التالية.',
    'قراءة العداد المكتوبة بخانة زائدة (7552921 بدل 755292) تُصحح تلقائيًا. باقي الأخطاء ونفس الكيلومتر والقراءات الراجعة يتم تجاهلها، وتنتقل لتراتها لأول قراءة سليمة حتى تبقى الإجماليات صحيحة.',
    'المرتجع يلغي المعاملة التي يردها.',
    'فوق الهامش = اللترات الزائدة عن المسموح بعد الهامش. الخسارة = هذه اللترات × السعر.',
  ],
  alerts: 'التنبيهات', alertsBanner: n => `${n} تنبيه يحتاج مراجعة`, openAlerts: 'فتح التنبيهات',
  noAlerts: 'لا توجد تنبيهات. كل شيء داخل الهوامش.', showChecked: 'إظهار ما تمت مراجعته', markChecked: 'تمت المراجعة', undoChecked: 'تراجع',
  checkedBy: 'تمت مراجعته', allKinds: 'كل أنواع التنبيهات', allLevels: 'كل المستويات', lvl: { high: 'عاجل', medium: 'راجع', low: 'معلومة' },
  kind: {
    overUse: 'استهلاك زائد', weekDrop: 'أسبوع سيئ', tooFewLiters: 'لترات قليلة بالنسبة للكيلومترات', overTank: 'تفويلة أكبر من التانك',
    badKm: 'قراءة عداد خاطئة', noKm: 'بدون قراءة عداد', pumpVar: 'المدفوع ≠ الطلمبة', idle: 'بدون تفويل منذ أيام', reversal: 'معاملة مرتجعة',
    maintenance: 'تحتاج فحص صيانة', dropping: 'كم/لتر في انخفاض',
    splitJoined: 'معاملات تم دمجها (تفويل مقسوم)', partialJoined: 'تفويلات تم دمجها (لم تُملأ للآخر)', kmFixed: 'تم تصحيح قراءة العداد',
  },
  alertText: (a: FuelAlert): string => {
    const i = a.info;
    switch (a.kind) {
      case 'overUse': return `${f0(i.km)} كم بمعدل ${f2(i.kmL)} كم/لتر (المستهدف ${f2(i.target)}) منذ ${plain(i.fromAt)}. ${f0(a.liters)} لتر فوق الهامش ≈ ${f0(a.egp)} جنيه.`;
      case 'weekDrop': return `أسبوع ${plain(i.week)}: ${f2(i.kmL)} كم/لتر على ${f0(i.km)} كم، المستهدف ${f2(i.target)}. ${f0(a.liters)} لتر فوق الهامش ≈ ${f0(a.egp)} جنيه.`;
      case 'tooFewLiters': return (i.open
        ? `${f0(i.km)} كم منذ ${plain(i.fromAt)} على ${f0(i.liters)} لتر فقط (${f2(i.kmL)} كم/لتر). التفويلة الكاملة القادمة يجب أن تكون حوالي ${f0(a.liters)} لتر. إن لم تكن، فالسولار من خارج الكارت أو قراءة العداد خاطئة.`
        : `${f0(i.km)} كم على ${f0(i.liters)} لتر (${f2(i.kmL)} كم/لتر، المستهدف ${f2(i.target)}). حوالي ${f0(a.liters)} لتر ناقصة: سولار من خارج الكارت أو قراءة عداد خاطئة.`)
        + (Number(i.revL) ? ` في الفترة دي اتلغت معاملة ${f0(i.revL)} لتر يوم ${plain(i.revAt)} (#${plain(i.revIds)}): لو السولار ده دخل العربية واتدفع بطريقة تانية، فده بيفسر أغلب الفرق.` : '');
      case 'overTank': return `${f0(i.liters)} لتر في تفويلة واحدة والتانك ${f0(i.tank)} لتر. زيادة ${f0(a.liters)} لتر ≈ ${f0(a.egp)} جنيه.`;
      case 'badKm': return `تم تجاهل العداد ${f0(i.km)} (${i.reason === 'sameKm' ? 'نفس كيلومتر التفويلة السابقة' : i.reason === 'backwards' ? 'أقل من التفويلة السابقة' : 'بعيد جدًا عن التفويلة السابقة'}). انتقلت ${f0(a.liters)} لتر لأول قراءة سليمة.`;
      case 'noKm': return `بدون قراءة عداد في هذه التفويلة (${f0(a.liters)} لتر). انتقلت لتراتها لأول قراءة سليمة.`;
      case 'pumpVar': return i.rawMismatch
        ? `المعاملة ${plain(i.id)}: قراءة الطلمبة المسجلة ${f2(i.pump)} مقابل المدفوع ${f2(i.paid)}، رغم أن فرق التقرير ${f2(i.variance)}. القيم غير متطابقة؛ راجع تقرير الكارت الأصلي قبل أي تعديل.`
        : i.misread
          ? `المعاملة ${plain(i.id)}: المدفوع ${f2(i.paid)} لكن قراءة صورة الطلمبة ${f2(i.pump)}. قد يكون خطأ قراءة أو استيراد، وليس نقصًا في الأموال. راجع التقرير الأصلي.`
          : `المعاملة ${plain(i.id)}: فرق بين المدفوع وقراءة الطلمبة ${f2(i.variance)}.`;
      case 'idle': return `آخر تفويلة ${iso(a.at.slice(0, 10))}، قبل آخر بيانات (${plain(i.lastData)}) بـ ${f0(i.days)} يوم. واقفة أم تم التفويل خارج الكارت؟`;
      case 'reversal': return `المعاملة ${plain(i.id)} بـ ${f0(a.liters)} لتر (${f0(a.egp)} جنيه) تم إرجاعها.`;
      case 'maintenance': case 'dropping': return `آخر ${f0(i.recentKm)} كم (منذ ${plain(i.recentFrom)}): ${f2(i.recentKmL)} كم/لتر. المستهدف ${f2(i.target)} (${pctS(i.vsTargetPct)}). معدلها المعتاد قبل ذلك: ${i.baseKmL ? f2(i.baseKmL) : '—'} (${pctS(i.trendPct)}).${a.kind === 'maintenance' ? ' افحص الموتور والرشاشات والكاوتش وفلتر الهواء أو اسأل السائق.' : ' تابعها.'}`;
      case 'splitJoined': return `${f0(i.count)} معاملات حُسبت كتفويلة واحدة ${f0(a.liters)} لتر (الطلمبة توقفت وتم التفويل مرة أخرى): # ${plain(i.ids)}.`;
      case 'partialJoined': return `${f0(i.fills)} تفويلات منذ ${plain(i.fromAt)} حُسبت معًا (${f0(a.liters)} لتر${i.open ? '، في انتظار التفويلة القادمة' : `، ${f0(i.km)} كم = ${f2(i.kmL)} كم/لتر`}) لأن إحداها لم تُملأ للآخر: # ${plain(i.ids)}.`;
      case 'kmFixed': return `العداد ${f0(i.from)} مكتوب بخانة زائدة على الأرجح، تم استخدام ${f0(i.to)}: # ${plain(i.ids)}.`;
    }
  },
  health: 'حالة السيارات (كم/لتر)', healthHint: km => `آخر ${km.toLocaleString('en-US')} كم لكل سيارة مقارنة بالمستهدف وبمعدلها المعتاد قبل ذلك. التفويلات الكاملة فقط.`,
  h_good: 'جيدة', h_watch: 'تابعها', h_service: 'تحتاج فحص صيانة', h_noData: 'كيلومترات غير كافية بعد', recent: 'الأخير', normal: 'المعتاد', trend: 'الاتجاه',
  tank: 'سعة التانك (لتر)', tankHint: 'التفويلة الأكبر من ذلك تعطي تنبيه. 0 = إيقاف.', idleDays: 'تنبيه عند عدم التفويل لمدة (أيام)', idleHint: '0 = إيقاف',
  weeklyReport: 'التقرير الأسبوعي', weeklyTitle: 'تقرير السولار الأسبوعي', thisWeek: 'هذا الأسبوع', lastWeek: 'الأسبوع السابق', change: 'التغير', egp: 'جنيه',
  level: 'المستوى', alert: 'التنبيه', details: 'التفاصيل', L: 'لتر',
  summary: 'الملخص', summarySub: (wk: string, last: string) => `الكم/لتر الإجمالي لكل عربية (كل البيانات)، وهذا الأسبوع (${iso(wk)})، وآخر تفويل. آخر رفع: ${iso(last)}. اضغط على أي عربية تشوف كل بياناتها.`,
  overall: 'الإجمالي', lastFill: 'آخر تفويل', daysAgo: (n: number) => (n <= 0 ? 'نفس يوم آخر رفع' : `قبل آخر رفع بـ ${iso(String(n))} يوم`),
  noFillWeek: 'مفيش تفويلة مقفولة الأسبوع ده لسه', allTrucks2: 'كل العربيات', truckData: 'كل بيانات العربية', openAlertsN: (n: number) => `${iso(String(n))} تنبيه مفتوح`,
  assignedDriver: 'السائق المسؤول', branch: 'الفرع', model: 'الموديل', year: 'سنة الصنع', truckDetails: 'بيانات الشاحنات', truckDetailsHint: 'السائق المسؤول والفرع والموديل وسنة الصنع لكل رقم لوحة. أسماء السائقين في كارت الوقود لا تتغير.',
  firstFill: 'أول تفويل', kmTotal: 'الكيلومترات المحسوبة', fillsDone: 'التفويلات', overallHint: 'الإجمالي = كل تفويلة من تانك كامل لتانك كامل في البيانات، مش بس تواريخ الفلتر.',
  reportTitle: 'تقرير استهلاك السولار', period: 'الفترة', flagged: 'تفويلات للمراجعة', generated: 'تاريخ الإصدار',
};

export const FUEL_STRINGS: Record<Lang, typeof en> = { en, ar };
export type FuelStrings = typeof en;
