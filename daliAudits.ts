/**
 * Deterministic "audit" reports for the screens that used to ask an AI model for a
 * written analysis (Intelligence views, Financial Audit Reports, Access review).
 * They read the exact data the screen already sends and produce a factual summary.
 * No model, no network, no limit.
 */

const nf = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US');
const egp = (n: number) => 'EGP ' + nf(n);
const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

function parseJsonAfter(prompt: string, marker: string): any | null {
  const i = prompt.indexOf(marker);
  if (i < 0) return null;
  const text = prompt.slice(i + marker.length).trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  // find the matching end by trying progressively (the JSON is the last block of the prompt)
  const body = text.slice(start);
  try { return JSON.parse(body); } catch { /* fall through */ }
  const last = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  try { return JSON.parse(body.slice(0, last + 1)); } catch { return null; }
}

// ───────────────────────── Intelligence screen (4 views) ─────────────────────────

function intelligenceReport(prompt: string): string | null {
  const view = prompt.match(/CURRENT VIEW:\s*([A-Z ]+)\n/)?.[1]?.trim();
  if (!view) return null;
  const ar = /Arabic only/i.test(prompt);
  const L = (en: string, a: string) => (ar ? a : en);
  const d = parseJsonAfter(prompt, 'LIVE DATA:');
  if (!d) return null;
  const out: string[] = [];

  if (view === 'PORTS') {
    const ports: any[] = d.portStats || [];
    const busiest = [...ports].sort((a, b) => b.active - a.active)[0];
    const richest = [...ports].sort((a, b) => b.stock - a.stock)[0];
    const totalActive = ports.reduce((s, p) => s + (p.active || 0), 0);
    const totalStock = ports.reduce((s, p) => s + (p.stock || 0), 0);
    out.push(L(`• Active operations across ports: ${totalActive}; gensets in stock: ${totalStock}.`, `• العمليات النشطة في كل الموانئ: ${totalActive}؛ المولدات في المخزون: ${totalStock}.`));
    if (busiest && busiest.active > 0) out.push(L(`• Busiest port: ${busiest.port} with ${busiest.active} active operation(s) and ${busiest.stock} in stock.`, `• أكثر ميناء نشاطاً: ${busiest.port} (${busiest.active} عملية نشطة، ${busiest.stock} في المخزون).`));
    if (richest) out.push(L(`• Largest stock: ${richest.port} (${richest.stock}).`, `• أكبر مخزون: ${richest.port} (${richest.stock}).`));
    const short = ports.filter(p => p.active > 0 && p.stock === 0);
    if (short.length) out.push(L(`• ⚠ No stock left at: ${short.map(p => p.port).join(', ')} while operations are active.`, `• ⚠ لا يوجد مخزون في: ${short.map(p => p.port).join('، ')} مع وجود عمليات نشطة.`));
    ports.filter(p => p.fuel > 0).sort((a, b) => b.fuel - a.fuel).slice(0, 3)
      .forEach(p => out.push(L(`• Fuel logged at ${p.port}: ${nf(p.fuel)} L.`, `• الوقود المسجل في ${p.port}: ${nf(p.fuel)} لتر.`)));
  } else if (view === 'FLEET ASSETS') {
    const f = d.fleet || {};
    const total = f.total || 0;
    out.push(L(`• Fleet: ${total} gensets – in stock ${f.inStock}, clipped on ${f.clippedOn}, maintenance ${f.maintenance}, retired ${f.retired}.`, `• الأسطول: ${total} مولد – مخزون ${f.inStock}، مركب ${f.clippedOn}، صيانة ${f.maintenance}، متقاعد ${f.retired}.`));
    const usable = total - (f.retired || 0);
    if (usable > 0) out.push(L(`• Utilisation (clipped on / non-retired): ${pct(((f.clippedOn || 0) / usable) * 100)}; in maintenance: ${pct(((f.maintenance || 0) / usable) * 100)}.`, `• نسبة التشغيل (المركب ÷ غير المتقاعد): ${pct(((f.clippedOn || 0) / usable) * 100)}؛ في الصيانة: ${pct(((f.maintenance || 0) / usable) * 100)}.`));
    const dups: any[] = f.duplicateActiveGensets || [];
    if (dups.length) out.push(L(`• ⚠ ${dups.length} genset(s) assigned to more than one active operation: ${dups.slice(0, 8).map(x => x[0]).join(', ')}. (Alert only – saving is not blocked.)`, `• ⚠ ${dups.length} مولد مرتبط بأكثر من عملية نشطة: ${dups.slice(0, 8).map(x => x[0]).join('، ')}. (تنبيه فقط – الحفظ غير ممنوع.)`));
    else out.push(L('• No duplicate active genset assignments.', '• لا توجد مولدات مكررة في عمليات نشطة.'));
  } else if (view === 'FUEL LEDGER') {
    const byPort: Record<string, number> = d.gasByPort || {};
    const total = Object.values(byPort).reduce((s, v) => s + (Number(v) || 0), 0);
    const top = Object.entries(byPort).sort((a, b) => b[1] - a[1])[0];
    out.push(L(`• Total fuel logged: ${nf(total)} L.`, `• إجمالي الوقود المسجل: ${nf(total)} لتر.`));
    if (top && total > 0) out.push(L(`• Highest consumption: ${top[0]} – ${nf(top[1])} L (${pct((top[1] / total) * 100)} of total).`, `• أعلى استهلاك: ${top[0]} – ${nf(top[1])} لتر (${pct((top[1] / total) * 100)} من الإجمالي).`));
    const units: any[] = d.gasByGenset || [];
    units.sort((a, b) => b.gas - a.gas).slice(0, 3).forEach(u => out.push(L(`• Genset ${u.unit}: ${nf(u.gas)} L.`, `• المولد ${u.unit}: ${nf(u.gas)} لتر.`)));
    if (d.oktan) out.push(L(`• Fuel balance: ${egp(d.oktan.balance)} (≈ ${nf(d.oktan.estimatedLiters)} L), about ${d.oktan.daysRemaining} day(s) of coverage at ${d.oktan.dailyAvg} L/day.`, `• رصيد الوقود: ${egp(d.oktan.balance)} (≈ ${nf(d.oktan.estimatedLiters)} لتر)، تكفي حوالي ${d.oktan.daysRemaining} يوم بمعدل ${d.oktan.dailyAvg} لتر/يوم.`));
  } else if (view === 'OPERATIONS') {
    const s = d.summary || {};
    out.push(L(`• Operations: ${s.total} total – done ${s.completed}, in progress ${s.active}, under operate ${s.underOperate}, hold ${s.hold}, cancelled ${s.cancelled}.`, `• العمليات: ${s.total} – مكتملة ${s.completed}، جارية ${s.active}، تحت التشغيل ${s.underOperate}، معلقة ${s.hold}، ملغاة ${s.cancelled}.`));
    out.push(L(`• Completion rate ${pct(s.completionRate)}, cancellation rate ${pct(s.cancellationRate)}.`, `• نسبة الإنجاز ${pct(s.completionRate)}، نسبة الإلغاء ${pct(s.cancellationRate)}.`));
    out.push(L(`• Completed value: ${egp(s.completedRevenue)}; value still in progress: ${egp(s.activeExposure)}.`, `• قيمة المكتمل: ${egp(s.completedRevenue)}؛ قيمة الجاري: ${egp(s.activeExposure)}.`));
    const m = s.missingData || {};
    const gaps = [[m.container, L('container number', 'رقم الحاوية')], [m.genset, L('genset number', 'رقم المولد')], [m.rate, L('rate', 'السعر')], [m.trucker, L('trucker', 'الناقل')], [m.clipOff, L('clip-off date on DONE jobs', 'تاريخ الفك على العمليات المكتملة')]].filter(([n]) => (n as number) > 0);
    if (gaps.length) out.push(L('• Data gaps: ' + gaps.map(([n, l]) => `${n} missing ${l}`).join('; ') + '.', '• نواقص البيانات: ' + gaps.map(([n, l]) => `${n} بدون ${l}`).join('؛ ') + '.'));
  } else return null;

  return out.join('\n');
}

