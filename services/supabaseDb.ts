/**
 * supabaseDb.ts
 * Drop-in replacement for mockDb.ts — identical public method signatures,
 * all backed by real Supabase tables instead of in-memory arrays.
 *
 * Usage: replace `import { db } from './services/mockDb'`
 *        with   `import { db } from './services/supabaseDb'`
 */

import { supabase } from './supabaseClient';
import {
  Genset, Reservation, Operation, Invoice, User, Location,
  UserRole, GensetStatus, ReservationStatus, AuditEntry,
  CustomerPrice, Procurement, GasTransaction, Employee,
  PayrollTransaction, Payment, PaymentAllocation, FoodExpense, TransportExpense,
  PortRent, SystemNotification, SupportContact, FAQItem, PortInfo,
  GensetMaintenanceLog
} from '../types';

export type { User };

// ─── helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      snakeToCamel(v)
    ])
  );
}

function normalizeDateForDb(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return fallback;
}

function camelToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      camelToSnake(v)
    ])
  );
}

async function query<T>(table: string, options?: { filter?: Record<string, any>; order?: string; ascending?: boolean }): Promise<T[]> {
  let q = supabase.from(table).select('*');
  if (options?.filter) {
    Object.entries(options.filter).forEach(([k, v]) => { q = q.eq(k, v) as any; });
  }
  if (options?.order) {
    q = q.order(options.order, { ascending: options.ascending ?? false }) as any;
  }
  const { data, error } = await q;
  if (error) {
    _lastDbError = `${table}: ${error.message}`;
    console.error(`[supabaseDb] query ${table}:`, error.message);
    throw new Error(_lastDbError);
  }
  return snakeToCamel(data || []) as T[];
}

function resolveCustomerId(customerName: string): string | undefined {
  const name = String(customerName || '').trim().toLowerCase();
  if (!name) return undefined;
  const customer = _users.find(u =>
    u.role === UserRole.CUSTOMER &&
    [u.companyName, u.name].some(v => String(v || '').trim().toLowerCase() === name)
  );
  return customer?.id;
}

function prepareOperationsDbRow(row: any): any {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  const opDate = normalizeDateForDb(row.operationDate, today);
  const clipOffDate = normalizeDateForDb(row.clipOffDate, '');
  return {
    ...row,
    operationDate: opDate,
    dateReceived: normalizeDateForDb(row.dateReceived, opDate),
    clipOnDate: normalizeDateForDb(row.clipOnDate, opDate),
    // PostgreSQL DATE columns reject an empty string. An operation that has
    // not been clipped off yet must be stored as NULL, not "".
    clipOffDate: clipOffDate || null,
    customerId: row.customerId || resolveCustomerId(row.customerName) || null
  };
}

async function insert<T>(table: string, row: Partial<T>): Promise<T | null> {
  // Strip UI-generated placeholder ids and let Postgres generate UUIDs.
  const { id, ...rest } = row as any;
  const prepared = table === 'operations' ? prepareOperationsDbRow(rest) : rest;
  const { data, error } = await supabase.from(table).insert(camelToSnake(prepared)).select().single();
  if (error) { _lastDbError = `${table}: ${error.message}`; console.error(`[supabaseDb] insert ${table}:`, error.message); return null; }
  return snakeToCamel(data) as T;
}

async function upsert<T>(table: string, row: Partial<T>): Promise<T | null> {
  const { data, error } = await supabase.from(table).upsert(camelToSnake(row)).select().single();
  if (error) { console.error(`[supabaseDb] upsert ${table}:`, error.message); return null; }
  return snakeToCamel(data) as T;
}

async function update<T>(table: string, id: string, updates: Partial<T>): Promise<boolean> {
  const prepared = table === 'operations' ? prepareOperationsDbRow(updates) : updates;
  const { data, error } = await supabase
    .from(table)
    .update(camelToSnake(prepared))
    .eq('id', id)
    .select('id');

  if (error) {
    _lastDbError = `${table}: ${error.message}`;
    console.error(`[supabaseDb] update ${table}:`, error.message);
    return false;
  }

  // RLS can legally turn an UPDATE into a zero-row result without a PostgreSQL
  // error. Never report that as success: otherwise the UI cache changes and the
  // old database value returns after refresh.
  if (!data || data.length === 0) {
    _lastDbError = `${table}: no row was updated (record missing or access denied)`;
    console.error(`[supabaseDb] update ${table} affected 0 rows`);
    return false;
  }

  return true;
}

async function remove(table: string, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    _lastDbError = `${table}: ${error.message}`;
    console.error(`[supabaseDb] delete ${table}:`, error.message);
    return false;
  }

  // Same RLS safeguard for DELETE: a zero-row delete must never be treated as
  // successful, or deleted records will reappear after refresh.
  if (!data || data.length === 0) {
    _lastDbError = `${table}: no row was deleted (record missing or access denied)`;
    console.error(`[supabaseDb] delete ${table} affected 0 rows`);
    return false;
  }

  return true;
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent('db-undo-success'));
  window.dispatchEvent(new CustomEvent('db-change'));
}

async function auditLog(action: string, details: string) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{"name":"System"}');
  await insert('audit_log', {
    timestamp: new Date().toISOString(),
    user: currentUser.name,
    action: action.split(':')[0],
    details,
  });
}

let internalSerialCounter = 2000;
function generateInternalSerial(): string {
  internalSerialCounter++;
  return `NF-${internalSerialCounter}`;
}

// ─── cache (so synchronous getters still work like mockDb) ────────────────────

let _stock: Genset[] = [];
let _reservations: Reservation[] = [];
let _operations: Operation[] = [];
let _invoices: Invoice[] = [];
let _payments: Payment[] = [];
let _paymentAllocations: PaymentAllocation[] = [];
let _users: User[] = [];
let _auditLogs: AuditEntry[] = [];
let _customerPrices: CustomerPrice[] = [];
let _procurements: Procurement[] = [];
let _gasTransactions: GasTransaction[] = [];
let _employees: Employee[] = [];
let _payrollTransactions: PayrollTransaction[] = [];
let _foodExpenses: FoodExpense[] = [];
let _transportExpenses: TransportExpense[] = [];
let _portRents: PortRent[] = [];
let _notifications: SystemNotification[] = [];
let _supportContacts: SupportContact[] = [];
let _faqs: FAQItem[] = [];
let _portsInfo: PortInfo[] = [];
let _maintenanceLogs: GensetMaintenanceLog[] = [];
let _loaded = false;
let _lastDbError = '';

class SupabaseDB {

  // ─── bootstrap ─────────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    if (_loaded) return;

