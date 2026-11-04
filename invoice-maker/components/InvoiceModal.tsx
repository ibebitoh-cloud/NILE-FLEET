import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Loader2, Edit3, Check, Plus, Trash2 } from 'lucide-react';
import { Invoice, InvoiceTheme, CompanyInfo, BookingRow } from '../types';
import InvoiceRenderer from './InvoiceRenderer';
import DaliSignature from '../../components/DaliSignature';
import { buildInvoicePdf, fitForPrint, PRINT_PAGE_CSS } from '../pageFit';

interface Props {
  invoice: Invoice;
  theme: InvoiceTheme;
  company: CompanyInfo;
  onUpdateSerial: (newSerial: string) => void;
  onUpdateInvoiceData: (oldBookingNo: string, updatedItems: BookingRow[]) => void;
  onClose: () => void;
}

const InvoiceModal: React.FC<Props> = ({ invoice, theme, company, onUpdateSerial, onUpdateInvoiceData, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditingSerial, setIsEditingSerial] = useState(false);
  const [tempSerial, setTempSerial] = useState(invoice.serialNumber);
  const printRef = useRef<HTMLDivElement>(null);
  const printOnlyRef = useRef<HTMLDivElement>(null);

  // Invoice Edit Mode States
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [localItems, setLocalItems] = useState<BookingRow[]>([]);
  const [localCustomer, setLocalCustomer] = useState('');
  const [localBookingNo, setLocalBookingNo] = useState('');
  const [localDate, setLocalDate] = useState('');

  // Sync states when invoice changes from parent updates
  useEffect(() => {
    setTempSerial(invoice.serialNumber);
    if (!isEditingInvoice) {
      setLocalItems(invoice.items.map(item => ({ ...item })));
      setLocalCustomer(invoice.customer);
      setLocalBookingNo(invoice.bookingNo);
      setLocalDate(invoice.date);
    }
  }, [invoice, isEditingInvoice]);

  const handleSaveSerial = () => {
    onUpdateSerial(tempSerial);
    setIsEditingSerial(false);
  };

  const startEditing = () => {
    setLocalItems(invoice.items.map(item => ({ ...item })));
    setLocalCustomer(invoice.customer);
    setLocalBookingNo(invoice.bookingNo);
    setLocalDate(invoice.date);
    setIsEditingInvoice(true);
  };

  const handleUpdateItemField = (index: number, field: keyof BookingRow, value: any) => {
    setLocalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteItem = (index: number) => {
    setLocalItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const lastItem = localItems[localItems.length - 1];
    const newItem: BookingRow = lastItem ? {
      Customer: localCustomer,
      BookingNo: localBookingNo,
      Date: localDate,
      UnitNumber: '',
      PortGo: lastItem.PortGo,
      PortGi: lastItem.PortGi,
      Trucker: lastItem.Trucker,
      Shipper: lastItem.Shipper,
      Rate: lastItem.Rate,
    } : {
      Customer: localCustomer,
      BookingNo: localBookingNo,
      Date: localDate,
      UnitNumber: '',
      PortGo: '',
      PortGi: '',
      Trucker: '',
      Shipper: '',
      Rate: 0,
    };
    setLocalItems(prev => [...prev, newItem]);
  };

  const handleSaveInvoiceChanges = () => {
    if (!localCustomer.trim()) {
      alert("Customer name is required.");
      return;
    }
    if (!localBookingNo.trim()) {
      alert("Booking number is required.");
      return;
    }
    if (localItems.length === 0) {
      alert("At least one container operation row is required.");
      return;
    }
    
    // Normalize Customer and BookingNo inside all items
    const savedItems = localItems.map(item => ({
      ...item,
      Customer: localCustomer,
      BookingNo: localBookingNo,
      Date: item.Date || localDate
    }));

    onUpdateInvoiceData(invoice.bookingNo, savedItems);
    setIsEditingInvoice(false);
  };

  // Derive active invoice to render in real-time
  const localInvoice: Invoice = {
    ...invoice,
    bookingNo: localBookingNo || invoice.bookingNo,
    customer: localCustomer || invoice.customer,
    date: localDate || invoice.date,
    items: isEditingInvoice ? localItems : invoice.items,
    total: isEditingInvoice 
      ? localItems.reduce((sum, item) => sum + (item.Rate || 0), 0)
      : invoice.items.reduce((sum, item) => sum + (item.Rate || 0), 0)
  };

  // Handle browser printing
  const handlePrint = () => {
    const originalTitle = document.title;
    const safeCustomer = localInvoice.customer.replace(/[^a-z0-9]/gi, '_');
    document.title = `${localInvoice.serialNumber}_${safeCustomer}`;
    
    // Only the invoice prints: the rest of the app is hidden while body has .nfi-printing.
    const pageStyle = document.createElement('style');
    pageStyle.textContent = PRINT_PAGE_CSS;
    document.head.appendChild(pageStyle);
    document.body.classList.add('nfi-printing');
    const restoreFit = printOnlyRef.current && printRef.current ? fitForPrint(printOnlyRef.current, printRef.current) : () => {};
    const cleanup = () => {
      restoreFit();
      document.body.classList.remove('nfi-printing');
      pageStyle.remove();
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 500);
    }, 50);
  };

  // Handle PDF generation using html2canvas and jsPDF
  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const element = printRef.current;
      if (!element) throw new Error("Print source not found");

      // Give images (logo, signature, watermark) a moment to finish loading.
      await new Promise(resolve => setTimeout(resolve, 600));
      const pdf = await buildInvoicePdf(element);

      const safeCustomer = localInvoice.customer.replace(/[^a-z0-9]/gi, '_');
      pdf.save(`${localInvoice.serialNumber}_${safeCustomer}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Automatic download failed. Please use the Print button as a fallback.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <>
      <div className="nfi-app fixed inset-0 z-[2000] flex items-center justify-center p-0 md:p-4 pointer-events-none text-slate-900">
        
        {/* SCREEN UI - Backdrop and Controls (HIDDEN ON PRINT) */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto no-print" onClick={onClose} />
        <DaliSignature variant="popup" />
        
        <div className="relative bg-white w-full max-w-7xl h-full md:h-[95vh] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto no-print transition-all duration-300">
          {/* Modal Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Previewing Document</h3>
                {isEditingSerial ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={tempSerial}
                      onChange={(e) => setTempSerial(e.target.value)}
                      className="bg-slate-50 border border-blue-200 px-2 py-1 rounded text-sm font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button 
                      onClick={handleSaveSerial}
                      className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setTempSerial(localInvoice.serialNumber);
                        setIsEditingSerial(false);
                      }}
                      className="bg-slate-200 text-slate-600 p-1 rounded hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className="text-lg font-black text-slate-800 leading-none">{localInvoice.serialNumber}</span>
                    <button 
                      onClick={() => setIsEditingSerial(true)}
                      className="p-1 text-slate-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit Serial Number"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100 border-solid">
                A4 Format • {theme}
              </span>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {!isEditingInvoice && (
                <>
                  <button 
                    onClick={startEditing}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors flex items-center gap-2 px-3 border border-slate-200 border-solid text-xs md:text-sm font-bold"
                    disabled={isDownloading}
                  >
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Edit Invoice Data</span>
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center gap-2 px-3 border border-slate-200 border-solid text-xs md:text-sm font-bold"
                    disabled={isDownloading}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 px-4 shadow-lg shadow-blue-500/10 text-xs md:text-sm font-black disabled:bg-blue-400 min-w-[140px] justify-center"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </span>
                  </button>
                </>
              )}
              {isEditingInvoice && (
                <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase bg-amber-50 border border-amber-100 border-solid px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Edit Mode Active
                </div>
              )}
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors ml-2 pointer-events-auto"
                disabled={isDownloading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Interactive Responsive Content Area */}
          <div className="flex-1 overflow-hidden bg-slate-100 flex flex-col lg:flex-row">
            {isEditingInvoice ? (
              <>
                {/* Scrollable Form Sidebar on Left */}
                <div className="w-full lg:w-[440px] bg-white border-r border-slate-200 border-solid flex flex-col h-full shrink-0">
                  {/* Sidebar Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 border-solid flex items-center justify-between shrink-0">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Modify Invoice Values</h4>
                      <p className="text-[10px] text-slate-400 font-medium font-sans">Real-time update preview on the right</p>
                    </div>
                    <button
                      onClick={handleAddItem}
                      className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-blue-100 border-solid"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Container
                    </button>
                  </div>

                  {/* Sidebar Fields Form */}
                  <div className="p-4 overflow-y-auto flex-1 space-y-5">
                    {/* Invoice-level properties */}
                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 border-solid">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50 border-solid pb-1">
                        Invoice Header Details
                      </h5>
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 font-sans">Customer Name</label>
                        <input
                          type="text"
                          value={localCustomer}
                          onChange={(e) => setLocalCustomer(e.target.value)}
                          className="w-full bg-white border border-slate-200 border-solid px-3 py-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Customer"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 font-sans">Booking / Invoice Number Reference</label>
                        <input
                          type="text"
                          value={localBookingNo}
                          onChange={(e) => setLocalBookingNo(e.target.value)}
                          className="w-full bg-white border border-slate-200 border-solid px-3 py-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Booking reference"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 font-sans">Invoice Date</label>
                        <input
                          type="date"
                          value={localDate}
                          onChange={(e) => setLocalDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 border-solid px-3 py-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Container rows / Operations */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Containers / Items ({localItems.length})
                      </h5>

                      {localItems.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 border-solid p-4 rounded-xl space-y-3.5 shadow-sm hover:border-slate-300 transition-colors relative">
                          <div className="flex justify-between items-center border-b border-slate-100 border-solid pb-2">
                            <span className="text-[11px] font-black text-slate-500 uppercase font-sans">Item #{idx + 1}</span>
                            <button
                              onClick={() => handleDeleteItem(idx)}
                              disabled={localItems.length <= 1}
                              className="text-slate-400 hover:text-red-500 disabled:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                              title="Remove Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Container Number</label>
                              <input
                                type="text"
                                value={item.UnitNumber}
                                onChange={(e) => handleUpdateItemField(idx, 'UnitNumber', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. CXRU1014529"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Clip On Port (Go)</label>
                              <input
                                type="text"
                                value={item.PortGo}
                                onChange={(e) => handleUpdateItemField(idx, 'PortGo', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. SOKHNA"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Clip Off Port (Gi)</label>
                              <input
                                type="text"
                                value={item.PortGi}
                                onChange={(e) => handleUpdateItemField(idx, 'PortGi', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. SOKHNA"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Trucker</label>
                              <input
                                type="text"
                                value={item.Trucker}
                                onChange={(e) => handleUpdateItemField(idx, 'Trucker', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. AMEN"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Shipper</label>
                              <input
                                type="text"
                                value={item.Shipper}
                                onChange={(e) => handleUpdateItemField(idx, 'Shipper', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. LOUTS"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Date</label>
                              <input
                                type="date"
                                value={item.Date}
                                onChange={(e) => handleUpdateItemField(idx, 'Date', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Rate (EGP)</label>
                              <input
                                type="number"
                                value={item.Rate || ''}
                                onChange={(e) => handleUpdateItemField(idx, 'Rate', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-50 border border-slate-200 border-solid px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. 3500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sidebar Sticky Footer Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 border-solid flex justify-end gap-2 shrink-0">
                    <button
                      onClick={() => setIsEditingInvoice(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-sans"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSaveInvoiceChanges}
                      className="px-4 py-2 text-xs font-black text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-lg shadow-green-500/10 flex items-center gap-1.5 font-sans"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Real-time Interactive Preview Pane (Right side) */}
                <div className="flex-1 overflow-y-auto py-8 px-4 flex justify-center items-start">
                  <div className="invoice-preview-scale shadow-2xl mb-12">
                    <InvoiceRenderer invoice={localInvoice} theme={theme} company={company} />
                  </div>
                </div>
              </>
            ) : (
              /* Standard Preview Screen (Full screen center) */
              <div className="flex-1 overflow-y-auto py-8 px-4 flex justify-center items-start w-full">
                <div className="invoice-preview-scale shadow-2xl mb-12">
                  <InvoiceRenderer invoice={localInvoice} theme={theme} company={company} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 
        NATIVE PRINT SOURCE - Renders the edited reactive invoice outside the portal
      */}
      {createPortal(
        <div ref={printOnlyRef} className="nfi-print-only nfi-app">
          <InvoiceRenderer invoice={localInvoice} theme={theme} company={company} />
        </div>,
        document.body
      )}

      {/* 
        PDF CAPTURE SOURCE - Off-screen high quality element for html2canvas
      */}
      <div 
        ref={printRef} 
        className="nfi-app bg-white no-print"
        style={{ 
          width: '210mm', 
          minHeight: '0', 
          position: 'absolute', 
          left: '-9999px', 
          padding: 0,
          margin: 0,
          overflow: 'visible'
        }}
      >
        <InvoiceRenderer invoice={localInvoice} theme={theme} company={company} />
      </div>
    </>,
    document.body
  );
};

export default InvoiceModal;
