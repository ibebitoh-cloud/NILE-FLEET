import { db } from './supabaseDb';
import { GensetStatus, Location, ReservationStatus } from '../types';

/**
 * DALI proactive alerts: things worth acting on, computed from the live data the
 * app already has loaded. No model call and no extra query, so it is free to run
 * whenever the data changes.
 */

export type DaliAlert = {
  id: string;
  level: 'critical' | 'warning' | 'info';
  topic: 'maintenance' | 'requests' | 'stock' | 'invoices';
  text: string;
  /** Question DALI answers when the user taps the alert. */
  ask: string;
};

export type DaliAlertScope = {
  /** Only port-based alerts for these ports. Empty means all ports. */
  ports?: string[];
  /** Topics this user should see. Empty means all topics. */
  topics?: DaliAlert['topic'][];
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toKey = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const list = (items: string[], max = 6) => items.slice(0, max).join(', ') + (items.length > max ? ` +${items.length - max}` : '');

export function getDaliAlerts(ar: boolean, scope: DaliAlertScope = {}, now = new Date()): DaliAlert[] {
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const ports = (scope.ports || []).map(p => String(p).toUpperCase());
  const portOk = (p: unknown) => !ports.length || ports.includes(String(p || '').toUpperCase());
  const topicOk = (t: DaliAlert['topic']) => !scope.topics?.length || scope.topics.includes(t);
  const alerts: DaliAlert[] = [];

  const gensets = db.getStock().filter(g => g.status !== GensetStatus.RETIRED && portOk(g.location));

  if (topicOk('maintenance')) {
    const overdue = gensets.filter(g => { const due = toKey(g.nextMaintenanceDue); return due && due < today; });
    if (overdue.length) alerts.push({
      id: 'maintenance-overdue', level: 'warning', topic: 'maintenance',
      text: ar ? `${overdue.length} مولد فات موعد صيانته: ${list(overdue.map(g => g.unitNumber))}` : `${overdue.length} genset(s) are past their service date: ${list(overdue.map(g => g.unitNumber))}`,
      ask: ar ? 'المولدات اللي فات موعد صيانتها' : 'Which gensets are past their next service date?',
    });
    const longJobs = db.getMaintenanceLogs().filter(l => {
      const start = toKey(l.serviceDate);
      return l.status === 'IN_PROGRESS' && start && daysBetween(start, today) >= 7 && portOk(l.location);
    });
    if (longJobs.length) alerts.push({
      id: 'maintenance-long', level: 'warning', topic: 'maintenance',
      text: ar ? `${longJobs.length} صيانة مفتوحة من أكثر من ٧ أيام: ${list(longJobs.map(l => l.gensetNumber))}` : `${longJobs.length} maintenance job(s) open for more than 7 days: ${list(longJobs.map(l => l.gensetNumber))}`,
      ask: ar ? 'المولدات اللي في الصيانة من أكثر من أسبوع' : 'Which gensets have been in maintenance for more than a week?',
    });
  }

  const operations = db.getOperations();
  const loaded = new Set(operations.map(o => o.reservationId).filter(Boolean));
  const open = db.getReservations().filter(r =>
    (r.status === ReservationStatus.PENDING || r.status === ReservationStatus.APPROVED) && !loaded.has(r.id) && portOk(r.portIn));

  if (topicOk('requests')) {
    const due = open.filter(r => { const d = toKey(r.reservationDate); return d && d <= tomorrow; });
    const late = due.filter(r => toKey(r.reservationDate) < today);
    if (late.length) alerts.push({
      id: 'requests-late', level: 'critical', topic: 'requests',
      text: ar ? `${late.length} طلب تاريخه عدّى ولسه متحملش في العمليات: ${list(late.map(r => r.bookingNumber || r.customerName))}` : `${late.length} request(s) are past their date and still not loaded into Operations: ${list(late.map(r => r.bookingNumber || r.customerName))}`,
      ask: ar ? 'الطلبات المتأخرة اللي لسه متحملتش' : 'Which requests are past their date and not loaded yet?',
    });
    const soon = due.filter(r => toKey(r.reservationDate) >= today);
    if (soon.length) {
      const units = soon.reduce((n, r) => n + (Number(r.gensetsNeeded) || 0), 0);
      alerts.push({
        id: 'requests-soon', level: 'info', topic: 'requests',
        text: ar ? `${soon.length} طلب (${units} مولد) مطلوب النهارده أو بكرة ولسه متحملش` : `${soon.length} request(s) (${units} gensets) are due today or tomorrow and not loaded yet`,
        ask: ar ? 'طلبات النهارده وبكرة اللي لسه متحملتش' : 'Show requests for today and tomorrow that are not loaded yet',
      });
    }
    const waiting = open.filter(r => r.status === ReservationStatus.PENDING && toKey(r.dateReceived) && daysBetween(toKey(r.dateReceived), today) >= 2);
    if (waiting.length) alerts.push({
      id: 'requests-waiting', level: 'info', topic: 'requests',
      text: ar ? `${waiting.length} طلب مستني الموافقة من يومين أو أكثر` : `${waiting.length} request(s) have waited 2+ days for approval`,
      ask: ar ? 'الطلبات اللي مستنية الموافقة' : 'Which requests are still waiting for approval?',
    });
  }

  if (topicOk('stock')) {
    // Compare free units at each port with what is requested there for today and tomorrow.
    const demand = new Map<string, number>();
    open.filter(r => { const d = toKey(r.reservationDate); return d >= today && d <= tomorrow; })
      .forEach(r => demand.set(String(r.portIn), (demand.get(String(r.portIn)) || 0) + (Number(r.gensetsNeeded) || 0)));
    const short: string[] = [];
    demand.forEach((needed, port) => {
      if (port === Location.WORKSHOP) return;
      const free = gensets.filter(g => g.location === port && g.status === GensetStatus.IN_STOCK).length;
      if (needed > free) short.push(ar ? `${port}: مطلوب ${needed}، متاح ${free}` : `${port}: ${needed} needed, ${free} free`);
    });
    if (short.length) alerts.push({
      id: 'stock-short', level: 'critical', topic: 'stock',
      text: ar ? `مخزون غير كافٍ لطلبات النهارده وبكرة — ${short.join(' | ')}` : `Not enough free gensets for today's and tomorrow's requests: ${short.join(' | ')}`,
      ask: ar ? 'المخزون في كل ميناء' : 'Stock in each port',
    });
  }

  if (topicOk('invoices')) {
    const overdue = db.getInvoices().filter(i => i.status === 'UNPAID' && toKey(i.dueDate) && toKey(i.dueDate) < today);
    if (overdue.length) {
      const customers = new Set(overdue.map(i => i.customerName)).size;
      alerts.push({
        id: 'invoices-overdue', level: 'warning', topic: 'invoices',
        text: ar ? `${overdue.length} فاتورة متأخرة السداد عند ${customers} عميل` : `${overdue.length} unpaid invoice(s) past their due date across ${customers} customer(s)`,
        ask: ar ? 'الفواتير المتأخرة السداد' : 'Which invoices are overdue?',
      });
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}