// ───────────────────────── Financial audit (Reports screen) ─────────────────────────

function revenueAudit(prompt: string): string | null {
  if (!/REVENUE REPORT DATA/.test(prompt)) return null;
  const ar = /Respond in Arabic/i.test(prompt);
  const L = (en: string, a: string) => (ar ? a : en);
  const grab = (label: string) => parseFloat((prompt.match(new RegExp(label + ':\\s*(?:EGP\\s*)?([\\d,\\.]+)'))?.[1] || '0').replace(/,/g, '')) || 0;
  const count = grab('Total Bookings'), base = grab('Base Revenue'), vat = grab('Collected VAT'), total = grab('Total Inflow');
  if (!count) return L('1. No bookings fall in this range, so there is nothing to audit.', '1. لا توجد حجوزات في هذا النطاق، فلا يوجد ما يُراجع.');
  const rate = base > 0 ? (vat / base) * 100 : 0;
  const out = [
    L(`1. Volume and value: ${count} booking(s) bring ${egp(total)} (base ${egp(base)} + VAT ${egp(vat)}); average ${egp(base / count)} base per booking.`, `1. الحجم والقيمة: ${count} حجز بإجمالي ${egp(total)} (الأساس ${egp(base)} + الضريبة ${egp(vat)})؛ متوسط ${egp(base / count)} أساس لكل حجز.`),
  ];
  if (Math.abs(rate - 14) <= 0.5) out.push(L(`2. VAT check: collected VAT is ${pct(rate)} of base revenue, consistent with the 14% Egyptian VAT rate.`, `2. فحص الضريبة: الضريبة المحصلة ${pct(rate)} من الإيراد الأساسي، وهي متسقة مع ضريبة القيمة المضافة 14%.`));
  else out.push(L(`2. ⚠ VAT check: collected VAT is ${pct(rate)} of base revenue versus the expected 14% (≈ ${egp(base * 0.14)}). The difference of ${egp(vat - base * 0.14)} should be reviewed (zero-rated or missing VAT on some bookings?).`, `2. ⚠ فحص الضريبة: الضريبة المحصلة ${pct(rate)} من الإيراد الأساسي مقابل 14% المتوقعة (≈ ${egp(base * 0.14)}). الفرق ${egp(vat - base * 0.14)} يحتاج مراجعة (حجوزات معفاة أو بدون ضريبة؟).`));
  out.push(L(`3. Total inflow ${egp(total)} reconciles with base + VAT: ${Math.abs(total - base - vat) < 1 ? 'yes' : 'NO – check the figures'}.`, `3. إجمالي التدفق ${egp(total)} يطابق الأساس + الضريبة: ${Math.abs(total - base - vat) < 1 ? 'نعم' : 'لا – راجع الأرقام'}.`));
  return out.join('\n');
}