    // Customer sessions must never request the company's full operational dataset.
    // RLS remains the final enforcement layer, but the client also follows least-privilege.
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    let isCustomer = false;
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, revoked')
        .eq('id', authUser.id)
        .maybeSingle();
      isCustomer = String(profile?.role || '').toUpperCase() === 'CUSTOMER' && !profile?.revoked;
    }

    const common = [
      query<Reservation>('reservations', { order: 'created_at' }),
      query<Operation>('operations', { order: 'created_at' }),
      query<Invoice>('invoices', { order: 'created_at' }),
      query<Payment>('payments', { order: 'created_at' }),
      query<PaymentAllocation>('payment_allocations', { order: 'created_at' }),
      query<User>('profiles', { order: 'created_at' }),
      query<SystemNotification>('system_notifications', { order: 'timestamp' }),
      query<SupportContact>('support_contacts'),
      query<FAQItem>('faqs'),
      query<PortInfo>('ports_info'),
    ];

    if (isCustomer) {
      const [reservations, operations, invoices, payments, paymentAllocations, users, notifications, supportContacts, faqs, portsInfo, customerPrices] = await Promise.all([
        ...common,
        query<CustomerPrice>('customer_prices'),
      ]);
      _stock = [];
      _reservations = reservations;
      _operations = operations;
      _invoices = invoices;
      _payments = payments;
      _paymentAllocations = paymentAllocations;
      _users = users;
      _auditLogs = [];
      _customerPrices = customerPrices;
      _procurements = [];
      _gasTransactions = [];
      _employees = [];
      _payrollTransactions = [];
      _foodExpenses = [];
      _transportExpenses = [];
      _portRents = [];
      _notifications = notifications;
      _supportContacts = supportContacts;
      _faqs = faqs;
      _portsInfo = portsInfo;
      _maintenanceLogs = [];
    } else {
      const [stock, reservations, operations, invoices, payments, paymentAllocations, users,
        auditLogs, customerPrices, procurements, gasTransactions, employees,
        payrollTransactions, foodExpenses, transportExpenses, portRents, notifications,
        supportContacts, faqs, portsInfo, maintenanceLogs] = await Promise.all([
        query<Genset>('gensets', { order: 'created_at' }),
        query<Reservation>('reservations', { order: 'created_at' }),
        query<Operation>('operations', { order: 'created_at' }),
        query<Invoice>('invoices', { order: 'created_at' }),
        query<Payment>('payments', { order: 'created_at' }),
        query<PaymentAllocation>('payment_allocations', { order: 'created_at' }),
        query<User>('profiles', { order: 'created_at' }),
        query<AuditEntry>('audit_log', { order: 'timestamp' }),
        query<CustomerPrice>('customer_prices'),
        query<Procurement>('procurement', { order: 'created_at' }),
        query<GasTransaction>('gas_transactions', { order: 'date' }),
        query<Employee>('employees', { order: 'created_at' }),
        query<PayrollTransaction>('payroll_transactions', { order: 'date' }),
        query<FoodExpense>('food_expenses', { order: 'created_at' }),
        query<TransportExpense>('transport_expenses', { order: 'created_at' }),
        query<PortRent>('port_rents', { order: 'created_at' }),
        query<SystemNotification>('system_notifications', { order: 'timestamp' }),
        query<SupportContact>('support_contacts'),
        query<FAQItem>('faqs'),
        query<PortInfo>('ports_info'),
        query<GensetMaintenanceLog>('genset_maintenance_logs', { order: 'service_date' }),
      ]);
      _stock=stock; _reservations=reservations; _operations=operations; _invoices=invoices; _payments=payments;
      _paymentAllocations=paymentAllocations; _users=users; _auditLogs=auditLogs; _customerPrices=customerPrices;
      _procurements=procurements; _gasTransactions=gasTransactions; _employees=employees; _payrollTransactions=payrollTransactions;
      _foodExpenses=foodExpenses; _transportExpenses=transportExpenses; _portRents=portRents; _notifications=notifications;
      _supportContacts=supportContacts; _faqs=faqs; _portsInfo=portsInfo; _maintenanceLogs=maintenanceLogs;
    }
    _loaded = true;
    dispatchChange();
  }

  // ─── synchronous getters (return cached data) ───────────────────────────────

  getStock(): Genset[] { return _stock; }
  /** Fresh database lookup used by DALI when the local cache does not contain a genset. */
  async searchGensetRecords(value: string): Promise<{ stock: Genset[]; operations: Operation[]; maintenance: GensetMaintenanceLog[] }> {
    const raw = String(value || '').trim().toUpperCase();
    const normalizedQuery = raw.replace(/[^A-Z0-9]/g, '');
    const suffixPattern = /^\d{3,6}$/.test(normalizedQuery)
      ? new RegExp(`(?:^|[^A-Z0-9])${normalizedQuery}$`)
      : null;
    const matches = (v: unknown) => {
      const serial = String(v ?? '').trim().toUpperCase();
      if (!serial || !normalizedQuery) return false;
      const normalizedSerial = serial.replace(/[^A-Z0-9]/g, '');
      return normalizedSerial === normalizedQuery || Boolean(suffixPattern?.test(serial));
    };
    const [stockRows, operationRows, maintenanceRows] = await Promise.all([
      query<Genset>('gensets'),
      query<Operation>('operations'),
      query<GensetMaintenanceLog>('genset_maintenance_logs')
    ]);
    return {
      stock: stockRows.filter(g => matches(g.unitNumber)),
      operations: operationRows.filter(o => matches(o.gensetNumber)),
      maintenance: maintenanceRows.filter(m => matches(m.gensetNumber))
    };
  }
  getReservations(): Reservation[] { return _reservations; }
  getOperations(): Operation[] { return _operations; }

  getCustomerOperations(customerId: string, customerName?: string): Operation[] {
    const normalized = String(customerName || '').trim().toLowerCase();
    return _operations.filter(o =>
      o.customerId === customerId ||
      (!o.customerId && normalized && String(o.customerName || '').trim().toLowerCase() === normalized)
    );
  }

  getLastDbError(): string { return _lastDbError; }

  async reloadOperations(): Promise<boolean> {
    const { data, error } = await supabase.from('operations').select('*').order('created_at', { ascending: false });
    if (error) {
      _lastDbError = `operations: ${error.message}`;
      console.error('[supabaseDb] reload operations:', error.message);
      return false;
    }
    _operations = snakeToCamel(data || []) as Operation[];
    dispatchChange();
    return true;
  }

  /** Returns other active assignments using the same genset. Duplicates are allowed;
   * callers should warn the operator when both records are IN PROGRESS. */
  getActiveGensetConflicts(unitNumber: string, excludeOperationId?: string): Operation[] {
    const normalized = unitNumber.trim().toUpperCase();
    return _operations.filter(o =>
      o.status === 'IN PROGRESS' &&
      o.gensetNumber?.trim().toUpperCase() === normalized &&
      o.id !== excludeOperationId
    );
  }

  getInvoices(): Invoice[] { return _invoices; }
  getPayments(): Payment[] { return _payments; }
  getPaymentAllocations(): PaymentAllocation[] { return _paymentAllocations; }
  getInvoicePaidAmount(invoiceId: string): number {
    return _paymentAllocations.filter(a => a.invoiceId === invoiceId).reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }
  getUsers(): User[] { return _users; }

  /**
   * Re-fetches profiles from the database. Needed after creating an account
   * through the secure server-side function, since that bypasses the normal
   * insert() path and so doesn't update the local cache automatically.
   */
  async reloadUsers(): Promise<void> {
    _users = await query<User>('profiles', { order: 'created_at' });
    dispatchChange();
  }
  getAuditLogs(): AuditEntry[] { return _auditLogs; }
  getCustomerPrices(): CustomerPrice[] { return _customerPrices; }
  getProcurements(): Procurement[] { return _procurements; }
  getGasTransactions(): GasTransaction[] { return _gasTransactions; }
  getEmployees(): Employee[] { return _employees; }
  getPayrollTransactions(): PayrollTransaction[] { return _payrollTransactions; }
  getFoodExpenses(): FoodExpense[] { return _foodExpenses; }
  getTransportExpenses(): TransportExpense[] { return _transportExpenses; }
  getPortRents(): PortRent[] { return _portRents; }
  getSupportContacts(): SupportContact[] { return _supportContacts; }
  getFAQs(): FAQItem[] { return _faqs; }
  getPortsInfo(): PortInfo[] { return _portsInfo; }
  getMaintenanceLogs(): GensetMaintenanceLog[] {
    return [..._maintenanceLogs].sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }
  getMaintenanceLogsForGenset(unitNumber: string): GensetMaintenanceLog[] {
    return _maintenanceLogs
      .filter(l => l.gensetNumber?.toUpperCase() === unitNumber.toUpperCase())
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }

  getGasBalance(): number {
    return _gasTransactions.reduce((sum, t) => t.type === 'TOPUP' ? sum + t.amount : sum - t.amount, 0);
  }

  getNotifications(user: User): SystemNotification[] {
    return _notifications.filter(n => {
      if (!n.targetUserId && !n.targetOrgName) return true;
      if (n.targetUserId === user.id) return true;
      const userOrg = user.companyName || user.name;
      if (n.targetOrgName === userOrg) return true;
      return false;
    });
  }

  getActiveNotifications(user: User): SystemNotification[] {
    return this.getNotifications(user).filter(n => n.active);
  }

  getGasByPort(): Record<string, number> {
    const map: Record<string, number> = {};
    _operations.forEach(op => {
      const fuel = parseFloat(op.gaz || '0');
      map[op.clipOnPort] = (map[op.clipOnPort] || 0) + fuel;
    });
    return map;
  }

  getGasByGenset(): { unit: string; gas: number }[] {
    const map: Record<string, number> = {};
    _operations.forEach(op => {
      if (!op.gensetNumber) return;
      const fuel = parseFloat(op.gaz || '0');
      map[op.gensetNumber] = (map[op.gensetNumber] || 0) + fuel;
    });
    return Object.entries(map).map(([unit, gas]) => ({ unit, gas }));
  }

  getOktanEstimate() {
    const balance = this.getGasBalance();
    const dailyAvg = 150;
    return {
      balance,
      estimatedLiters: balance / 18,
      dailyAvg,
      daysRemaining: Math.floor((balance / 18) / dailyAvg)
    };
  }

  getEmployeeBalance(empId: string, month: string) {
    const txs = _payrollTransactions.filter(t => t.employeeId === empId && t.month === month);
    const earnings = txs.filter(t => t.type === 'SALARY_BASE' || t.type === 'BONUS').reduce((s, t) => s + t.amount, 0);
    const deductions = txs.filter(t => t.type === 'ADVANCE').reduce((s, t) => s + t.amount, 0);
    return { earnings, deductions, balance: earnings - deductions };
  }

  // ─── operations ────────────────────────────────────────────────────────────

  async addOperation(op: Operation): Promise<boolean> {
    if (!op.internalSerial) op.internalSerial = generateInternalSerial();
    const row = { ...op, id: op.id || undefined };
    const saved = await insert<Operation>('operations', row);
    if (!saved) return false;
    _operations = [saved, ..._operations];
    await this._syncGensetStatus(saved);
    if (saved.status === 'DONE' && !saved.invoiced) {
      await this.generateInvoiceFromBooking(saved.bookingNumber, saved.customerName);
    }
    await auditLog('OPS', `Manual Entry ${saved.bookingNumber}`);
    dispatchChange();
    return true;
  }

  async updateOperation(updatedOp: Operation): Promise<boolean> {
    const previous = _operations.find(o => o.id === updatedOp.id);
    const saved = await update('operations', updatedOp.id, updatedOp);
    if (!saved) return false;
    _operations = _operations.map(o => o.id === updatedOp.id ? updatedOp : o);
    await this._syncGensetStatus(updatedOp, previous);
    if (updatedOp.status === 'DONE' && !updatedOp.invoiced) {
      await this.generateInvoiceFromBooking(updatedOp.bookingNumber, updatedOp.customerName);
    }
    await auditLog('OPS', `Updated operation ${updatedOp.bookingNumber}`);
    dispatchChange();
    return true;
  }

  async confirmOperation(id: string): Promise<void> {
    await update('operations', id, { reviewedByManager: true });
    _operations = _operations.map(o => o.id === id ? { ...o, reviewedByManager: true } : o);
    await auditLog('BOSS', `Verified record ${id}`);
    dispatchChange();
  }

  async confirmOperationsBulk(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => update('operations', id, { reviewedByManager: true })));
    _operations = _operations.map(o => ids.includes(o.id) ? { ...o, reviewedByManager: true } : o);
    await auditLog('BOSS', `Force Verified ${ids.length} records`);
    dispatchChange();
  }

  async addOperationsBulk(ops: Operation[]): Promise<boolean> {
    const prepared = ops.map(op => ({ ...op, internalSerial: op.internalSerial || generateInternalSerial() }));
    const rowsToInsert = prepared.map(op => {
      const { id, ...rest } = op as any;
      return camelToSnake(prepareOperationsDbRow(rest));
    });
    const { data, error } = await supabase.from('operations').insert(rowsToInsert).select();
    if (error) {
      const message = error.message || 'Unknown database error';
      _lastDbError = /destination/i.test(message)
        ? `operations: destination column is missing from the Supabase operations table. Run the migration 20260924_ensure_operation_destination.sql in Supabase SQL Editor. Original error: ${message}`
        : `operations: ${message}`;
      console.error('[supabaseDb] bulk insert operations:', _lastDbError);
      return false;
    }
    const saved = snakeToCamel(data || []) as Operation[];
    if (saved.length !== rowsToInsert.length) {
      _lastDbError = `operations: database accepted ${saved.length}/${rowsToInsert.length} rows but did not return all inserted records`;
      console.error('[supabaseDb] bulk insert verification mismatch:', _lastDbError);
      return false;
    }
    _operations = [...saved, ..._operations];
    await Promise.all(prepared.map(op => this._syncGensetStatus(op)));
    const doneBookings = Array.from(new Set(prepared.filter(o => o.status === 'DONE').map(o => o.bookingNumber)));
    for (const bk of doneBookings) {
      const op = prepared.find(o => o.bookingNumber === bk);
      if (op) await this.generateInvoiceFromBooking(bk, op.customerName);
    }
    await auditLog('OPS', `Bulk deployment ${ops.length} units`);
    dispatchChange();
    return true;
  }

  async deleteOperation(id: string): Promise<void> {
    const previous = _operations.find(o => o.id === id);
    const removed = await remove('operations', id);
    if (!removed) return;
    _operations = _operations.filter(o => o.id !== id);
    if (previous?.status === 'IN PROGRESS' && previous.gensetNumber) {
      await this._releaseGensetIfUnused(previous.gensetNumber);
    }
    await auditLog('OPS', `Deleted operation ${id}`);
    dispatchChange();
  }

  async deleteOperationsBulk(ids: string[]): Promise<void> {
    const previous = _operations.filter(o => ids.includes(o.id));
    const results = await Promise.all(ids.map(id => remove('operations', id)));
    const removedIds = ids.filter((_, i) => results[i]);
    if (!removedIds.length) return;
    _operations = _operations.filter(o => !removedIds.includes(o.id));
    const units = Array.from(new Set(
      previous.filter(o => removedIds.includes(o.id) && o.status === 'IN PROGRESS' && o.gensetNumber)
        .map(o => o.gensetNumber as string)
    ));
    await Promise.all(units.map(unit => this._releaseGensetIfUnused(unit)));
    await auditLog('OPS', `Force deleted ${removedIds.length} manifest entries`);
    dispatchChange();
  }

  private async _releaseGensetIfUnused(unitNumber: string): Promise<void> {
    const normalized = unitNumber.trim().toUpperCase();
    const stillActive = _operations.some(o =>
      o.status === 'IN PROGRESS' &&
      o.gensetNumber?.trim().toUpperCase() === normalized
    );
    if (stillActive) return;
    const genset = _stock.find(s => s.unitNumber?.trim().toUpperCase() === normalized);
    if (!genset) return;
    const updates: Partial<Genset> = { status: GensetStatus.IN_STOCK };
    const saved = await update('gensets', genset.id, updates);
    if (saved) _stock = _stock.map(s => s.id === genset.id ? { ...s, ...updates } : s);
  }

  private async _syncGensetStatus(op: Operation, previous?: Operation): Promise<void> {
    // If an operation switches units, release the old unit only when no other
    // IN PROGRESS operation is still using it.
    if (previous?.gensetNumber && previous.gensetNumber !== op.gensetNumber) {
      await this._releaseGensetIfUnused(previous.gensetNumber);
    }
    if (!op.gensetNumber) return;
    const normalized = op.gensetNumber.trim().toUpperCase();
    const genset = _stock.find(s => s.unitNumber?.trim().toUpperCase() === normalized);
    if (!genset) return;

    if (op.status === 'IN PROGRESS') {
      const updates: Partial<Genset> = { status: GensetStatus.CLIPPED_ON };
      const saved = await update('gensets', genset.id, updates);
      if (saved) _stock = _stock.map(s => s.id === genset.id ? { ...s, ...updates } : s);
    } else if (op.status === 'DONE' || op.status === 'CANCEL') {
      // A completed/cancelled record must not put a genset back in stock while
      // another IN PROGRESS record is legitimately using the same unit.
      await this._releaseGensetIfUnused(op.gensetNumber);
      if (op.status === 'DONE' && op.clipOffPort) {
        const stillActive = _operations.some(o =>
          o.status === 'IN PROGRESS' &&
          o.id !== op.id &&
          o.gensetNumber?.trim().toUpperCase() === normalized
        );
        if (!stillActive) {
          const locationUpdates: Partial<Genset> = {
            location: op.clipOffPort as Location,
            status: GensetStatus.IN_STOCK
          };
          const saved = await update('gensets', genset.id, locationUpdates);
          if (saved) _stock = _stock.map(s => s.id === genset.id ? { ...s, ...locationUpdates } : s);
        }
      }
    }
  }

  // ─── invoices ──────────────────────────────────────────────────────────────

  async generateInvoiceFromBooking(bookingNumber: string, customerName: string): Promise<Invoice | null> {
    const units = _operations.filter(o =>
      o.bookingNumber === bookingNumber &&
      o.customerName === customerName &&
      o.status === 'DONE' &&
      !o.invoiced
    );
    if (units.length === 0) return null;

    const amount = units.reduce((sum, u) => sum + (parseFloat(String(u.rate).replace(/,/g, '')) || 0) + (parseFloat(String(u.vat).replace(/,/g, '')) || 0), 0);
    const opIds = units.map(u => u.id);

    const matchedCustomer = _users.find(u =>
      (u.companyName || u.name)?.toUpperCase() === customerName.toUpperCase()
    );

    const invoice: Partial<Invoice> = {
      customerId: matchedCustomer?.id,
      customerName,
      bookingNumber,
      amount,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'UNPAID',
      containerNumbers: units.map(u => u.containerNumber),
      portIn: units[0].clipOnPort,
      portOut: units[0].clipOffPort,
      operationIds: opIds,
      etaStatus: 'DRAFT',
    };

    const saved = await insert<Invoice>('invoices', invoice);
    if (!saved) return null;

    _invoices = [..._invoices, saved];
    await Promise.all(opIds.map(id => update('operations', id, { invoiced: true })));
    _operations = _operations.map(o => opIds.includes(o.id) ? { ...o, invoiced: true } : o);
    await auditLog('FIN', `Created Invoice ${saved.id} (Automatic)`);
    dispatchChange();
    return saved;
  }

  async updateInvoice(id: string, updated: Partial<Invoice>): Promise<boolean> {
    const saved = await update('invoices', id, updated);
    if (!saved) return false;
    _invoices = _invoices.map(i => i.id === id ? { ...i, ...updated } : i);
    await auditLog('FIN', `Updated Invoice ${id}`);
    dispatchChange();
    return true;
  }

  async updateInvoiceEtaStatus(id: string, etaStatus: 'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID'): Promise<boolean> {
    const saved = await update('invoices', id, { etaStatus });
    if (!saved) return false;
    _invoices = _invoices.map(i => i.id === id ? { ...i, etaStatus } : i);
    await auditLog('ETA', `Status update for ${id} -> ${etaStatus}`);
    dispatchChange();
    return true;
  }

  // ─── payments ──────────────────────────────────────────────────────────────

  async addPayment(payment: Payment, allocatedInvoiceIds: string[] = []): Promise<boolean> {
    const savedPayment = await insert<Payment>('payments', payment);
    if (!savedPayment) return false;
    const explicitlySelected = [...new Set(allocatedInvoiceIds)]
      .map(id => _invoices.find(i => i.id === id))
      .filter((invoice): invoice is Invoice => Boolean(invoice && (
        invoice.customerId === payment.customerId ||
        (!invoice.customerId && resolveCustomerId(invoice.customerName) === payment.customerId)
      )));
    const customerInvoices = _invoices.filter(invoice =>
      invoice.status === 'UNPAID' && (
        invoice.customerId === payment.customerId ||
        (!invoice.customerId && resolveCustomerId(invoice.customerName) === payment.customerId)
      )
    ).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const requestedInvoices = [...explicitlySelected, ...customerInvoices.filter(invoice => !explicitlySelected.some(selected => selected.id === invoice.id))];
    let remainingMoney = Number(payment.amount);
    const insertedAllocations: PaymentAllocation[] = [];
    for (const invoice of requestedInvoices) {
      if (remainingMoney <= 0) break;
      const openAmount = Math.max(0, Number(invoice.amount || 0) - this.getInvoicePaidAmount(invoice.id));
      const allocationAmount = Math.min(openAmount, remainingMoney);
      if (allocationAmount <= 0) continue;
      const allocation = await insert<PaymentAllocation>('payment_allocations', {
        paymentId: savedPayment.id, invoiceId: invoice.id, amount: allocationAmount
      });
      if (!allocation) {
        await Promise.all(insertedAllocations.map(a => remove('payment_allocations', a.id)));
        await remove('payments', savedPayment.id);
        return false;
      }
      insertedAllocations.push(allocation);
      remainingMoney -= allocationAmount;
    }

    const newlyPaidInvoices: Invoice[] = [];
    for (const invoice of requestedInvoices) {
      const paidAmount = this.getInvoicePaidAmount(invoice.id) + insertedAllocations
        .filter(allocation => allocation.invoiceId === invoice.id)
        .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
      if (paidAmount >= Number(invoice.amount || 0) && invoice.status !== 'PAID') {
        if (!(await update('invoices', invoice.id, { status: 'PAID' }))) {
          await Promise.all(insertedAllocations.map(a => remove('payment_allocations', a.id)));
          await remove('payments', savedPayment.id);
          return false;
        }
        newlyPaidInvoices.push(invoice);
      }
    }

    const user = _users.find(u => u.id === payment.customerId);
    const historicalCredit = Math.min(remainingMoney, Number(user?.pastOutstandingAmount || 0));
    const newHistoricalBalance = Number(user?.pastOutstandingAmount || 0) - historicalCredit;
    if (historicalCredit > 0) {
      const allocation = await insert<PaymentAllocation>('payment_allocations', {
        paymentId: savedPayment.id, invoiceId: undefined, amount: historicalCredit
      });
      if (!allocation) {
        await Promise.all(insertedAllocations.map(a => remove('payment_allocations', a.id)));
        await Promise.all(newlyPaidInvoices.map(invoice => update('invoices', invoice.id, { status: 'UNPAID' })));
        await remove('payments', savedPayment.id);
        return false;
      }
      insertedAllocations.push(allocation);
    }
    if (user && historicalCredit > 0 && !(await update('profiles', user.id, { pastOutstandingAmount: newHistoricalBalance }))) {
      await Promise.all(insertedAllocations.map(a => remove('payment_allocations', a.id)));
      await Promise.all(newlyPaidInvoices.map(invoice => update('invoices', invoice.id, { status: 'UNPAID' })));
      await remove('payments', savedPayment.id);
      return false;
    }

    _payments = [..._payments, savedPayment];
    _paymentAllocations = [..._paymentAllocations, ...insertedAllocations];
    if (user && historicalCredit > 0) {
      _users = _users.map(u => u.id === user.id ? { ...u, pastOutstandingAmount: newHistoricalBalance } : u);
    }
    _invoices = _invoices.map(invoice => newlyPaidInvoices.some(paid => paid.id === invoice.id)
      ? { ...invoice, status: 'PAID' }
      : invoice);

    await auditLog('FIN', `Recorded Payment ${payment.amount} from ${payment.customerName}`);
    dispatchChange();
    return true;
  }

  async updatePayment(payment: Payment): Promise<boolean> {
    const existing = _payments.find(item => item.id === payment.id);
    if (!existing) {
      _lastDbError = 'Payment was not found in the loaded records.';
      return false;
    }
    if (existing.customerId !== payment.customerId) {
      _lastDbError = 'A receipt cannot be moved to another customer. Delete it and record a new receipt for the correct customer.';
      return false;
    }
    if (_paymentAllocations.some(allocation => allocation.paymentId === payment.id) && Number(existing.amount) !== Number(payment.amount)) {
      _lastDbError = 'This payment has invoice allocations. Its amount cannot be changed until it is reallocated.';
      return false;
    }
    const saved = await update<Payment>('payments', payment.id, {
      customerId: payment.customerId,
      customerName: payment.customerName,
      amount: payment.amount,
      date: payment.date,
      reference: payment.reference,
      type: payment.type
    });
    if (!saved) return false;
    _payments = _payments.map(p => p.id === payment.id ? { ...p, ...payment } : p);
    await auditLog('FIN', `Updated Payment ${payment.id} for ${payment.customerName}`);
    dispatchChange();
    return true;
  }

  async deletePayment(paymentId: string): Promise<boolean> {
    const allocations = _paymentAllocations.filter(a => a.paymentId === paymentId);
    const payment = _payments.find(p => p.id === paymentId);
    const historicalCredit = allocations.filter(allocation => !allocation.invoiceId).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    const user = payment && _users.find(u => u.id === payment.customerId);
    const restoredHistoricalBalance = Number(user?.pastOutstandingAmount || 0) + historicalCredit;
    if (user && historicalCredit > 0 && !(await update('profiles', user.id, { pastOutstandingAmount: restoredHistoricalBalance }))) return false;
    const removedAllocations: PaymentAllocation[] = [];
    for (const allocation of allocations) {
      if (!(await remove('payment_allocations', allocation.id))) {
        if (user && historicalCredit > 0) await update('profiles', user.id, { pastOutstandingAmount: Number(user.pastOutstandingAmount || 0) });
        await Promise.all(removedAllocations.map(item => insert<PaymentAllocation>('payment_allocations', {
          paymentId, invoiceId: item.invoiceId, amount: item.amount
        })));
        return false;
      }
      removedAllocations.push(allocation);
    }
    const removed = await remove('payments', paymentId);
    if (!removed) {
      if (user && historicalCredit > 0) await update('profiles', user.id, { pastOutstandingAmount: Number(user.pastOutstandingAmount || 0) });
      await Promise.all(allocations.map(allocation => insert<PaymentAllocation>('payment_allocations', {
        paymentId, invoiceId: allocation.invoiceId, amount: allocation.amount
      })));
      return false;
    }
    if (user && historicalCredit > 0) {
      _users = _users.map(u => u.id === user.id ? { ...u, pastOutstandingAmount: restoredHistoricalBalance } : u);
    }
    for (const invoiceId of new Set(allocations.map(allocation => allocation.invoiceId).filter(Boolean))) {
      const invoice = _invoices.find(item => item.id === invoiceId);
      if (!invoice) continue;
      const remainingPaid = _paymentAllocations.filter(allocation => allocation.paymentId !== paymentId && allocation.invoiceId === invoice.id)
        .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
      if (invoice.status === 'PAID' && remainingPaid < Number(invoice.amount || 0)) {
        await update('invoices', invoice.id, { status: 'UNPAID' });
        _invoices = _invoices.map(item => item.id === invoice.id ? { ...item, status: 'UNPAID' } : item);
      }
    }
    _paymentAllocations = _paymentAllocations.filter(a => a.paymentId !== paymentId);
    _payments = _payments.filter(p => p.id !== paymentId);
    await auditLog('FIN', `Deleted Payment ${paymentId}`);
    dispatchChange();
    return true;
  }

  // ─── gensets ───────────────────────────────────────────────────────────────

  async addGenset(genset: Genset): Promise<void> {
    const saved = await insert<Genset>('gensets', genset);
    if (saved) {
      _stock = [saved, ..._stock];
      await auditLog('STOCK', `Registered new unit ${genset.unitNumber}`);
      dispatchChange();
    }
  }

  async updateGenset(updatedGenset: Genset): Promise<boolean> {
    const saved = await update('gensets', updatedGenset.id, updatedGenset);
    if (!saved) return false;
    _stock = _stock.map(s => s.id === updatedGenset.id ? updatedGenset : s);
    await auditLog('STOCK', `Updated unit ${updatedGenset.unitNumber}`);
    dispatchChange();
    return true;
  }

  async deleteGenset(id: string): Promise<boolean> {
    const removed = await remove('gensets', id);
    if (!removed) return false;
    _stock = _stock.filter(s => s.id !== id);
    await auditLog('STOCK', `Deleted unit ${id}`);
    dispatchChange();
    return true;
  }

  // ─── users / customers ─────────────────────────────────────────────────────

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    // Never send client-only/auth secrets back to the profiles table.
    // Sending the whole User object used to make edits fail when fields such as
    // password/wipePassword were present but no matching DB column existed.
    const profileUpdates: any = {
      name: updates.name,
      role: updates.role,
      companyName: updates.companyName,
      companyNameAr: updates.companyNameAr,
      avatarUrl: updates.avatarUrl,
      phoneNumber: updates.phoneNumber,
      jobTitle: updates.jobTitle,
      department: updates.department,
      joinedDate: updates.joinedDate,
      bio: updates.bio,
      assignedPorts: updates.assignedPorts,
      taxpayerId: updates.taxpayerId,
      addressLine: updates.addressLine,
      governorate: updates.governorate,
      postalCode: updates.postalCode,
      pastOutstandingAmount: updates.pastOutstandingAmount,
      revoked: updates.revoked,
      mfaEnabled: updates.mfaEnabled,
      allowedScreens: updates.allowedScreens,
      permissions: updates.permissions,
      invoiceSettings: updates.invoiceSettings,
      signatureUrl: updates.signatureUrl,
      isServiceAccount: updates.isServiceAccount,
      apiKeys: updates.apiKeys,
      lastRotationDate: updates.lastRotationDate,
      passwordHistory: updates.passwordHistory,
    };
    Object.keys(profileUpdates).forEach(key => {
      if (profileUpdates[key] === undefined) delete profileUpdates[key];
    });

    const saved = await update('profiles', id, profileUpdates);
    if (!saved) return false;
    _users = _users.map(u => u.id === id ? { ...u, ...updates } : u);
    await auditLog('USER', `Updated user access profile for ${id}`);
    dispatchChange();
    return true;
  }

  async updateUserFinance(userId: string, updates: { pastOutstandingAmount?: number }): Promise<boolean> {
    const saved = await update('profiles', userId, updates);
    if (!saved) return false;
    _users = _users.map(u => u.id === userId ? { ...u, ...updates } : u);
    await auditLog('FIN', `Updated ledger balance for ${userId}`);
    dispatchChange();
    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    // The Supabase admin API (full account deletion) requires a service-role key,
    // which must never be exposed in browser code. So we revoke access instead —
    // this is a real, persisted change (blocks login), unlike a client-side admin call.
    const saved = await update('profiles', id, { revoked: true });
    if (!saved) return false;
    _users = _users.filter(u => u.id !== id);
    await auditLog('USER', `Deleted user profile ${id}`);
    dispatchChange();
    return true;
  }

  async addUser(user: User): Promise<void> {
    // Creating a user with a password must go through Supabase Auth
    // For now we insert the profile directly (auth user created separately)
    const saved = await insert<User>('profiles', { ...user, pastOutstandingAmount: user.pastOutstandingAmount || 0 });
    if (saved) {
      _users = [..._users, saved];
      await auditLog('USER', `Registered ${user.role} - ${user.name}`);
      dispatchChange();
    }
  }

  async addCustomer(customer: any): Promise<void> {
    const saved = await insert('profiles', { ...customer, role: UserRole.CUSTOMER, pastOutstandingAmount: customer.pastOutstandingAmount || 0 });
    if (saved) {
      _users = [..._users, snakeToCamel(saved) as User];
      await auditLog('USER', `Registered customer ${customer.companyName}`);
      dispatchChange();
    }
  }

  async syncCustomersFromOperations(): Promise<void> {
    const uniqueNames = Array.from(new Set(_operations.map(o => o.customerName)));
    const existing = new Set(_users.filter(u => u.role === UserRole.CUSTOMER).map(u => (u.companyName || u.name).toUpperCase()));
    let added = 0;
    for (const name of uniqueNames) {
      if (!existing.has(name.toUpperCase())) {
        await this.addCustomer({ name: name.toUpperCase(), companyName: name.toUpperCase(), email: `${name.toLowerCase().replace(/\s/g, '')}@portal.nilefleet.com`, role: UserRole.CUSTOMER });
        added++;
      }
    }
    if (added > 0) await auditLog('SYSTEM', `Sync ${added} customers from ops data`);
  }

  // ─── reservations ──────────────────────────────────────────────────────────

  async addReservation(res: Reservation): Promise<void> {
    const saved = await insert<Reservation>('reservations', res);
    if (saved) {
      _reservations = [saved, ..._reservations];
      await auditLog('RES', `Booking request ${res.bookingNumber}`);
      dispatchChange();
    }
  }

  async updateReservationStatus(id: string, status: ReservationStatus): Promise<boolean> {
    const saved = await update('reservations', id, { status });
    if (!saved) return false;
    _reservations = _reservations.map(r => r.id === id ? { ...r, status } : r);
    dispatchChange();
    return true;
  }

  async createOperationFromReservation(res: Reservation): Promise<boolean> {
    const newOperations: Operation[] = Array.from({ length: res.gensetsNeeded }).map((_, idx) => {
      const foundPrice = _customerPrices.find(p => p.customerName === res.customerName && p.portIn === res.portIn && p.portOut === res.portOut);
      return {
        id: `op-${Date.now()}-${idx}`,
        internalSerial: '',
        reservationId: res.id,
        customerName: res.customerName,
        dateReceived: res.dateReceived || new Date().toISOString().split('T')[0],
        operationDate: res.reservationDate,
        clipOnDate: res.reservationDate,
        clipOffDate: '',
        clipOnPort: res.portIn,
        clipOffPort: res.portOut,
        trucker: res.trucker || '',
        bookingNumber: res.bookingNumber,
        beneficiaryName: res.beneficiaryName || '',
        containerNumber: '',
        gensetNumber: '',
        gaz: '40',
        shipperAddress: res.shipperAddress || '',
        status: 'UNDER OPERATE',
        rate: foundPrice ? foundPrice.price.toFixed(2) : '0.00',
        vat: foundPrice?.includeVat ? (foundPrice.price * 0.14).toFixed(2) : '0.00',
        notes: `From Res ${res.id}`,
        invoiced: false,
        reviewedByManager: false,
      } as Operation;
    });
    const operationsSaved = await this.addOperationsBulk(newOperations);
    if (!operationsSaved) return false;
    const reservationSaved = await this.updateReservationStatus(res.id, ReservationStatus.APPROVED);
    return reservationSaved;
  }

  // ─── customer prices ───────────────────────────────────────────────────────

  async setCustomerPrice(priceData: CustomerPrice): Promise<void> {
    const existing = _customerPrices.find(p => p.customerName === priceData.customerName && p.portIn === priceData.portIn && p.portOut === priceData.portOut);
    if (existing) {
      await update('customer_prices', existing.id, priceData);
      _customerPrices = _customerPrices.map(p => p.id === existing.id ? priceData : p);
    } else {
      const saved = await insert<CustomerPrice>('customer_prices', priceData);
      if (saved) _customerPrices = [..._customerPrices, saved];
    }
    await auditLog('RATE', `Rate update for ${priceData.customerName}`);
    dispatchChange();
  }

  // ─── maintenance logs ──────────────────────────────────────────────────────

  async addMaintenanceLog(log: GensetMaintenanceLog): Promise<void> {
    const saved = await insert<GensetMaintenanceLog>('genset_maintenance_logs', log);
    if (saved) {
      _maintenanceLogs = [saved, ..._maintenanceLogs];
      const unit = _stock.find(s => s.unitNumber.toUpperCase() === log.gensetNumber.toUpperCase());
      if (unit) {
        const updates: Partial<Genset> = { maintenanceCount: (unit.maintenanceCount || 0) + 1 };
        if (!unit.lastMaintenanceDate || new Date(log.serviceDate) >= new Date(unit.lastMaintenanceDate)) updates.lastMaintenanceDate = log.serviceDate;
        if (log.nextServiceDue) updates.nextMaintenanceDue = log.nextServiceDue;
        if (log.runningHours && (!unit.runningHours || log.runningHours > unit.runningHours)) updates.runningHours = log.runningHours;
        if (log.status === 'IN_PROGRESS') updates.status = GensetStatus.MAINTENANCE;
        else if (log.status === 'COMPLETED' && unit.status === GensetStatus.MAINTENANCE) updates.status = GensetStatus.IN_STOCK;
        await update('gensets', unit.id, updates);
        _stock = _stock.map(s => s.id === unit.id ? { ...s, ...updates } : s);
      }
      await auditLog('MAINTENANCE', `Logged ${log.serviceType} for ${log.gensetNumber}`);
      dispatchChange();
    }
  }

  async updateMaintenanceLog(log: GensetMaintenanceLog): Promise<void> {
    await update('genset_maintenance_logs', log.id, log);
    _maintenanceLogs = _maintenanceLogs.map(l => l.id === log.id ? log : l);
    await auditLog('MAINTENANCE', `Updated record for ${log.gensetNumber}`);
    dispatchChange();
  }

  async deleteMaintenanceLog(id: string): Promise<void> {
    await remove('genset_maintenance_logs', id);
    _maintenanceLogs = _maintenanceLogs.filter(l => l.id !== id);
    await auditLog('MAINTENANCE', `Deleted record ${id}`);
    dispatchChange();
  }

  // ─── notifications ─────────────────────────────────────────────────────────

  async addNotification(n: Omit<SystemNotification, 'id' | 'timestamp' | 'active'>): Promise<boolean> {
    const full = { ...n, timestamp: new Date().toISOString(), active: true };
    const saved = await insert<SystemNotification>('system_notifications', full);
    if (!saved) return false;
    _notifications = [saved, ..._notifications];
    dispatchChange();
    return true;
  }

  async dismissNotification(id: string): Promise<boolean> {
    const saved = await update('system_notifications', id, { active: false });
    if (!saved) return false;
    _notifications = _notifications.map(n => n.id === id ? { ...n, active: false } : n);
    dispatchChange();
    return true;
  }

  async clearAllNotifications(): Promise<boolean> {
    // Distinguish "there was nothing to clear" from an RLS-denied UPDATE.
    // A permitted read proves that zero matching rows is a valid success case.
    const { count, error: countError } = await supabase
      .from('system_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);

    if (countError) {
      _lastDbError = `system_notifications: ${countError.message}`;
      return false;
    }

    if ((count ?? 0) === 0) {
      _notifications = _notifications.map(n => ({ ...n, active: false }));
      dispatchChange();
      return true;
    }

    const { data, error } = await supabase
      .from('system_notifications')
      .update({ active: false })
      .eq('active', true)
      .select('id');

    if (error) {
      _lastDbError = `system_notifications: ${error.message}`;
      return false;
    }

    if (!data || data.length === 0) {
      _lastDbError = 'system_notifications: active notifications exist but none were updated (access denied or concurrent change)';
      return false;
    }

    _notifications = _notifications.map(n => ({ ...n, active: false }));
    dispatchChange();
    return true;
  }

  // ─── support / FAQ / ports ─────────────────────────────────────────────────

  async updateSupportContact(contact: SupportContact): Promise<boolean> {
    const saved = await update('support_contacts', contact.id, contact);
    if (!saved) return false;
    _supportContacts = _supportContacts.map(c => c.id === contact.id ? contact : c);
    dispatchChange();
    return true;
  }
  async addSupportContact(contact: SupportContact): Promise<boolean> {
    const saved = await insert<SupportContact>('support_contacts', contact);
    if (!saved) return false;
    _supportContacts = [..._supportContacts, saved]; dispatchChange();
    return true;
  }
  async deleteSupportContact(id: string): Promise<boolean> {
    const removed = await remove('support_contacts', id);
    if (!removed) return false;
    _supportContacts = _supportContacts.filter(c => c.id !== id);
    dispatchChange();
    return true;
  }

  async updateFAQ(item: FAQItem): Promise<boolean> {
    const saved = await update('faqs', item.id, item);
    if (!saved) return false;
    _faqs = _faqs.map(f => f.id === item.id ? item : f);
    dispatchChange();
    return true;
  }
  async addFAQ(item: FAQItem): Promise<boolean> {
    const saved = await insert<FAQItem>('faqs', item);
    if (!saved) return false;
    _faqs = [..._faqs, saved]; dispatchChange();
    return true;
  }
  async deleteFAQ(id: string): Promise<boolean> {
    const removed = await remove('faqs', id);
    if (!removed) return false;
    _faqs = _faqs.filter(f => f.id !== id);
    dispatchChange();
    return true;
  }

  async updatePortInfo(info: PortInfo): Promise<boolean> {
    const saved = await update('ports_info', info.id, info);
    if (!saved) return false;
    _portsInfo = _portsInfo.map(p => p.id === info.id ? info : p);
    dispatchChange();
    return true;
  }
  async addPortInfo(info: PortInfo): Promise<boolean> {
    const saved = await insert<PortInfo>('ports_info', info);
    if (!saved) return false;
    _portsInfo = [..._portsInfo, saved]; dispatchChange();
    return true;
  }
  async deletePortInfo(id: string): Promise<boolean> {
    const removed = await remove('ports_info', id);
    if (!removed) return false;
    _portsInfo = _portsInfo.filter(p => p.id !== id);
    dispatchChange();
    return true;
  }

  // ─── procurement ───────────────────────────────────────────────────────────

  async addProcurement(p: Procurement): Promise<boolean> {
    const saved = await insert<Procurement>('procurement', p);
    if (saved) { _procurements = [..._procurements, saved]; await auditLog('EXP', `General Procurement ${p.itemDescription}`); dispatchChange(); return true; } return false;
  }
  async updateProcurement(p: Procurement): Promise<boolean> {
    const saved = await update('procurement', p.id, p);
    if (!saved) return false;
    _procurements = _procurements.map(item => item.id === p.id ? p : item);
    dispatchChange();
    return true;
  }
  async deleteProcurement(id: string): Promise<boolean> {
    const removed = await remove('procurement', id);
    if (!removed) return false;
    _procurements = _procurements.filter(p => p.id !== id);
    dispatchChange();
    return true;
  }
  async updateProcurementStatus(id: string, status: 'PENDING' | 'COMPLETED'): Promise<void> {
    await update('procurement', id, { status });
    _procurements = _procurements.map(p => p.id === id ? { ...p, status } : p);
    dispatchChange();
  }

  // ─── gas ───────────────────────────────────────────────────────────────────

  async addGasTransaction(t: GasTransaction): Promise<boolean> {
    const saved = await insert<GasTransaction>('gas_transactions', t);
    if (saved) { _gasTransactions = [..._gasTransactions, saved]; await auditLog('EXP', `Gas Topup ${t.amount}`); dispatchChange(); return true; } return false;
  }
  async updateGasTransaction(t: GasTransaction): Promise<boolean> {
    const saved = await update('gas_transactions', t.id, t);
    if (!saved) return false;
    _gasTransactions = _gasTransactions.map(item => item.id === t.id ? t : item);
    dispatchChange();
    return true;
  }
  async deleteGasTransaction(id: string): Promise<boolean> {
    const removed = await remove('gas_transactions', id);
    if (!removed) return false;
    _gasTransactions = _gasTransactions.filter(t => t.id !== id);
    dispatchChange();
    return true;
  }

  // ─── employees / payroll ───────────────────────────────────────────────────

  async addEmployee(e: Employee): Promise<boolean> {
    const saved = await insert<Employee>('employees', e);
    if (saved) { _employees = [..._employees, saved]; dispatchChange(); return true; } return false;
  }
  async updateEmployee(e: Employee): Promise<boolean> {
    const saved = await update('employees', e.id, e);
    if (!saved) return false;
    _employees = _employees.map(item => item.id === e.id ? e : item);
    dispatchChange();
    return true;
  }
  async deleteEmployee(id: string): Promise<boolean> {
    const removed = await remove('employees', id);
    if (!removed) return false;
    _employees = _employees.filter(e => e.id !== id);
    dispatchChange();
    return true;
  }
  async addPayrollTransaction(t: PayrollTransaction): Promise<boolean> {
    const saved = await insert<PayrollTransaction>('payroll_transactions', t);
    if (saved) { _payrollTransactions = [..._payrollTransactions, saved]; dispatchChange(); return true; } return false;
  }
  async updatePayrollTransaction(t: PayrollTransaction): Promise<boolean> {
    const saved = await update('payroll_transactions', t.id, t);
    if (!saved) return false;
    _payrollTransactions = _payrollTransactions.map(item => item.id === t.id ? t : item);
    dispatchChange();
    return true;
  }
  async deletePayrollTransaction(id: string): Promise<boolean> {
    const removed = await remove('payroll_transactions', id);
    if (!removed) return false;
    _payrollTransactions = _payrollTransactions.filter(t => t.id !== id);
    dispatchChange();
    return true;
  }

  // ─── food / transport / port rent ──────────────────────────────────────────

  async addFoodExpense(e: FoodExpense): Promise<boolean> {
    const saved = await insert<FoodExpense>('food_expenses', e);
    if (saved) { _foodExpenses = [..._foodExpenses, saved]; await auditLog('EXP', `Food Allowance ${e.amount}`); dispatchChange(); return true; } return false;
  }
  async updateFoodExpense(e: FoodExpense): Promise<boolean> {
    const saved = await update('food_expenses', e.id, e);
    if (!saved) return false;
    _foodExpenses = _foodExpenses.map(item => item.id === e.id ? e : item);
    dispatchChange();
    return true;
  }
  async deleteFoodExpense(id: string): Promise<boolean> {
    const removed = await remove('food_expenses', id);
    if (!removed) return false;
    _foodExpenses = _foodExpenses.filter(e => e.id !== id);
    dispatchChange();
    return true;
  }

  async addTransportExpense(e: TransportExpense): Promise<boolean> {
    const saved = await insert<TransportExpense>('transport_expenses', e);
    if (saved) { _transportExpenses = [..._transportExpenses, saved]; await auditLog('EXP', `Transport ${e.amount}`); dispatchChange(); return true; } return false;
  }
  async updateTransportExpense(e: TransportExpense): Promise<boolean> {
    const saved = await update('transport_expenses', e.id, e);
    if (!saved) return false;
    _transportExpenses = _transportExpenses.map(item => item.id === e.id ? e : item);
    dispatchChange();
    return true;
  }
  async deleteTransportExpense(id: string): Promise<boolean> {
    const removed = await remove('transport_expenses', id);
    if (!removed) return false;
    _transportExpenses = _transportExpenses.filter(e => e.id !== id);
    dispatchChange();
    return true;
  }

  async addPortRent(e: PortRent): Promise<boolean> {
    const saved = await insert<PortRent>('port_rents', e);
    if (saved) { _portRents = [..._portRents, saved]; await auditLog('EXP', `Port Rent ${e.amount} at ${e.port}`); dispatchChange(); return true; } return false;
  }
  async updatePortRent(e: PortRent): Promise<boolean> {
    const saved = await update('port_rents', e.id, e);
    if (!saved) return false;
    _portRents = _portRents.map(item => item.id === e.id ? e : item);
    dispatchChange();
    return true;
  }
  async deletePortRent(id: string): Promise<boolean> {
    const removed = await remove('port_rents', id);
    if (!removed) return false;
    _portRents = _portRents.filter(e => e.id !== id);
    dispatchChange();
    return true;
  }

  // ─── audit / history ───────────────────────────────────────────────────────

  async totalSystemWipe(): Promise<void> {
    // Destructive wipe is enforced by a SECURITY DEFINER database function.
    // Never trust the browser's cached role for this operation.
    const { data, error } = await supabase.rpc('admin_total_system_wipe');
    if (error || !data?.ok) {
      _lastDbError = error?.message || 'Administrator access required for total system wipe.';
      throw new Error(_lastDbError);
    }

    _operations = []; _invoices = []; _payments = []; _procurements = [];
    _gasTransactions = []; _payrollTransactions = []; _foodExpenses = [];
    _transportExpenses = []; _portRents = []; _reservations = [];
    _customerPrices = []; _notifications = [];
    _users = _users.filter(u => u.role !== UserRole.CUSTOMER);
    _stock = _stock.map(s => ({ ...s, status: GensetStatus.IN_STOCK }));
    await auditLog('CRITICAL', 'TOTAL SYSTEM WIPE EXECUTED. DATA PURGED.');
    dispatchChange();
  }

  async restartHistory(): Promise<boolean> {
    // A clean audit log is a valid state. Check visibility first so an empty
    // table is not reported as an RLS failure.
    const { count, error: countError } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      _lastDbError = `audit_log: ${countError.message}`;
      console.error('[supabaseDb] inspect audit history:', countError.message);
      return false;
    }

    if ((count ?? 0) === 0) {
      _auditLogs = [];
      dispatchChange();
      return true;
    }

    const { data, error } = await supabase
      .from('audit_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (error) {
      _lastDbError = `audit_log: ${error.message}`;
      console.error('[supabaseDb] clear audit history:', error.message);
      return false;
    }

    if (!data || data.length === 0) {
      _lastDbError = 'audit_log: records exist but none were deleted (access denied or concurrent change)';
      return false;
    }

    _auditLogs = [];
    dispatchChange();
    return true;
  }

  undo(): boolean {
    // Undo is not supported in a real database — no-op but keeps compatibility
    console.warn('[supabaseDb] undo() is not supported with a real database.');
    return false;
  }
}

export const db = new SupabaseDB();
