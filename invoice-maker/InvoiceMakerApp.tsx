import React, { useState, useMemo, useEffect } from 'react';
import { Users, FileSpreadsheet, Info, Palette } from 'lucide-react';
import './invoice-maker.css';
import { BookingRow, CustomerSettings, CompanyInfo, Invoice, InvoiceTheme } from './types';
import { INITIAL_CSV_DATA, THEMES } from './constants';
import BookingScreen from './components/BookingScreen';
import CustomerScreen from './components/CustomerScreen';
import InfoScreen from './components/InfoScreen';
import InvoiceModal from './components/InvoiceModal';

// Work is kept in this browser so a refresh or moving to another screen does not lose it.
const STORAGE_KEY = 'nf_invoice_maker_v1';
const loadSaved = (): any => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}; } catch { return {}; }
};

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'NILE FLEET',
  subName: 'GENSET',
  address: 'PORTSAID, EGYPT',
  email: '',
  phone: '',
  authName: 'MOHAMED ALAA',
  authJobTitle: 'HEAD OF FINANCE',
  authPhone: '+20 11 464 75759',
  authEmail: 'mohamedalaa@nilefleetlogistics.com',
  logo: null,
  signature: null,
  watermark: null,
  signatureXOffset: 0,
  signatureYOffset: 0,
  signatureScale: 1,
  watermarkOpacity: 0.03,
  watermarkScale: 1.2,
  watermarkRotation: 12
};

