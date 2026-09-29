
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { Invoice, User, UserRole, Operation, InvoiceSettings, Payment, hasReadOnlyAccess } from '../types';
import InvoiceView from '../components/InvoiceView';

const normalizeCustomerName = (value?: string) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const belongsToCustomer = (record: { customerId?: string; customerName?: string }, customer: User) => {
  if (record.customerId) return record.customerId === customer.id;
  const recordName = normalizeCustomerName(record.customerName);
  return Boolean(recordName && [customer.companyName, customer.name].some(name => normalizeCustomerName(name) === recordName));
};
const money = (value: string | number | undefined) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

export const ProLedger: React.FC<{
  partner: User;
  onClose: () => void;
  branding?: InvoiceSettings;
}> = ({ partner, onClose, branding }) => {
  const { lang } = useContext(LanguageContext);
  const isDark = useContext(ThemeContext).theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const ops = db.getCustomerOperations(partner.id, partner.companyName || partner.name);
  const unbilledOps = ops.filter(o => !o.invoiced);
  const unbilledTotal = unbilledOps.reduce((s, o) => s + (parseFloat(String(o.rate || '0').replace(/,/g,'')) || 0) + (parseFloat(String(o.vat || '0').replace(/,/g,'')) || 0), 0);
  const invoices = db.getInvoices().filter(i => belongsToCustomer(i, partner));
  const unpaidInvoices = invoices.filter(i => i.status === 'UNPAID');
  const unpaidInvoicesTotal = unpaidInvoices.reduce((s, i) => s + Math.max(0, Number(i.amount || 0) - db.getInvoicePaidAmount(i.id)), 0);
  const payments = db.getPayments().filter(p => p.customerId === partner.id);
  const allocatedPayments = db.getPaymentAllocations()
    .filter(allocation => invoices.some(invoice => invoice.id === allocation.invoiceId))
    .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
  const historicalPayments = Math.max(0, payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) - allocatedPayments);
  const historicalOpeningBalance = Number(partner.pastOutstandingAmount || 0) + historicalPayments;
  
  const netDue = Number(partner.pastOutstandingAmount || 0) + unpaidInvoicesTotal + unbilledTotal;

  const settings = branding || {
    primaryColor: '#001F3F',
    currency: 'EGP',
    logoUrl: '',
    stampUrl: ''
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[700] flex items-center justify-center p-0 lg:p-12 overflow-hidden ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
       <style>{`
         @media print {
           @page { margin: 0; size: A4; }
           body { visibility: hidden; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
           #root { overflow: visible !important; height: auto !important; }
           .ledger-printable-area { 
             visibility: visible !important; 
             position: absolute !important; 
             left: 0 !important; 
             top: 0 !important; 
             width: 210mm !important; 
             height: auto !important; 
             margin: 0 !important;
             padding: 1.5cm !important;
             background: white !important;
             z-index: 9999 !important;
           }
           .no-print { display: none !important; }
           .ledger-printable-area * { color: black !important; visibility: visible !important; }
           .total-highlight { background-color: #001F3F !important; -webkit-print-color-adjust: exact; }
           .total-highlight * { color: #C2A378 !important; }
         }
       `}</style>
       <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-6xl w-full h-full overflow-hidden flex flex-col border-[10px] border-slate-900 animate-in zoom-in-95">
          <div className="p-8 bg-slate-900 text-white flex justify-between items-center no-print shrink-0">
             <div className="text-start">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[#C2A378]">{isAr ? 'كشف الحساب الاحترافي' : 'Professional Ledger'}</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mt-1">{isAr ? 'كشف حساب رسمي' : 'Official Statement of Account'}</p>
             </div>
             <div className="flex gap-4">
                <button onClick={() => window.print()} className="bg-blue-600 px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-700 transition-all">{isAr ? 'تصدير PDF / طباعة الكشف' : 'Export PDF / Print Statement'}</button>
                <button onClick={onClose} className="bg-rose-600 px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-rose-700 transition-all">{isAr ? 'خروج' : 'Exit'}</button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-100 p-8 custom-scrollbar text-start">
             <div className="max-w-5xl mx-auto bg-white p-12 lg:p-16 shadow-2xl min-h-[11in] text-slate-900 relative flex flex-col ledger-printable-area">
                <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-10">
                   <div>
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} className="h-24 object-contain mb-6" alt="Company logo" />
                      ) : (
                        <div className="flex items-center gap-4 mb-6">
                           <img src="/nile-fleet-logo.png" className="h-24 object-contain mb-6" alt="Nile Fleet" />
                           <h1 className="text-3xl font-black italic uppercase tracking-tighter">NILE <span className="text-blue-600">FLEET</span></h1>
                        </div>
                      )}
                      <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900">{isAr ? 'كشف حساب مجمع' : 'STATEMENT OF ACCOUNT'}</h2>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">{isAr ? 'الدورة المالية' : 'Fiscal Cycle'}: {new Date().getFullYear()}</p>
                   </div>
                   <div className={`${isAr ? 'text-left' : 'text-right'}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'الشريك التجاري' : 'Commercial Partner'}:</p>
                      <h4 className="text-2xl font-black uppercase italic text-blue-600">{translateEntity(partner.companyName || partner.name, lang)}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-4">{isAr ? 'تاريخ الاستخراج' : 'Generation'}: {new Date().toLocaleString()}</p>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-12">
                   <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isAr ? 'مديونية سابقة' : 'Historical Debt'}</p>
                      <p className="text-2xl lg:text-3xl font-black text-slate-900">{settings.currency} {historicalOpeningBalance.toLocaleString()}</p>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{isAr ? 'لم يُفوتر بعد' : 'Unbilled Ops'}</p>
                      <p className="text-2xl lg:text-3xl font-black text-blue-600">{settings.currency} {unbilledTotal.toLocaleString()}</p>
                   </div>
                   <div className="bg-[#001F3F] p-8 rounded-[2rem] shadow-xl total-highlight">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">{isAr ? 'صافي المستحق' : 'Net Due'}</p>
                      <p className="text-2xl lg:text-3xl font-black text-[#C2A378] italic">{settings.currency} {netDue.toLocaleString()}</p>
                   </div>
                </div>

                <div className="space-y-10 flex-1">
                   <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">{isAr ? 'بيان المعاملات' : 'Transaction Manifest'}</h4>
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left border-collapse min-w-[1250px]">
                          <thead className="bg-slate-900 text-white text-[9px] font-black uppercase">
                            <tr>
                              <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                              <th className="p-3">{isAr ? 'رقم الحجز' : 'Booking Number'}</th>
                              <th className="p-3">{isAr ? 'رقم الحاوية' : 'Container'}</th>
                              <th className="p-3">{isAr ? 'ميناء الدخول' : 'Port In'}</th>
                              <th className="p-3">{isAr ? 'ميناء الخروج' : 'Port Out'}</th>
                              <th className="p-3">{isAr ? 'السعر' : 'Rate'}</th>
                              <th className="p-3">{isAr ? 'الشاحن' : 'Shipper'}</th>
                              <th className="p-3">{isAr ? 'الناقل' : 'Trucker'}</th>
                              <th className="p-3">{isAr ? 'المدين' : 'Debit'}</th>
                              <th className="p-3">{isAr ? 'الدائن' : 'Credit'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[10px] font-bold">
                            {invoices.map(inv => (
                              <tr key={inv.id}>
                                <td className="p-3 text-slate-400">{inv.date}</td>
                                <td className="p-3 font-mono">{inv.bookingNumber || '—'}</td>
                                <td className="p-3">—</td>
                                <td className="p-3">—</td>
                                <td className="p-3">—</td>
                                <td className="p-3">{Number(inv.amount || 0).toLocaleString()}</td>
                                <td className="p-3">—</td>
                                <td className="p-3">—</td>
                                <td className="p-3 text-right">{Math.max(0, Number(inv.amount || 0) - db.getInvoicePaidAmount(inv.id)).toLocaleString()}</td>
                                <td className="p-3 text-right">—</td>
                              </tr>
                            ))}
                            {unbilledOps.map(op => (
                              <tr key={op.id} className="text-blue-600/80">
                                <td className="p-3">{op.operationDate}</td>
                                <td className="p-3 font-mono">{op.bookingNumber || '—'}</td>
                                <td className="p-3 font-mono">{op.containerNumber || '—'}</td>
                                <td className="p-3">{op.clipOnPort || '—'}</td>
                                <td className="p-3">{op.clipOffPort || '—'}</td>
                                <td className="p-3 font-black">{(parseFloat(String(op.rate || '0').replace(/,/g,'')) || 0).toLocaleString()}</td>
                                <td className="p-3">{op.beneficiaryName || '—'}</td>
                                <td className="p-3">{op.trucker || '—'}</td>
                                <td className="p-3 text-right">{((parseFloat(String(op.rate || '0').replace(/,/g,'')) || 0) + (parseFloat(String(op.vat || '0').replace(/,/g,'')) || 0)).toLocaleString()}</td>
                                <td className="p-3 text-right">—</td>
                              </tr>
                            ))}
                            {payments.map(pay => (
                              <tr key={pay.id} className="bg-emerald-50/30">
                                <td className="p-3 text-slate-400">{pay.date}</td>
                                <td className="p-3 font-mono">PAY-{pay.id.split('-').pop()}</td>
                                <td className="p-3">—</td><td className="p-3">—</td><td className="p-3">—</td><td className="p-3">—</td><td className="p-3">—</td><td className="p-3">{pay.reference || '—'}</td>
                                <td className="p-3 text-right">—</td>
                                <td className="p-3 text-right text-emerald-600">{Number(pay.amount || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs uppercase italic total-highlight">
                              <td colSpan={8} className="p-5 text-right">{isAr ? 'إجمالي الرصيد المستحق النهائي' : 'Closing Reconciled Total'}</td>
                              <td colSpan={2} className="p-5 text-right text-2xl text-[#C2A378]">{settings.currency} {netDue.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                   </div>
                </div>

                <div className="mt-16 flex justify-between items-end">
                   <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4 italic">{isAr ? 'كشف حساب موثق رقمياً • قيادة أسطول النيل' : 'Digitally Verified Ledger • Nile Fleet Command'}</p>
                      <div className="w-64 h-px bg-slate-100"></div>
                   </div>
                   <div className="relative">
                      {settings.stampUrl && (
                        <div className="absolute bottom-0 right-0 -mr-12 -mb-12 w-48 h-48 opacity-90 -rotate-12 pointer-events-none">
                           <img src={settings.stampUrl} className="w-full h-full object-contain mix-blend-multiply contrast-125 shadow-lg" alt="Stamp" />
                        </div>
                      )}
                      <div className="text-center relative z-10">
                        <div className="w-48 h-12 border-b-2 border-slate-900 mb-2"></div>
                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic">{isAr ? 'المراقب المالي المعتمد' : 'Authorized Accounts Controller'}</p>
                      </div>
                   </div>
                </div>

                <div className="mt-12 flex flex-col items-center gap-2 opacity-20 text-slate-900 no-print text-center">
                   <div className="w-12 h-px bg-slate-300"></div>
                   <p className="text-[8px] font-black uppercase tracking-[0.5em]">POWERED BY BEBITO</p>
                   <p className="text-[7px] font-bold text-slate-500 uppercase mt-1 italic leading-none">Mohamed A-Alawy | +20 114 647 5759</p>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const Financials: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [invoices, setInvoices] = useState(db.getInvoices());
  const [operations, setOperations] = useState(db.getOperations());
  const [users, setUsers] = useState(db.getUsers());
  const [payments, setPayments] = useState(db.getPayments());
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedInvIds, setSelectedInvIds] = useState<Set<string>>(new Set());
  const [showProLedger, setShowProLedger] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [autoSettleSelection, setAutoSettleSelection] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showPaymentsRegister, setShowPaymentsRegister] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<Payment | null>(null);
  const [paymentManageError, setPaymentManageError] = useState('');
  const [paymentManageSaving, setPaymentManageSaving] = useState(false);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);

  const refreshData = () => {
    setInvoices([...db.getInvoices()]);
    setOperations([...db.getOperations()]);
    setUsers([...db.getUsers()]);
    setPayments([...db.getPayments()]);
    if (selectedUser) {
      const updatedUser = db.getUsers().find(u => u.id === selectedUser.id);
      if (updatedUser) setSelectedUser(updatedUser);
    }
  };

  const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);

  const accountBreakdown = useMemo(() => {
    if (!selectedUser) return { totalExposure: 0, unbilledTotal: 0, unpaidInvoicesTotal: 0 };
    const customerOperations = db.getCustomerOperations(selectedUser.id, selectedUser.companyName || selectedUser.name);
    const unbilledOperations = customerOperations.filter(o => !o.invoiced);
    const unbilledTotal = unbilledOperations.reduce((s, o) => s + money(o.rate) + money(o.vat), 0);
    const userInvoices = invoices.filter(i => belongsToCustomer(i, selectedUser));
    const userPayments = db.getPayments().filter(payment => payment.customerId === selectedUser.id);
    const unpaidInvoicesTotal = userInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + Math.max(0, Number(i.amount || 0) - db.getInvoicePaidAmount(i.id)), 0);
    const payableBalance = Number(selectedUser.pastOutstandingAmount || 0) + unpaidInvoicesTotal;
    const totalExposure = (selectedUser?.pastOutstandingAmount || 0) + unpaidInvoicesTotal + unbilledTotal;
    const historicalPayments = Math.max(0, userPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) - db.getPaymentAllocations()
      .filter(allocation => userInvoices.some(invoice => invoice.id === allocation.invoiceId))
      .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0));
    const historicalOpeningBalance = Number(selectedUser.pastOutstandingAmount || 0) + historicalPayments;
    return { totalExposure, payableBalance, historicalOpeningBalance, unbilledTotal, unpaidInvoicesTotal, userInvoices, userPayments, unbilledOperations };
  }, [selectedUser, operations, invoices]);

  const handleReceivePayment = async () => {
    if (!selectedUser || !paymentAmount || paymentSaving) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setPaymentError(isAr ? 'أدخل مبلغاً صحيحاً أكبر من صفر.' : 'Enter a valid amount greater than zero.'); return; }
    if (amount > accountBreakdown.payableBalance) { setPaymentError(isAr ? 'المبلغ أكبر من الرصيد المفوتر المستحق.' : 'Amount exceeds the currently invoiced outstanding balance.'); return; }
    setPaymentSaving(true); setPaymentError('');
    const saved = await db.addPayment({
      id: `PAY-${Date.now()}`,
      customerId: selectedUser.id,
      customerName: selectedUser.companyName || selectedUser.name,
      amount,
      date: new Date().toISOString().split('T')[0],
      reference: paymentRef || 'Bulk Deposit',
      type: 'CASH'
    }, autoSettleSelection ? Array.from(selectedInvIds) : []);
    if (!saved) { setPaymentError(db.getLastDbError() || (isAr ? 'تعذر حفظ الدفعة. لم يتم اعتمادها.' : 'Could not save payment. It was not recorded.')); setPaymentSaving(false); return; }
    setPaymentAmount(''); setPaymentRef(''); setSelectedInvIds(new Set());
    setShowPaymentModal(false); setPaymentSaving(false); refreshData();
  };

  const visibleCustomers = useMemo(() => {
    const q = normalizeCustomerName(customerSearch);
    if (!q) return customers;
    return customers.filter(customer => {
      const ops = db.getCustomerOperations(customer.id, customer.companyName || customer.name);
      const customerInvoices = invoices.filter(invoice => belongsToCustomer(invoice, customer));
      const payments = db.getPayments().filter(payment => payment.customerId === customer.id);
      return [customer.name, customer.companyName, customer.email, customer.id,
        ...customerInvoices.flatMap(invoice => [invoice.id, invoice.invoiceNo, invoice.bookingNumber, ...(invoice.containerNumbers || [])]),
        ...ops.flatMap(op => [op.bookingNumber, op.containerNumber, op.gensetNumber]),
        ...payments.flatMap(payment => [payment.reference, payment.id])]
        .some(value => normalizeCustomerName(String(value || '')).includes(q));
    });
  }, [customers, customerSearch, invoices, operations]);

  const visiblePayments = useMemo(() => {
    const q = normalizeCustomerName(paymentSearch);
    return [...payments]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(payment => {
        const customer = users.find(user => user.id === payment.customerId);
        const fields = [payment.customerName, customer?.companyName, customer?.name, payment.date, payment.reference, payment.id, payment.type, payment.amount];
        return !q || fields.some(value => normalizeCustomerName(String(value ?? '')).includes(q));
      });
  }, [payments, paymentSearch, users]);

  const openPaymentEditor = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentDraft({ ...payment });
    setPaymentManageError('');
  };

  const savePaymentEdit = async () => {
    if (!editingPayment || !paymentDraft || paymentManageSaving) return;
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentManageError(isAr ? 'أدخل مبلغاً صحيحاً أكبر من صفر.' : 'Enter a valid amount greater than zero.');
      return;
    }
    const hasAllocations = db.getPaymentAllocations().some(allocation => allocation.paymentId === editingPayment.id);
    if (hasAllocations && amount !== Number(editingPayment.amount)) {
      setPaymentManageError(isAr ? 'لا يمكن تغيير مبلغ دفعة موزعة على فواتير. احذفها ثم سجّل الدفعة بالمبلغ الصحيح.' : 'This receipt is allocated to invoices. Delete it and record a new receipt to change its amount safely.');
      return;
    }
    setPaymentManageSaving(true);
    const saved = await db.updatePayment({ ...paymentDraft, amount });
    if (!saved) {
      setPaymentManageError(db.getLastDbError() || (isAr ? 'تعذر تحديث الدفعة.' : 'Could not update this receipt.'));
      setPaymentManageSaving(false);
      return;
    }
    setEditingPayment(null);
    setPaymentDraft(null);
    setPaymentManageSaving(false);
    refreshData();
  };

  const removePayment = async (payment: Payment) => {
    const hasAllocations = db.getPaymentAllocations().some(allocation => allocation.paymentId === payment.id);
    const message = hasAllocations
      ? `Delete the ${Number(payment.amount || 0).toLocaleString()} EGP receipt from ${payment.customerName}? Its invoice and historical balance allocations will be reversed.`
      : `Delete the ${Number(payment.amount || 0).toLocaleString()} EGP receipt from ${payment.customerName}? This older receipt has no saved allocation details, so the receipt will be removed but past balances cannot be recalculated automatically.`;
    if (!window.confirm(message)) return;
    setPaymentManageError('');
    setPaymentManageSaving(true);
    const removed = await db.deletePayment(payment.id);
    if (!removed) {
      setPaymentManageError(db.getLastDbError() || (isAr ? 'تعذر حذف الدفعة.' : 'Could not delete this receipt.'));
      setPaymentManageSaving(false);
      return;
    }
    if (editingPayment?.id === payment.id) { setEditingPayment(null); setPaymentDraft(null); }
    setPaymentManageSaving(false);
    refreshData();
  };

  return (
    <div className={`max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 text-start pb-32 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      
      {/* Top Reconciled Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        {[
          { label: t.unpaidMoney, value: customers.reduce((acc, c) => {
            const uI = db.getInvoices().filter(i => belongsToCustomer(i, c) && i.status === 'UNPAID').reduce((s,i)=>s+Math.max(0, i.amount - db.getInvoicePaidAmount(i.id)), 0);
            const uO = db.getCustomerOperations(c.id, c.companyName || c.name).filter(o => !o.invoiced).reduce((s,o)=>s+money(o.rate)+money(o.vat), 0);
            return acc + (c.pastOutstandingAmount || 0) + uI + uO;
          }, 0), color: 'text-rose-600', icon: '🏦', bg: 'bg-rose-50/30' },
          { label: t.liveUnbilled, value: operations.filter(o=>o.status==='DONE'&&!o.invoiced).reduce((s,o)=>s+(parseFloat(o.rate) || 0), 0), color: 'text-blue-600', icon: '🚛', bg: 'bg-blue-50/30' },
          { label: t.historicalLoad, value: customers.reduce((a,b)=>a+(b.pastOutstandingAmount||0),0), color: 'text-[#C2A378]', icon: '📜', bg: 'bg-amber-50/30' },
          { label: 'Settled Month-to-Date', value: db.getPayments().filter(p => p.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s,p)=>s+p.amount,0), color: 'text-emerald-600', icon: '💰', bg: 'bg-emerald-50/30' },
        ].map((stat, i) => (
          <div key={i} className={`p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all hover:scale-105 ${stat.bg} ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className={`text-2xl font-black italic tracking-tighter ${stat.color}`}>
                   {isAr ? 'ج.م' : 'EGP'} {Number(stat.value || 0).toLocaleString()}
                </p>
             </div>
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-8 no-print min-h-[700px]">
        
        {/* CUSTOMER SELECTION SIDEBAR */}
        <div className="xl:w-[380px] space-y-6 shrink-0">
          <div className={`p-8 rounded-[3.5rem] border shadow-2xl h-full flex flex-col ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
             <div className="flex items-center justify-between gap-3 mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">💳</div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">{t.partnerPortfolios}</h3>
                </div>
                <button onClick={() => { setShowPaymentsRegister(true); setPaymentManageError(''); }} className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-[9px] font-black uppercase tracking-wider text-white shadow-lg transition-colors">
                  💰 {isAr ? 'كل المقبوضات' : 'Received money'} <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5">{payments.length}</span>
                </button>
             </div>
             
             <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                <label className="block mb-4">
                  <span className="sr-only">{isAr ? 'ابحث عن عميل أو فاتورة أو حجز أو حاوية أو دفعة' : 'Search customers, invoices, bookings, containers, or payments'}</span>
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder={isAr ? 'ابحث باسم العميل أو الفاتورة أو الحجز أو الحاوية أو مرجع الدفع' : 'Search customer, invoice, booking, container, or payment reference'} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs font-bold outline-none focus:border-blue-500" />
                </label>
                {visibleCustomers.map(cust => {
                  const uI = db.getInvoices().filter(i => belongsToCustomer(i, cust) && i.status === 'UNPAID').reduce((s,i)=>s+Math.max(0, i.amount - db.getInvoicePaidAmount(i.id)), 0);
                  const uO = db.getCustomerOperations(cust.id, cust.companyName || cust.name).filter(o => !o.invoiced).reduce((s,o)=>s+money(o.rate)+money(o.vat), 0);
                  const total = (cust.pastOutstandingAmount || 0) + uI + uO;
                  const isSelected = selectedUser?.id === cust.id;
                  
                  return (
                    <button 
                      key={cust.id} 
                      onClick={() => { setSelectedUser(cust); setSelectedInvIds(new Set()); }}
                      className={`w-full text-start p-6 rounded-[2.2rem] border-2 transition-all relative overflow-hidden group ${isSelected ? 'bg-slate-900 border-blue-600 text-white shadow-2xl scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800/40 border-transparent hover:border-slate-200'}`}
                    >
                       <div className="flex justify-between items-start relative z-10">
                          <div>
                            <p className={`font-black uppercase text-xs tracking-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{translateEntity(cust.companyName || cust.name, lang)}</p>
                            <p className={`text-[9px] font-bold mt-1 uppercase tracking-widest ${isSelected ? 'text-blue-400' : 'text-slate-400'}`}>Net Debt Position</p>
                          </div>
                          {total > 150000 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black animate-pulse">LOCKED</span>}
                       </div>
                       <p className={`text-xl font-black mt-4 relative z-10 ${isSelected ? 'text-[#C2A378]' : 'text-blue-600'}`}>
                          {isAr ? 'ج.م' : 'EGP'} {Number(total || 0).toLocaleString()}
                       </p>
                       {isSelected && <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-blue-600/10 rounded-full blur-2xl"></div>}
                    </button>
                  );
                })}
                {visibleCustomers.length === 0 && <p className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-5 text-center text-xs font-bold text-slate-400">{isAr ? 'لا توجد نتائج مطابقة.' : 'No matching customers or financial records.'}</p>}
             </div>
          </div>
        </div>

        {/* MAIN LEDGER AREA */}
        <div className="flex-1 space-y-8 min-w-0">
          {selectedUser ? (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
               {/* Account Profile Card */}
               <div className={`p-10 rounded-[3.5rem] border shadow-2xl flex flex-col md:flex-row gap-10 items-center justify-between relative overflow-hidden ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-[#C2A378] to-emerald-600 opacity-50"></div>
                  <div className="flex items-center gap-8 text-start relative z-10">
                    <div className="w-24 h-24 bg-blue-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-5xl shadow-inner uppercase font-black text-blue-600 border border-blue-100">
                      {(selectedUser.companyName || selectedUser.name)[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                         <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">{translateEntity(selectedUser.companyName || selectedUser.name, lang)}</h3>
                         <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Verified Node</span>
                      </div>
                      <div className="flex gap-6 mt-4">
                        <button onClick={() => setShowProLedger(true)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-8 flex items-center gap-2 group">
                           <span className="group-hover:scale-125 transition-transform">📄</span> {isAr ? 'توليد كشف حساب رسمي' : 'GENERATE OFFICIAL STATEMENT'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                     <div className="text-center bg-slate-50 dark:bg-slate-800 px-8 py-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-inner">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t.liveUnbilled}</p>
                        <p className="text-2xl font-black text-blue-600">EGP {Number(accountBreakdown.unbilledTotal || 0).toLocaleString()}</p>
                     </div>
                     <div className="text-center bg-[#001F3F] px-8 py-5 rounded-[2rem] shadow-xl">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Grand Total Due</p>
                        <p className="text-2xl font-black text-[#C2A378] italic">EGP {Number(accountBreakdown.totalExposure || 0).toLocaleString()}</p>
                     </div>
                  </div>

                  {!isReadOnly && (
                    <button onClick={() => setShowPaymentModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 z-10">
                      {t.receivePayment}
                    </button>
                  )}
               </div>

               {/* Transaction manifest table */}
               <div className={`rounded-[3.5rem] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
                  <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-xs font-black uppercase italic tracking-[0.3em] text-slate-400">{t.historicalIndebtedness}</h3>
                     <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full">{accountBreakdown.userInvoices.length} Documents Active</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-start border-collapse">
                        <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                           <tr>
                              <th className="px-6 py-6 w-10 text-center">
                                <input type="checkbox" className="rounded-lg bg-transparent border-slate-500" checked={selectedInvIds.size === accountBreakdown.userInvoices.filter(i => i.status === 'UNPAID').length && accountBreakdown.userInvoices.filter(i => i.status === 'UNPAID').length > 0} onChange={() => {
                                  const unp = accountBreakdown.userInvoices.filter(i => i.status === 'UNPAID');
                                  if (selectedInvIds.size === unp.length) setSelectedInvIds(new Set());
                                  else setSelectedInvIds(new Set(unp.map(i=>i.id)));
                                }} />
                              </th>
                              <th className="px-8 py-6">{t.date}</th>
                              <th className="px-8 py-6">Transaction Ref</th>
                              <th className="px-8 py-6 text-right">Debit Flow (+)</th>
                              <th className="px-8 py-6 text-center">{t.status}</th>
                              <th className="px-8 py-6 text-right">Document Protocol</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-white/5 text-[11px] font-bold">
                            {Number(accountBreakdown.historicalOpeningBalance || 0) > 0 && (
                             <tr className="bg-rose-50/10 italic">
                                <td className="px-6 py-6 text-center text-rose-500 font-black">⚡</td>
                                <td className="px-8 py-6 text-slate-400">System Genesis</td>
                                <td className="px-8 py-6 text-rose-600 font-black uppercase tracking-widest underline decoration-2 underline-offset-8">Historical Debt Forward</td>
                                <td className="px-8 py-6 text-right font-black text-rose-600">EGP {Number(accountBreakdown.historicalOpeningBalance || 0).toLocaleString()}</td>
                                <td className="px-8 py-6 text-center"><span className="bg-rose-100 text-rose-700 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border border-rose-200">OPEN BALANCE</span></td>
                                <td className="px-8 py-6 text-right opacity-30 italic">Pre-Deployment Legacy</td>
                             </tr>
                           )}
                           {accountBreakdown.unbilledOperations.map(op => (
                             <tr key={`op-${op.id}`} onClick={() => setCustomerSearch(op.bookingNumber || op.containerNumber || '')} className="cursor-pointer bg-blue-50/20 hover:bg-blue-50/60 transition-colors" title={isAr ? 'اضغط للبحث عن الحجز أو الحاوية' : 'Click to find this booking or container'}>
                                <td className="px-6 py-6 text-center text-blue-600">🚛</td>
                                <td className="px-8 py-6 text-slate-400 font-mono">{op.operationDate}</td>
                                <td className="px-8 py-6"><div className="font-black text-blue-900 dark:text-blue-400">{op.bookingNumber || '—'}</div><div className="text-[9px] text-slate-400">{op.containerNumber || '—'}</div></td>
                                <td className="px-8 py-6 text-right font-black text-blue-700 dark:text-blue-300">EGP {(money(op.rate) + money(op.vat)).toLocaleString()}</td>
                                <td className="px-8 py-6 text-center"><span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">UNBILLED</span></td>
                                <td className="px-8 py-6 text-right text-slate-400">{op.containerNumber || '—'}</td>
                             </tr>
                           ))}
                           {accountBreakdown.userPayments.map(payment => (
                             <tr key={`payment-${payment.id}`} onClick={() => setCustomerSearch(payment.reference || payment.id)} className="cursor-pointer bg-emerald-50/20 hover:bg-emerald-50/60 transition-colors" title={isAr ? 'اضغط للبحث عن مرجع الدفعة' : 'Click to find this payment reference'}>
                                <td className="px-6 py-6 text-center text-emerald-600">💰</td>
                                <td className="px-8 py-6 text-slate-400 font-mono">{payment.date}</td>
                                <td className="px-8 py-6"><div className="font-black text-emerald-700 dark:text-emerald-400">{payment.reference || payment.id}</div><div className="text-[9px] text-slate-400">PAYMENT • {payment.type}</div></td>
                                <td className="px-8 py-6 text-right font-black text-emerald-700 dark:text-emerald-400">− EGP {Number(payment.amount || 0).toLocaleString()}</td>
                                <td className="px-8 py-6 text-center"><span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">RECEIVED</span></td>
                                <td className="px-8 py-6 text-right text-slate-400">{db.getPaymentAllocations().filter(allocation => allocation.paymentId === payment.id).length} allocations</td>
                             </tr>
                           ))}
                           {accountBreakdown.userInvoices.map(inv => (
                             <tr key={inv.id} onClick={() => setViewingInvoice(inv)} className={`cursor-pointer hover:bg-blue-50/30 transition-all group ${selectedInvIds.has(inv.id) ? 'bg-blue-50 shadow-inner' : ''}`} title={isAr ? 'اضغط لفتح الفاتورة' : 'Click to open invoice'}>
                                <td className="px-6 py-6 text-center">
                                   {inv.status === 'UNPAID' && <input type="checkbox" onClick={e => e.stopPropagation()} checked={selectedInvIds.has(inv.id)} onChange={() => {
                                      const newSet = new Set(selectedInvIds);
                                      if (newSet.has(inv.id)) newSet.delete(inv.id);
                                      else newSet.add(inv.id);
                                      setSelectedInvIds(newSet);
                                   }} className="rounded-lg" />}
                                </td>
                                <td className="px-8 py-6 text-slate-400 font-mono">{inv.date}</td>
                                <td className="px-8 py-6">
                                   <div className="flex flex-col">
                                      <span className="font-black text-blue-900 dark:text-blue-400 uppercase tracking-tighter text-sm">#INV-{String(inv.invoiceNo ?? 0).padStart(5, '0')}</span>
                                      <span className="text-[8px] font-black text-slate-400 uppercase mt-0.5 tracking-widest">BK: {inv.bookingNumber}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6 text-right font-black text-slate-900 dark:text-white text-base">EGP {Number(inv.amount || 0).toLocaleString()}</td>
                                <td className="px-8 py-6 text-center">
                                   <span className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                      {translateEntity(inv.status, lang)}
                                   </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                   <button onClick={e => { e.stopPropagation(); setViewingInvoice(inv); }} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#001F3F] hover:text-white transition-all border border-slate-200 dark:border-white/10">View Doc</button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          ) : (
            <div className="h-full bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-white/5 flex flex-col items-center justify-center text-center p-20">
               <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-[3rem] flex items-center justify-center text-7xl mb-10 shadow-inner animate-bounce duration-[3s]">🏦</div>
               <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">{t.commercialWallet}</h3>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-6 max-w-md mx-auto leading-relaxed">Select a commercial partner to perform a fiscal audit, manage outstanding debits, or authorize credit settlements.</p>
            </div>
          )}
        </div>
      </div>

      {/* RECEIVE PAYMENT MODAL */}
      {showPaymentModal && selectedUser && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6">
           <div className={`bg-white rounded-[4rem] shadow-2xl max-w-2xl w-full overflow-hidden border-[12px] border-slate-900 animate-in zoom-in-95 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center text-start relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#C2A378]/20 rounded-full blur-2xl -mr-16 -mt-16"></div>
                 <div className="relative z-10">
                    <h3 className="text-2xl font-black uppercase italic tracking-widest text-[#C2A378]">Credit Protocol</h3>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mt-1">Funds Ingress Authorization</p>
                 </div>
                 <button onClick={() => setShowPaymentModal(false)} className="text-white hover:text-rose-500 font-bold text-2xl relative z-10 transition-colors">✕</button>
              </div>
              <div className="p-12 space-y-10 max-h-[80vh] overflow-y-auto custom-scrollbar text-start">
                 <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 text-center space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Payer</p>
                    <p className="text-2xl font-black text-blue-900 uppercase italic tracking-tighter">{translateEntity(selectedUser.companyName || selectedUser.name, lang)}</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-3 px-1 tracking-widest">Ingress Amount (EGP)</label>
                          <input type="number" className="w-full p-8 bg-white border-4 border-blue-50 rounded-[2.5rem] font-black text-4xl text-center text-emerald-600 outline-none focus:border-emerald-500 shadow-inner transition-all" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                       </div>
                       <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 block mb-3 px-1 tracking-widest">Protocol Metadata / Ref</label>
                          <input className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-400" placeholder="e.g. Bank Transfer ID, Check Ref" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Settle Against Node</label>
                          <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 transition-all hover:bg-blue-100">
                             <input type="checkbox" checked={autoSettleSelection} onChange={e => setAutoSettleSelection(e.target.checked)} className="rounded-md border-blue-400 text-blue-600" />
                             <span className="text-[9px] font-black text-blue-700 uppercase tracking-tighter">Apply Auto</span>
                          </label>
                       </div>
                       <div className={`p-4 rounded-[2.5rem] border-4 h-64 overflow-y-auto custom-scrollbar space-y-3 transition-all ${autoSettleSelection ? 'bg-white border-blue-50 shadow-inner' : 'bg-slate-100 border-transparent opacity-30 grayscale pointer-events-none'}`}>
                          {accountBreakdown.userInvoices.filter(i => i.status === 'UNPAID').map(inv => (
                             <div 
                                key={inv.id} 
                                onClick={() => {
                                  const newSet = new Set(selectedInvIds);
                                  if (newSet.has(inv.id)) newSet.delete(inv.id);
                                  else newSet.add(inv.id);
                                  setSelectedInvIds(newSet);
                                }} 
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedInvIds.has(inv.id) ? 'bg-slate-900 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-900'}`}
                             >
                                <div className="text-start">
                                   <p className="text-[8px] font-black uppercase tracking-widest opacity-60">#INV-{String(inv.invoiceNo ?? 0).padStart(5, '0')}</p>
                                   <p className="text-[11px] font-black italic">{inv.bookingNumber}</p>
                                </div>
                                <p className={`font-black text-xs ${selectedInvIds.has(inv.id) ? 'text-[#C2A378]' : 'text-blue-600'}`}>EGP {Math.max(0, Number(inv.amount || 0) - db.getInvoicePaidAmount(inv.id)).toLocaleString()}</p>
                             </div>
                          ))}
                          {accountBreakdown.userInvoices.filter(i => i.status === 'UNPAID').length === 0 && (
                            <div className="h-full flex items-center justify-center py-10 opacity-30 italic font-black uppercase text-[10px] text-center">No outstanding ledger nodes</div>
                          )}
                       </div>
                    </div>
                 </div>
                 {paymentError && <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-bold text-rose-700">{paymentError}</p>}
                 <button disabled={paymentSaving} onClick={handleReceivePayment} className="w-full bg-slate-900 hover:bg-black disabled:opacity-60 disabled:cursor-wait text-white py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.5em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-6 border-b-4 border-blue-600">
                    <span className="text-2xl">🏦</span> {paymentSaving ? (isAr ? 'جارٍ الحفظ...' : 'SAVING...') : (isAr ? 'اعتماد العملية المالية' : 'AUTHORIZE SETTLEMENT')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showPaymentsRegister && (
        <div className={`fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
          <div className={`flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="flex items-center justify-between gap-4 bg-slate-900 p-5 text-white sm:p-7">
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-emerald-300 sm:text-2xl">{isAr ? 'سجل جميع المقبوضات' : 'All received payments'}</h2>
                <p className="mt-1 text-xs font-bold text-slate-300">{payments.length} {isAr ? 'دفعة مسجلة' : 'receipts'} · EGP {payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toLocaleString()} {isAr ? 'إجمالي' : 'total received'}</p>
              </div>
              <button onClick={() => { setShowPaymentsRegister(false); setEditingPayment(null); setPaymentDraft(null); }} aria-label={isAr ? 'إغلاق' : 'Close'} className="rounded-xl px-4 py-2 text-2xl font-bold text-white hover:bg-white/10">×</button>
            </div>
            <div className="border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5">
              <input value={paymentSearch} onChange={event => setPaymentSearch(event.target.value)} placeholder={isAr ? 'ابحث بالعميل أو التاريخ أو المرجع أو المبلغ' : 'Search customer, date, reference, amount, or method'} className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 ${isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50'}`} />
            </div>
            {paymentManageError && <div role="alert" className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 sm:mx-5">{paymentManageError}</div>}
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date / reference</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Allocation</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visiblePayments.map(payment => {
                    const customer = users.find(user => user.id === payment.customerId);
                    const allocationCount = db.getPaymentAllocations().filter(allocation => allocation.paymentId === payment.id).length;
                    return <tr key={payment.id} className="hover:bg-emerald-50/50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-4"><div className="font-black">{translateEntity(customer?.companyName || customer?.name || payment.customerName || 'Unknown customer', lang)}</div><div className="mt-1 text-[10px] text-slate-400">{payment.customerId}</div></td>
                      <td className="px-4 py-4"><div className="font-bold">{payment.date || '—'}</div><div className="mt-1 text-xs text-slate-500">{payment.reference || payment.id}</div></td>
                      <td className="px-4 py-4"><span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">{payment.type}</span></td>
                      <td className="px-4 py-4 text-right font-black text-emerald-700 dark:text-emerald-300">EGP {Number(payment.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-500">{allocationCount ? `${allocationCount} ${isAr ? 'تخصيص' : 'allocations'}` : (isAr ? 'قديم' : 'Legacy')}</td>
                      <td className="px-4 py-4 text-right">
                        {!isReadOnly && <div className="flex justify-end gap-2"><button disabled={paymentManageSaving} onClick={() => openPaymentEditor(payment)} className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-50 disabled:opacity-50">{isAr ? 'تعديل' : 'Edit'}</button><button disabled={paymentManageSaving} onClick={() => removePayment(payment)} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black uppercase text-rose-700 hover:bg-rose-50 disabled:opacity-50">{isAr ? 'حذف' : 'Delete'}</button></div>}
                      </td>
                    </tr>;
                  })}
                  {visiblePayments.length === 0 && <tr><td colSpan={6} className="px-4 py-14 text-center font-bold text-slate-400">{isAr ? 'لا توجد دفعات مطابقة.' : 'No received payments match your search.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 p-4 text-xs font-semibold text-slate-500 dark:border-slate-700">{isAr ? 'تظهر هنا دفعات جميع العملاء، بما فيها الدفعات القديمة.' : 'This register includes receipts from every customer, including older records.'}</div>
          </div>
        </div>
      )}

      {editingPayment && paymentDraft && (
        <div className={`fixed inset-0 z-[700] flex items-center justify-center bg-slate-950/70 p-4 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <h3 className="text-xl font-black">{isAr ? 'تعديل بيانات المقبوض' : 'Edit received payment'}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{translateEntity(editingPayment.customerName, lang)} · {editingPayment.id}</p>
            <div className="mt-6 grid gap-4">
              <label className="text-xs font-black uppercase text-slate-500">{isAr ? 'المبلغ (جنيه)' : 'Amount (EGP)'}<input type="number" min="0.01" step="0.01" disabled={db.getPaymentAllocations().some(allocation => allocation.paymentId === editingPayment.id)} value={paymentDraft.amount} onChange={event => setPaymentDraft({ ...paymentDraft, amount: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="text-xs font-black uppercase text-slate-500">{isAr ? 'التاريخ' : 'Date'}<input type="date" value={paymentDraft.date} onChange={event => setPaymentDraft({ ...paymentDraft, date: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="text-xs font-black uppercase text-slate-500">{isAr ? 'المرجع' : 'Reference'}<input value={paymentDraft.reference} onChange={event => setPaymentDraft({ ...paymentDraft, reference: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="text-xs font-black uppercase text-slate-500">{isAr ? 'طريقة الدفع' : 'Payment method'}<select value={paymentDraft.type} onChange={event => setPaymentDraft({ ...paymentDraft, type: event.target.value as Payment['type'] })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold dark:border-slate-700 dark:bg-slate-800"><option value="CASH">Cash</option><option value="BANK">Bank</option><option value="ADVANCE">Advance</option></select></label>
            </div>
            {db.getPaymentAllocations().some(allocation => allocation.paymentId === editingPayment.id) && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{isAr ? 'تم توزيع هذه الدفعة على فواتير؛ لتغيير المبلغ احذفها ثم سجّلها بالمبلغ الصحيح.' : 'This receipt has been applied to invoices. To change its amount, delete it and record a replacement so balances stay correct.'}</p>}
            {paymentManageError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{paymentManageError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => { setEditingPayment(null); setPaymentDraft(null); setPaymentManageError(''); }} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500">{isAr ? 'إلغاء' : 'Cancel'}</button><button disabled={paymentManageSaving} onClick={savePaymentEdit} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{paymentManageSaving ? (isAr ? 'جارٍ الحفظ' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save changes')}</button></div>
          </div>
        </div>
      )}

      {showProLedger && selectedUser && <ProLedger partner={selectedUser} onClose={() => setShowProLedger(false)} branding={currentUser.invoiceSettings} />}
      {viewingInvoice && <InvoiceView invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} settings={currentUser.invoiceSettings} />}
    </div>
  );
};

export default Financials;
