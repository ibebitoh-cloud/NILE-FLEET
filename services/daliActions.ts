import { db } from './supabaseDb';
import { norm } from '../daliEngine';
import { GensetMaintenanceLog, Location, MaintenanceServiceType, Reservation, ReservationStatus, UserRole } from '../types';
import type { DaliCustomerAlias } from './daliCustomerAliases';

/**
 * DALI actions: staff can ask DALI to record or change something. The model only
 * reads the request into fields; this file checks them against live data and builds
 * a plan that the user must confirm before anything is saved. Saves go through the
 * normal db layer, so Supabase row-level security still decides who may write.
 */

export type DaliActionPlan = {
  kind: 'log_maintenance' | 'create_reservation' | 'set_reservation_status';
  title: string;
  lines: string[];
  execute: () => Promise<boolean>;
};

export type DaliActionResult =
  | { status: 'none' }
  | { status: 'missing'; message: string }
  | { status: 'ready'; plan: DaliActionPlan };

const ACTION_WORDS = [
  'log', 'record', 'register', 'add', 'create', 'new', 'book', 'schedule', 'open', 'approve', 'cancel', 'complete', 'mark', 'set',
  'سجل', 'سجلي', 'ضيف', 'اضف', 'أضف', 'اعمل', 'اعملي', 'احجز', 'احجزلي', 'افتح', 'وافق', 'اعتمد', 'الغي', 'الغاء', 'إلغاء', 'خلص', 'قفل',
  'sagel', 'sagal', 'dayef', 'e3mel', 'e7gez', 'walghi', 'elghi',
];
const ACTION_TOPICS = [
  'maintenance', 'service', 'repair', 'oil', 'filter', 'reservation', 'booking', 'request',
  'صيانه', 'صيانة', 'تصليح', 'زيت', 'فلتر', 'حجز', 'طلب', 'بوكينج', 'sayana', '7agz',
  'genset', 'gensets', 'مولد', 'مولدات', 'مولدين',
];

/** Cheap pre-check so ordinary questions never pay for the extra model call. */
export function looksLikeAction(question: string): boolean {
  const nq = ` ${norm(question)} `;
  if (/[?؟]\s*$/.test(question.trim()) && !/^(can you|could you|please|ممكن|لو سمحت)/i.test(question.trim())) return false;
  const hit = (words: string[]) => words.some(w => nq.includes(` ${norm(w)} `));
  return hit(ACTION_WORDS) && hit(ACTION_TOPICS);
}

const SERVICE_TYPES: MaintenanceServiceType[] = ['OIL_CHANGE', 'FILTER_REPLACEMENT', 'ENGINE_OVERHAUL', 'ELECTRICAL_CHECK', 'ROUTINE_INSPECTION', 'EMERGENCY_REPAIR', 'GENERAL_SERVICE', 'RADIATOR'];
const PORTS = Object.values(Location).filter(p => p !== Location.WORKSHOP) as Location[];
const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const unitKey = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function findCustomer(name: string, aliases: DaliCustomerAlias[]) {
  const customers = db.getUsers().filter(u => String(u.role || '').toUpperCase() === UserRole.CUSTOMER);
  const n = norm(name);
  if (!n) return undefined;
  const alias = aliases.find(a => norm(a.alias) === n);
  if (alias) return customers.find(c => String(c.id) === String(alias.customer_id));
  const exact = customers.find(c => [c.companyName, c.name, c.companyNameAr].some(v => v && norm(v) === n));
  if (exact) return exact;
  const partial = customers.filter(c => [c.companyName, c.name, c.companyNameAr].some(v => v && (norm(v).includes(n) || n.includes(norm(v)))));
  return partial.length === 1 ? partial[0] : undefined;
}