const InvoiceMakerApp: React.FC = () => {
  const saved = useMemo(loadSaved, []);
  const [activeTab, setActiveTab] = useState<'bookings' | 'customers' | 'info'>('bookings');
  const [bookings, setBookings] = useState<BookingRow[]>(() => Array.isArray(saved.bookings) ? saved.bookings : []);
  const [customerSettings, setCustomerSettings] = useState<Record<string, CustomerSettings>>(() => saved.customerSettings || {});
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => ({ ...DEFAULT_COMPANY, ...(saved.companyInfo || {}) }));
  
  const [activePreviewInvoice, setActivePreviewInvoice] = useState<Invoice | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<InvoiceTheme>(() => saved.selectedTheme || 'minimalist-bold');
  const [invoiceOverrides, setInvoiceOverrides] = useState<Record<string, string>>(() => saved.invoiceOverrides || {});
  const [globalSerialStart, setGlobalSerialStart] = useState<string>(() => saved.globalSerialStart || '1000');
  const [globalSerialPrefix, setGlobalSerialPrefix] = useState<string>(() => saved.globalSerialPrefix || 'INV-');
  const [isGlobalMode, setIsGlobalMode] = useState<boolean>(() => !!saved.isGlobalMode);

  const parseCSV = (csv: string): BookingRow[] => {
    const lines = csv.split('\n');
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(',');
      return {
        Customer: values[0]?.trim() || '',
        BookingNo: values[5]?.trim() || '',
        UnitNumber: values[7]?.trim() || '',
        PortGo: values[2]?.trim() || '',
        PortGi: values[3]?.trim() || '',
        Trucker: values[4]?.trim() || '',
        Shipper: values[6]?.trim() || '',
        Rate: parseFloat(values[8]?.replace(/[^0-9.]/g, '')) || 0,
        Date: values[1]?.trim() || new Date().toISOString().split('T')[0]
      };
    });
  };

  const [saveWarning, setSaveWarning] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bookings, customerSettings, companyInfo, selectedTheme, invoiceOverrides,
        globalSerialStart, globalSerialPrefix, isGlobalMode,
      }));
      setSaveWarning(false);
    } catch {
      // Usually the browser storage is full because of very large logo/signature images.
      setSaveWarning(true);
    }
  }, [bookings, customerSettings, companyInfo, selectedTheme, invoiceOverrides, globalSerialStart, globalSerialPrefix, isGlobalMode]);

  const updateCustomerSettings = (rows: BookingRow[]) => {
    const uniqueCustomers = Array.from(new Set(rows.map(p => p.Customer)));
    setCustomerSettings(prev => {
      const next = { ...prev };
      uniqueCustomers.forEach((c) => {
        if (!next[c]) {
          next[c] = {
            name: c,
            dueDateDays: 30,
            serialPrefix: 'INV-2026-',
            startingSerial: 100 + Object.keys(next).length
          };
        }
      });
      return next;
    });
  };

  // Group Bookings into Invoices
  const invoices = useMemo(() => {
    const sortedBookings = [...bookings].sort((a, b) => {
      const dateA = new Date(a.Date).getTime();
      const dateB = new Date(b.Date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.UnitNumber.localeCompare(b.UnitNumber);
    });

    const groups: Record<string, BookingRow[]> = {};
    sortedBookings.forEach(row => {
      if (!groups[row.BookingNo]) groups[row.BookingNo] = [];
      groups[row.BookingNo].push(row);
    });

    const sortedGroups = Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[1][0].Date).getTime();
      const dateB = new Date(b[1][0].Date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a[0].localeCompare(b[0]);
    });

    const result = sortedGroups.map(([bookingNo, items], index) => {
      // Sort items within the invoice by date, then by unit number
      const sortedItems = [...items].sort((a, b) => {
        const dateA = new Date(a.Date).getTime();
        const dateB = new Date(b.Date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.UnitNumber.localeCompare(b.UnitNumber);
      });

      const customerName = sortedItems[0].Customer;
      const settings = customerSettings[customerName];
      const override = invoiceOverrides[bookingNo];
      
      const baseSerial = isGlobalMode 
        ? `${globalSerialPrefix}${parseInt(globalSerialStart) + index}`
        : (settings 
          ? `${settings.serialPrefix}${settings.startingSerial + index}`
          : `INV-${bookingNo}`);

      const serialNum = override || baseSerial;
      
      const date = new Date(sortedItems[0].Date);
      const dueDate = new Date(date);
      dueDate.setDate(date.getDate() + (settings?.dueDateDays || 30));

      return {
        id: bookingNo,
        bookingNo,
        customer: customerName,
        date: sortedItems[0].Date,
        dueDate: dueDate.toISOString().split('T')[0],
        serialNumber: serialNum,
        items: sortedItems,
        total: sortedItems.reduce((sum, item) => sum + item.Rate, 0)
      } as Invoice;
    });

    return result.reverse();
  }, [bookings, customerSettings, invoiceOverrides, isGlobalMode, globalSerialStart, globalSerialPrefix]);

  const selectedInvoice = useMemo(() => {
    if (!activePreviewInvoice) return null;
    if (activePreviewInvoice.isStatement) {
      return activePreviewInvoice;
    }
    return invoices.find(inv => inv.bookingNo === activePreviewInvoice.bookingNo) || activePreviewInvoice;
  }, [invoices, activePreviewInvoice]);

  const handleUpdateInvoiceData = (oldBookingNo: string, updatedItems: BookingRow[]) => {
    setBookings(prev => {
      const result: BookingRow[] = [];
      let replaced = false;
      prev.forEach(b => {
        if (b.BookingNo === oldBookingNo) {
          if (!replaced) {
            result.push(...updatedItems);
            replaced = true;
          }
        } else {
          result.push(b);
        }
      });
      if (!replaced && updatedItems.length > 0) {
        result.push(...updatedItems);
      }
      updateCustomerSettings(result);
      return result;
    });

    if (updatedItems.length > 0 && updatedItems[0].BookingNo !== oldBookingNo) {
      setActivePreviewInvoice(prev => prev ? { ...prev, bookingNo: updatedItems[0].BookingNo } : null);
    }
  };

  const handleUpdateCustomer = (name: string, settings: CustomerSettings) => {
    setCustomerSettings(prev => ({ ...prev, [name]: settings }));
  };

  const handleUpdateInvoiceSerial = (id: string, newSerial: string) => {
    setInvoiceOverrides(prev => ({ ...prev, [id]: newSerial }));
  };

  const handleApplyGlobalSerial = (startNum: string, prefix: string) => {
    setGlobalSerialStart(startNum);
    setGlobalSerialPrefix(prefix);
    setIsGlobalMode(true);
    // Clear overrides when switching to global mode to ensure "AUTO FILL" consistency
    setInvoiceOverrides({});
  };

  const handleAddBookings = (newBookings: BookingRow[]) => {
    const nextBookings = [...bookings, ...newBookings];
    setBookings(nextBookings);
    updateCustomerSettings(nextBookings);
  };

  const handleUpdateInfo = (info: Partial<CompanyInfo>) => {
    setCompanyInfo(prev => ({ ...prev, ...info }));
  };

  const handleImportCSV = (data: BookingRow[]) => {
    setBookings(data);
    updateCustomerSettings(data);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to remove all booking operations?')) {
      setBookings([]);
    }
  };

  const tabs = [
    { id: 'bookings' as const, label: 'Bookings', icon: FileSpreadsheet },
    { id: 'customers' as const, label: 'Customers', icon: Users },
    { id: 'info' as const, label: 'My Info', icon: Info },
  ];

  return (
    <div className="nfi-app min-h-full rounded-2xl bg-slate-50 text-slate-900 overflow-hidden">
      <div className="no-print flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Invoice Maker</h1>
          <p className="text-xs text-slate-500">Import a bookings sheet, each booking number becomes one invoice.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex rounded-xl bg-slate-100 p-1">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
              >
                <t.icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <Palette className="h-4 w-4" />
            <span className="sr-only md:not-sr-only">Style</span>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value as InvoiceTheme)}
              className="bg-transparent font-semibold text-slate-900 outline-none"
            >
              {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
      </div>
      {saveWarning && (
        <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 md:px-6">
          Your latest changes could not be saved in this browser (storage is full). Try smaller logo, signature or watermark images.
        </div>
      )}

      <main className="p-3 md:p-6 no-print">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'bookings' && (
            <BookingScreen 
              invoices={invoices} 
              onPreview={(inv) => setActivePreviewInvoice(inv)}
              onImport={handleImportCSV}
              onClearAll={handleClearAll}
              onAddBookings={handleAddBookings}
              onLoadSample={() => {
                if (bookings.length > 0 && !confirm('Replace your current bookings with the sample data?')) return;
                const parsed = parseCSV(INITIAL_CSV_DATA);
                handleImportCSV(parsed);
              }}
              company={companyInfo}
              theme={selectedTheme}
            />
          )}
          {activeTab === 'customers' && (
            <CustomerScreen 
              settings={customerSettings} 
              onUpdate={handleUpdateCustomer} 
              globalSerialStart={globalSerialStart}
              globalSerialPrefix={globalSerialPrefix}
              isGlobalMode={isGlobalMode}
              onApplyGlobalSerial={handleApplyGlobalSerial}
              onToggleGlobalMode={() => setIsGlobalMode(!isGlobalMode)}
            />
          )}
          {activeTab === 'info' && (
            <InfoScreen 
              info={companyInfo} 
              onUpdate={handleUpdateInfo} 
            />
          )}
        </div>
      </main>

      {selectedInvoice && (
        <InvoiceModal 
          invoice={selectedInvoice} 
          theme={selectedTheme} 
          company={companyInfo}
          onUpdateSerial={(newSerial) => handleUpdateInvoiceSerial(selectedInvoice.bookingNo, newSerial)}
          onUpdateInvoiceData={handleUpdateInvoiceData}
          onClose={() => setActivePreviewInvoice(null)} 
        />
      )}
    </div>
  );
};

export default InvoiceMakerApp;