// ───────────────────────── Access review (User Management) ─────────────────────────

function accessAudit(prompt: string): string | null {
  if (!/Cybersecurity & Authorization Auditor/.test(prompt)) return null;
  const ar = /Respond in Arabic/i.test(prompt);
  const L = (en: string, a: string) => (ar ? a : en);
  const users: any[] = parseJsonAfter(prompt, 'permissions:') || [];
  if (!Array.isArray(users) || !users.length) return null;
  const by = (r: string) => users.filter(u => String(u.role).toUpperCase() === r);
  const admins = by('ADMIN'), revoked = users.filter(u => u.revoked);
  const staff = users.filter(u => String(u.role).toUpperCase() !== 'CUSTOMER');
  const noPorts = staff.filter(u => !['ADMIN'].includes(String(u.role).toUpperCase()) && !(u.ports && u.ports.length));
  const out = [
    L(`• ${users.length} accounts: ${admins.length} admin, ${by('MANAGER').length} manager, ${by('GATE_OPERATOR').length} gate operator, ${by('VIEWER').length} viewer, ${by('CUSTOMER').length} customer.`, `• ${users.length} حساب: ${admins.length} مدير نظام، ${by('MANAGER').length} مدير، ${by('GATE_OPERATOR').length} مشغل بوابة، ${by('VIEWER').length} مشاهد، ${by('CUSTOMER').length} عميل.`),
    admins.length > 3
      ? L(`• ⚠ ${admins.length} admin accounts – keep this to the minimum needed: ${admins.map(u => u.name).join(', ')}.`, `• ⚠ ${admins.length} حسابات مدير نظام – يفضل تقليلها: ${admins.map(u => u.name).join('، ')}.`)
      : L(`• Admin count is reasonable (${admins.length}).`, `• عدد مديري النظام مقبول (${admins.length}).`),
    revoked.length ? L(`• ${revoked.length} revoked account(s): ${revoked.slice(0, 8).map(u => u.name).join(', ')}.`, `• ${revoked.length} حساب موقوف: ${revoked.slice(0, 8).map(u => u.name).join('، ')}.`) : L('• No revoked accounts.', '• لا توجد حسابات موقوفة.'),
    noPorts.length ? L(`• ⚠ ${noPorts.length} staff account(s) without assigned ports: ${noPorts.slice(0, 8).map(u => u.name).join(', ')}.`, `• ⚠ ${noPorts.length} حساب موظف بدون موانئ محددة: ${noPorts.slice(0, 8).map(u => u.name).join('، ')}.`) : L('• All non-admin staff have ports assigned.', '• كل الموظفين (غير المديرين) لديهم موانئ محددة.'),
    L('• Recommendation: rotate passwords for admin and gate accounts regularly and revoke accounts of anyone who has left. (This review checks roles, ports and revoked status only – it cannot see password age.)', '• توصية: غيّر كلمات مرور حسابات المديرين والبوابة بشكل دوري، وأوقف حسابات من غادر العمل. (المراجعة تفحص الأدوار والموانئ والإيقاف فقط – ولا ترى عمر كلمة المرور.)'),
  ];
  return out.join('\n');
}

/** Returns a deterministic report when the prompt is one of the known audit prompts. */
export function auditFromPrompt(prompt: string): string | null {
  return intelligenceReport(prompt) ?? revenueAudit(prompt) ?? accessAudit(prompt);
}