export function planDaliAction(raw: Record<string, any>, ar: boolean, aliases: DaliCustomerAlias[] = []): DaliActionResult {
  const type = String(raw?.type || 'none');
  const missing = (fields: string[]) => ({
    status: 'missing' as const,
    message: ar ? `محتاج أعرف: ${fields.join('، ')} عشان أقدر أنفذ الطلب.` : `I need ${fields.join(', ')} before I can do that.`,
  });

  if (type === 'log_maintenance') {
    const wanted = unitKey(raw.gensetNumber);
    if (!wanted) return missing([ar ? 'رقم المولد' : 'the genset number']);
    const unit = db.getStock().find(g => unitKey(g.unitNumber) === wanted);
    if (!unit) return { status: 'missing', message: ar ? `مش لاقي مولد رقم ${raw.gensetNumber} في المخزون.` : `I can't find genset ${raw.gensetNumber} in the stock list.` };
    const serviceType = (SERVICE_TYPES.includes(raw.serviceType) ? raw.serviceType : 'GENERAL_SERVICE') as MaintenanceServiceType;
    const status = (['IN_PROGRESS', 'SCHEDULED', 'COMPLETED'].includes(raw.status) ? raw.status : 'IN_PROGRESS') as GensetMaintenanceLog['status'];
    const serviceDate = isDate(raw.serviceDate) ? raw.serviceDate : todayKey();
    const log: GensetMaintenanceLog = {
      id: `maint-${Date.now()}`,
      gensetNumber: unit.unitNumber,
      serviceDate,
      serviceType,
      technician: String(raw.technician || '').trim(),
      location: (unit.location || Location.WORKSHOP) as Location,
      cost: Math.max(Number(raw.cost) || 0, 0),
      status,
      description: String(raw.description || '').trim() || (ar ? 'سُجلت عن طريق دالي' : 'Logged by DALI'),
      ...(status === 'COMPLETED' ? { completedDate: serviceDate } : {}),
    };
    return {
      status: 'ready',
      plan: {
        kind: 'log_maintenance',
        title: ar ? 'تسجيل صيانة' : 'Log maintenance',
        lines: [
          `${ar ? 'المولد' : 'Genset'}: ${log.gensetNumber} (${log.location})`,
          `${ar ? 'النوع' : 'Type'}: ${serviceType.replace(/_/g, ' ')}`,
          `${ar ? 'الحالة' : 'Status'}: ${status.replace(/_/g, ' ')}`,
          `${ar ? 'التاريخ' : 'Date'}: ${serviceDate}`,
          ...(log.technician ? [`${ar ? 'الفني' : 'Technician'}: ${log.technician}`] : []),
          ...(raw.description ? [`${ar ? 'الوصف' : 'Notes'}: ${log.description}`] : []),
        ],
        execute: () => db.addMaintenanceLog(log),
      },
    };
  }

  if (type === 'create_reservation') {
    const need: string[] = [];
    const customer = findCustomer(String(raw.customerName || ''), aliases);
    if (!customer) need.push(raw.customerName ? (ar ? `عميل مسجل باسم "${raw.customerName}"` : `a registered customer matching "${raw.customerName}"`) : (ar ? 'اسم العميل' : 'the customer'));
    const bookingNumber = String(raw.bookingNumber || '').trim();
    if (!bookingNumber) need.push(ar ? 'رقم الحجز' : 'the booking number');
    const gensetsNeeded = Math.round(Number(raw.gensetsNeeded) || 0);
    if (gensetsNeeded < 1 || gensetsNeeded > 100) need.push(ar ? 'عدد المولدات' : 'how many gensets');
    const portIn = PORTS.includes(raw.portIn) ? raw.portIn as Location : undefined;
    const portOut = PORTS.includes(raw.portOut) ? raw.portOut as Location : portIn;
    if (!portIn) need.push(ar ? 'ميناء التركيب' : 'the clip-on port');
    if (need.length) return missing(need);
    if (db.getReservations().some(r => unitKey(r.bookingNumber) === unitKey(bookingNumber) && r.status !== ReservationStatus.CANCELLED)) {
      return { status: 'missing', message: ar ? `يوجد بالفعل طلب بنفس رقم الحجز ${bookingNumber}.` : `There is already a request with booking ${bookingNumber}.` };
    }
    const reservationDate = isDate(raw.reservationDate) ? raw.reservationDate : todayKey();
    const res: Reservation = {
      id: `res-${Date.now()}`,
      customerId: customer!.id,
      customerName: customer!.companyName || customer!.name,
      bookingNumber,
      gensetsNeeded,
      portIn: portIn!,
      portOut: portOut!,
      reservationDate,
      status: ReservationStatus.PENDING,
      ...(raw.shipper ? { shipper: String(raw.shipper) } : {}),
    };
    return {
      status: 'ready',
      plan: {
        kind: 'create_reservation',
        title: ar ? 'طلب حجز جديد' : 'New reservation',
        lines: [
          `${ar ? 'العميل' : 'Customer'}: ${res.customerName}`,
          `${ar ? 'رقم الحجز' : 'Booking'}: ${bookingNumber}`,
          `${ar ? 'عدد المولدات' : 'Gensets'}: ${gensetsNeeded}`,
          `${ar ? 'الموانئ' : 'Ports'}: ${res.portIn} → ${res.portOut}`,
          `${ar ? 'التاريخ' : 'Date'}: ${reservationDate}`,
        ],
        execute: async () => {
          const before = db.getReservations().length;
          await db.addReservation(res);
          return db.getReservations().length > before;
        },
      },
    };
  }

  if (type === 'set_reservation_status') {
    const bookingNumber = unitKey(raw.bookingNumber);
    const status = ['APPROVED', 'CANCELLED', 'COMPLETED'].includes(raw.status) ? raw.status as ReservationStatus : undefined;
    if (!bookingNumber || !status) return missing([...(!bookingNumber ? [ar ? 'رقم الحجز' : 'the booking number'] : []), ...(!status ? [ar ? 'الحالة الجديدة' : 'the new status'] : [])]);
    const matches = db.getReservations().filter(r => unitKey(r.bookingNumber) === bookingNumber);
    if (matches.length !== 1) {
      return { status: 'missing', message: matches.length
        ? (ar ? `فيه أكثر من طلب برقم ${raw.bookingNumber}، غيّر الحالة من شاشة الحجوزات.` : `More than one request has booking ${raw.bookingNumber}; please change it from the Reservations screen.`)
        : (ar ? `مش لاقي طلب برقم ${raw.bookingNumber}.` : `I can't find a request with booking ${raw.bookingNumber}.`) };
    }
    const r = matches[0];
    return {
      status: 'ready',
      plan: {
        kind: 'set_reservation_status',
        title: ar ? 'تغيير حالة الحجز' : 'Change reservation status',
        lines: [
          `${ar ? 'رقم الحجز' : 'Booking'}: ${r.bookingNumber} (${r.customerName})`,
          `${ar ? 'الحالة' : 'Status'}: ${r.status} → ${status}`,
          ...(status === ReservationStatus.APPROVED ? [ar ? 'الموافقة لا تنشئ عمليات تلقائياً؛ حمّل العمليات من شاشة الحجوزات.' : 'Approving does not create operations by itself; load them from the Reservations screen.'] : []),
        ],
        execute: () => db.updateReservationStatus(r.id, status),
      },
    };
  }

  return { status: 'none' };
}
