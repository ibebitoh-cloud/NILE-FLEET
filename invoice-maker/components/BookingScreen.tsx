
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  Eye, 
  Search, 
  Upload, 
  RefreshCcw, 
  FileText, 
  Calendar, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Trash2, 
  Filter,
  Layers,
  CheckSquare,
  Square,
  Loader2,
  FileCheck,
  Plus,
  X,
  Sliders,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, BookingRow, CompanyInfo, InvoiceTheme } from '../types';
import { INITIAL_CSV_DATA } from '../constants';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import InvoiceRenderer from './InvoiceRenderer';
import { UploadPdfModal } from './UploadPdfModal';

interface Props {
  invoices: Invoice[];
  onPreview: (invoice: Invoice) => void;
  onImport: (data: BookingRow[]) => void;
  onClearAll: () => void;
  onLoadSample: () => void;
  onAddBookings: (bookings: BookingRow[]) => void;
  // We need company info and current theme for batch rendering
  company: CompanyInfo;
  theme: InvoiceTheme;
}

const BookingScreen: React.FC<Props> = ({ invoices, onPreview, onImport, onClearAll, onLoadSample, onAddBookings, company, theme }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [usedInvoiceIds, setUsedInvoiceIds] = useState<Set<string>>(new Set());
  const [showStatementTool, setShowStatementTool] = useState(false);
  const [showBatchTool, setShowBatchTool] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  
  // CSV Import Mapping State
  const [rawCSVData, setRawCSVData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [csvMapping, setCsvMapping] = useState<Record<string, number>>({
    Customer: 0,
    Date: 1,
    PortGo: 2,
    PortGi: 3,
    Trucker: 4,
    BookingNo: 5,
    Shipper: 6,
    UnitNumber: 7,
    Rate: 8,
  });
  const [skipHeaderRows, setSkipHeaderRows] = useState<number>(1);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const autoDetectMapping = (firstRow: string[]) => {
    const defaultMap = {
      Customer: 0,
      Date: 1,
      PortGo: 2,
      PortGi: 3,
      Trucker: 4,
      BookingNo: 5,
      Shipper: 6,
      UnitNumber: 7,
      Rate: 8,
    };

    firstRow.forEach((cell, idx) => {
      const lower = cell.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('customer') || lower.includes('client') || lower === 'cust' || lower === 'company') {
        defaultMap.Customer = idx;
      } else if (lower.includes('booking') || lower.includes('bk') || lower.includes('bkg') || lower.includes('ref')) {
        defaultMap.BookingNo = idx;
      } else if (lower.includes('unit') || lower.includes('container') || lower.includes('car') || lower.includes('equip') || lower.includes('truckno') || lower.includes('containernumber')) {
        defaultMap.UnitNumber = idx;
      } else if (lower.includes('portgo') || lower.includes('out') || lower.includes('departure') || lower.includes('portout') || lower.includes('go') || lower.includes('clipon') || lower.includes('cliponport')) {
        defaultMap.PortGo = idx;
      } else if (lower.includes('portgi') || lower.includes('in') || lower.includes('arrival') || lower.includes('portin') || lower.includes('gi') || lower.includes('clipoff') || lower.includes('clipoffport')) {
        defaultMap.PortGi = idx;
      } else if (lower.includes('truck') || lower.includes('driver') || lower.includes('trucker')) {
        defaultMap.Trucker = idx;
      } else if (lower.includes('ship') || lower.includes('shipper')) {
        defaultMap.Shipper = idx;
      } else if (lower.includes('rate') || lower.includes('price') || lower.includes('amount') || lower.includes('cost') || lower.includes('val')) {
        defaultMap.Rate = idx;
      } else if (lower.includes('date') || lower.includes('time') || lower.includes('day')) {
        defaultMap.Date = idx;
      }
    });

    setCsvMapping(defaultMap);
  };

  const mappingFields = [
    { key: 'Customer', label: 'Customer' },
    { key: 'Date', label: 'Date' },
    { key: 'PortGo', label: 'Clip On Port' },
    { key: 'PortGi', label: 'Clip Off Port' },
    { key: 'Trucker', label: 'Trucker' },
    { key: 'BookingNo', label: 'Booking' },
    { key: 'Shipper', label: 'Shipper' },
    { key: 'UnitNumber', label: 'Container Number' },
    { key: 'Rate', label: 'Rate' },
  ];
  
  // New Booking Form State
  const [newBooking, setNewBooking] = useState<BookingRow>({
    Customer: '',
    BookingNo: '',
    UnitNumber: '',
    PortGo: '',
    PortGi: '',
    Trucker: '',
    Shipper: '',
    Rate: 0,
    Date: new Date().toISOString().split('T')[0]
  });

  // Batch processing state
  const [batchCustomer, setBatchCustomer] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, name: '' });
  
  const [statementForm, setStatementForm] = useState({
    customer: '',
    shipper: '',
    dateFrom: '',
    dateTo: '',
    bookingNo: '',
    unitNumber: '',
    portGo: '',
    portGi: '',
    trucker: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchRenderRef = useRef<HTMLDivElement>(null);

  const filtered = invoices
    .filter(inv => 
      inv.bookingNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.serialNumber.localeCompare(a.serialNumber);
    });

  const uniqueCustomers = useMemo(() => Array.from(new Set(invoices.map(inv => inv.customer))).sort(), [invoices]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBooking.Customer || !newBooking.BookingNo) {
      alert("Customer and Booking Number are required.");
      return;
    }

    // Split unit numbers by newline, comma, or space
    const units = newBooking.UnitNumber
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);

    // If no units provided, we still create one with empty unit number if that's what they want,
    // but usually they should provide at least one.
    const unitsToCreate = units.length > 0 ? units : [''];

    const bookingsToAdd: BookingRow[] = unitsToCreate.map(unit => ({
      ...newBooking,
      UnitNumber: unit
    }));

    onAddBookings(bookingsToAdd);
    setShowAddModal(false);
    setNewBooking({
      Customer: '',
      BookingNo: '',
      UnitNumber: '',
      PortGo: '',
      PortGi: '',
      Trucker: '',
      Shipper: '',
      Rate: 0,
      Date: new Date().toISOString().split('T')[0]
    });
  };

  const batchInvoices = useMemo(() => {
    if (!batchCustomer) return [];
    return invoices.filter(inv => inv.customer === batchCustomer);
  }, [invoices, batchCustomer]);

  const uniqueShippersForCustomer = useMemo(() => {
    if (!statementForm.customer) return [];
    const shippers = new Set<string>();
    invoices
      .filter(inv => inv.customer === statementForm.customer)
      .forEach(inv => {
        inv.items.forEach(item => {
          if (item.Shipper) shippers.add(item.Shipper);
        });
      });
    return Array.from(shippers).sort();
  }, [invoices, statementForm.customer]);

  const handlePreview = (inv: Invoice) => {
    setUsedInvoiceIds(prev => new Set(prev).add(inv.id));
    onPreview(inv);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([INITIAL_CSV_DATA], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nile-fleet-sample-operations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // The Big "Auto Download All" Logic
  const processBatchDownload = async () => {
    if (batchInvoices.length === 0) return;
    if (!confirm(`Confirm: Automatic download of ${batchInvoices.length} invoices for ${batchCustomer}?`)) return;

    setIsProcessingBatch(true);
    setBatchProgress({ current: 0, total: batchInvoices.length, name: '' });

    for (let i = 0; i < batchInvoices.length; i++) {
      const inv = batchInvoices[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1, name: inv.serialNumber }));

      try {
        // We use a small timeout to let the hidden renderer update its props
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const element = batchRenderRef.current;
        if (!element) continue;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        
        // Match InvoiceModal margin logic
        const marginX = 15;
        const marginY = 20;
        const innerWidth = pdfWidth - (marginX * 2);
        const innerHeight = pdfHeight - (marginY * 2);
        const finalImgHeight = (imgProps.height * innerWidth) / imgProps.width;
        
        let heightLeft = finalImgHeight;
        let position = marginY;

        pdf.addImage(imgData, 'JPEG', marginX, position, innerWidth, finalImgHeight, undefined, 'FAST');
        
        // Cover margins
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, marginY, 'F');
        pdf.rect(0, pdfHeight - marginY, pdfWidth, marginY, 'F');
        pdf.rect(0, 0, marginX, pdfHeight, 'F');
        pdf.rect(pdfWidth - marginX, 0, marginX, pdfHeight, 'F');
        
        heightLeft -= innerHeight;

        while (heightLeft > 0) {
          pdf.addPage();
          position = marginY - (finalImgHeight - heightLeft);
          pdf.addImage(imgData, 'JPEG', marginX, position, innerWidth, finalImgHeight, undefined, 'FAST');
          
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pdfWidth, marginY, 'F');
          pdf.rect(0, pdfHeight - marginY, pdfWidth, marginY, 'F');
          pdf.rect(0, 0, marginX, pdfHeight, 'F');
          pdf.rect(pdfWidth - marginX, 0, marginX, pdfHeight, 'F');
          
          heightLeft -= innerHeight;
        }
        
        const safeCustomer = inv.customer.replace(/[^a-z0-9]/gi, '_');
        pdf.save(`${inv.serialNumber}_${safeCustomer}.pdf`);
        
        // Mark as "used/printed"
        setUsedInvoiceIds(prev => new Set(prev).add(inv.id));

      } catch (err) {
        console.error(`Failed batch item ${inv.serialNumber}`, err);
      }
    }

    setIsProcessingBatch(false);
    alert(`Successfully processed ${batchInvoices.length} invoices.`);
  };

  const generateStatement = () => {
    if (!statementForm.customer) return;

    const allMatchingBookings: BookingRow[] = [];
    const targetCustomer = statementForm.customer.trim().toLowerCase();

    invoices
      .filter(inv => !inv.isStatement && inv.customer?.trim().toLowerCase() === targetCustomer)
      .forEach(inv => {
        inv.items.forEach(item => {
          const itemDateStr = item.Date ? item.Date.trim() : '';
          const fromStr = statementForm.dateFrom ? statementForm.dateFrom.trim() : '';
          const toStr = statementForm.dateTo ? statementForm.dateTo.trim() : '';
          
          const dateMatch = (!fromStr || itemDateStr >= fromStr) && (!toStr || itemDateStr <= toStr);
          const shipperMatch = !statementForm.shipper || item.Shipper === statementForm.shipper;
          const bookingMatch = !statementForm.bookingNo || (item.BookingNo || '').toLowerCase().includes(statementForm.bookingNo.toLowerCase());
          const unitMatch = !statementForm.unitNumber || (item.UnitNumber || '').toLowerCase().includes(statementForm.unitNumber.toLowerCase());
          const portGoMatch = !statementForm.portGo || (item.PortGo || '').toLowerCase().includes(statementForm.portGo.toLowerCase());
          const portGiMatch = !statementForm.portGi || (item.PortGi || '').toLowerCase().includes(statementForm.portGi.toLowerCase());
          const truckerMatch = !statementForm.trucker || (item.Trucker || '').toLowerCase().includes(statementForm.trucker.toLowerCase());
          
          if (dateMatch && shipperMatch && bookingMatch && unitMatch && portGoMatch && portGiMatch && truckerMatch) {
            allMatchingBookings.push({
              ...item,
              InvoiceNo: inv.serialNumber
            });
          }
        });
      });

    if (allMatchingBookings.length === 0) {
      alert("No operations found for the selected criteria.");
      return;
    }

    const datePart = `${statementForm.dateFrom || 'Start'} to ${statementForm.dateTo || 'End'}`;
    const shipperPart = statementForm.shipper ? ` | Shipper: ${statementForm.shipper}` : '';
    const otherFilters = [
      statementForm.bookingNo && `Booking: ${statementForm.bookingNo}`,
      statementForm.unitNumber && `Unit: ${statementForm.unitNumber}`,
      statementForm.portGo && `From: ${statementForm.portGo}`,
      statementForm.portGi && `To: ${statementForm.portGi}`,
      statementForm.trucker && `Trucker: ${statementForm.trucker}`
    ].filter(Boolean).join(' | ');
    
    const statementPeriod = `${datePart}${shipperPart}${otherFilters ? ` | ${otherFilters}` : ''}`;
    
    const statementInvoice: Invoice = {
      id: `statement-${statementForm.customer}-${Date.now()}`,
      bookingNo: statementForm.shipper || "STATEMENT",
      customer: statementForm.customer,
      date: new Date().toISOString().split('T')[0],
      dueDate: "On Receipt",
      serialNumber: `SOA-${Date.now().toString().slice(-6)}`,
      items: allMatchingBookings,
      total: allMatchingBookings.reduce((sum, item) => sum + (Number(item.Rate) || 0), 0),
      isStatement: true,
      period: statementPeriod
    };

    onPreview(statementInvoice);
  };

  const exportToExcel = (targetInvoices: Invoice[], filenamePrefix: string = 'NileFleet_Data') => {
    if (!targetInvoices || targetInvoices.length === 0) {
      alert("No operation data available to export.");
      return;
    }

    // Sheet 1: All Detailed Operations
    const operationRows: any[] = [];
    targetInvoices.forEach(inv => {
      inv.items.forEach(item => {
        operationRows.push({
          'Invoice Serial': inv.serialNumber,
          'Booking No': item.BookingNo || inv.bookingNo,
          'Customer': item.Customer || inv.customer,
          'Operation Date': item.Date || inv.date,
          'Container Number': item.UnitNumber || '',
          'Clip On Port (Go)': item.PortGo || '',
          'Clip Off Port (Gi)': item.PortGi || '',
          'Trucker': item.Trucker || '',
          'Shipper': item.Shipper || '',
          'Rate (EGP)': item.Rate || 0,
        });
      });
    });

    // Sheet 2: Invoices Summary
    const invoiceSummaryRows = targetInvoices.map(inv => ({
      'Invoice Serial': inv.serialNumber,
      'Customer': inv.customer,
      'Booking Reference': inv.bookingNo,
      'Invoice Date': inv.date,
      'Due Date': inv.dueDate || 'On Receipt',
      'Container Count': inv.items.length,
      'Total Amount (EGP)': inv.total,
    }));

    // Sheet 3: Customer Revenue Breakdown
    const customerMap: Record<string, { invoicesCount: number; containersCount: number; totalRevenue: number }> = {};
    targetInvoices.forEach(inv => {
      const cust = inv.customer;
      if (!customerMap[cust]) {
        customerMap[cust] = { invoicesCount: 0, containersCount: 0, totalRevenue: 0 };
      }
      customerMap[cust].invoicesCount += 1;
      customerMap[cust].containersCount += inv.items.length;
      customerMap[cust].totalRevenue += inv.total;
    });

    const customerSummaryRows = Object.entries(customerMap).map(([customer, stats]) => ({
      'Customer Name': customer,
      'Total Invoices': stats.invoicesCount,
      'Total Containers': stats.containersCount,
      'Total Revenue (EGP)': stats.totalRevenue,
    }));

    // Build Workbook
    const workbook = XLSX.utils.book_new();

    // Worksheets
    const operationsSheet = XLSX.utils.json_to_sheet(operationRows);
    operationsSheet['!cols'] = [
      { wch: 16 }, // Invoice Serial
      { wch: 20 }, // Booking No
      { wch: 24 }, // Customer
      { wch: 15 }, // Operation Date
      { wch: 20 }, // Container Number
      { wch: 18 }, // Clip On Port
      { wch: 18 }, // Clip Off Port
      { wch: 18 }, // Trucker
      { wch: 18 }, // Shipper
      { wch: 15 }, // Rate
    ];
    XLSX.utils.book_append_sheet(workbook, operationsSheet, 'Operations');

    const invoicesSheet = XLSX.utils.json_to_sheet(invoiceSummaryRows);
    invoicesSheet['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoice Summary');

    const customerSheet = XLSX.utils.json_to_sheet(customerSummaryRows);
    customerSheet['!cols'] = [
      { wch: 26 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, customerSheet, 'Customer Summary');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${filenamePrefix}_${dateStr}.xlsx`);
  };

  const handleExportStatementToExcel = () => {
    if (!statementForm.customer) return;

    const allMatchingBookings: BookingRow[] = [];
    const targetCustomer = statementForm.customer.trim().toLowerCase();

    invoices
      .filter(inv => !inv.isStatement && inv.customer?.trim().toLowerCase() === targetCustomer)
      .forEach(inv => {
        inv.items.forEach(item => {
          const itemDateStr = item.Date ? item.Date.trim() : '';
          const fromStr = statementForm.dateFrom ? statementForm.dateFrom.trim() : '';
          const toStr = statementForm.dateTo ? statementForm.dateTo.trim() : '';
          
          const dateMatch = (!fromStr || itemDateStr >= fromStr) && (!toStr || itemDateStr <= toStr);
          const shipperMatch = !statementForm.shipper || item.Shipper === statementForm.shipper;
          const bookingMatch = !statementForm.bookingNo || (item.BookingNo || '').toLowerCase().includes(statementForm.bookingNo.toLowerCase());
          const unitMatch = !statementForm.unitNumber || (item.UnitNumber || '').toLowerCase().includes(statementForm.unitNumber.toLowerCase());
          const portGoMatch = !statementForm.portGo || (item.PortGo || '').toLowerCase().includes(statementForm.portGo.toLowerCase());
          const portGiMatch = !statementForm.portGi || (item.PortGi || '').toLowerCase().includes(statementForm.portGi.toLowerCase());
          const truckerMatch = !statementForm.trucker || (item.Trucker || '').toLowerCase().includes(statementForm.trucker.toLowerCase());
          
          if (dateMatch && shipperMatch && bookingMatch && unitMatch && portGoMatch && portGiMatch && truckerMatch) {
            allMatchingBookings.push({
              ...item,
              InvoiceNo: inv.serialNumber
            });
          }
        });
      });

    if (allMatchingBookings.length === 0) {
      alert("No operations found for the selected SOA criteria to export.");
      return;
    }

    const statementRows = allMatchingBookings.map(item => ({
      'Invoice Serial': item.InvoiceNo || '',
      'Customer': item.Customer,
      'Booking No': item.BookingNo,
      'Operation Date': item.Date,
      'Container Number': item.UnitNumber,
      'Clip On Port (Go)': item.PortGo,
      'Clip Off Port (Gi)': item.PortGi,
      'Trucker': item.Trucker,
      'Shipper': item.Shipper,
      'Rate (EGP)': item.Rate,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(statementRows);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement Operations');
    const safeCustomer = statementForm.customer.replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Statement_${safeCustomer}_${dateStr}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const rawLines = lines
          .map(line => parseCSVLine(line))
          .filter(cells => cells.some(c => c.trim() !== ''));
        
        if (rawLines.length > 0) {
          const detectedHeaders = rawLines[0];
          setRawCSVData({
            headers: detectedHeaders,
            rows: rawLines
          });
          
          autoDetectMapping(detectedHeaders);
          setSkipHeaderRows(1); // Default to skip first line (header)
        } else {
          alert("The uploaded file seems to be empty.");
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!rawCSVData) return;
    const dataRows = rawCSVData.rows.slice(skipHeaderRows);
    const parsedBookings: BookingRow[] = dataRows.map(row => {
      const getVal = (idx: number) => row[idx]?.trim() || '';
      
      const customer = getVal(csvMapping.Customer);
      const bookingNo = getVal(csvMapping.BookingNo);
      const unitNumber = getVal(csvMapping.UnitNumber);
      const portGo = getVal(csvMapping.PortGo);
      const portGi = getVal(csvMapping.PortGi);
      const trucker = getVal(csvMapping.Trucker);
      const shipper = getVal(csvMapping.Shipper);
      
      // Clean rate string (remove non-digits or dots) before parsing
      const rateString = getVal(csvMapping.Rate).replace(/[^0-9.]/g, '');
      const rateValue = parseFloat(rateString) || 0;
      
      const dateVal = getVal(csvMapping.Date) || new Date().toISOString().split('T')[0];

      return {
        Customer: customer,
        BookingNo: bookingNo,
        UnitNumber: unitNumber,
        PortGo: portGo,
        PortGi: portGi,
        Trucker: trucker,
        Shipper: shipper,
        Rate: rateValue,
        Date: dateVal
      };
    }).filter(b => b.Customer || b.BookingNo);

    onImport(parsedBookings);
    setRawCSVData(null);
  };

  return (
    <div className="space-y-6">
      {/* Add Operation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">New Operation</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Customer Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. GLOBAL LOGISTICS"
                    value={newBooking.Customer}
                    onChange={(e) => setNewBooking({...newBooking, Customer: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Booking Number</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. BK-9928"
                    value={newBooking.BookingNo}
                    onChange={(e) => setNewBooking({...newBooking, BookingNo: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex justify-between">
                    <span>Container / Unit Numbers</span>
                    <span className="text-[10px] text-emerald-600 lowercase font-bold">One per line or comma separated</span>
                  </label>
                  <textarea 
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold resize-none"
                    placeholder="e.g. MSKU-123456&#10;MSKU-789012"
                    value={newBooking.UnitNumber}
                    onChange={(e) => setNewBooking({...newBooking, UnitNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Shipper</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. MAERSK"
                    value={newBooking.Shipper}
                    onChange={(e) => setNewBooking({...newBooking, Shipper: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Trucker</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. NILE EXPRESS"
                    value={newBooking.Trucker}
                    onChange={(e) => setNewBooking({...newBooking, Trucker: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Rate (EGP)</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    value={newBooking.Rate}
                    onChange={(e) => setNewBooking({...newBooking, Rate: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Port Out (Go)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. CAIRO"
                    value={newBooking.PortGo}
                    onChange={(e) => setNewBooking({...newBooking, PortGo: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Port In (Gi)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    placeholder="e.g. ALEXANDRIA"
                    value={newBooking.PortGi}
                    onChange={(e) => setNewBooking({...newBooking, PortGi: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Operation Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-bold"
                    value={newBooking.Date}
                    onChange={(e) => setNewBooking({...newBooking, Date: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Create Operation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Processing Overlay */}
      {isProcessingBatch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
               <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
               <div 
                 className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                 style={{ animationDuration: '0.8s' }}
               ></div>
               <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600">
                 {Math.round((batchProgress.current / batchProgress.total) * 100)}%
               </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Processing Batch</h3>
              <p className="text-slate-500 font-medium">Generating {batchProgress.name}...</p>
              <div className="text-xs font-bold text-slate-400">Step {batchProgress.current} of {batchProgress.total}</div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
               <div 
                 className="bg-blue-600 h-full transition-all duration-300" 
                 style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
               />
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em]">Please keep window active</p>
          </div>
        </div>
      )}

      {/* Hidden Renderer for Batch PDF capture */}
      <div 
        ref={batchRenderRef} 
        className="bg-white"
        style={{ 
          width: '210mm', 
          minHeight: '297mm', 
          position: 'absolute', 
          left: '-9999px', 
          top: 0 
        }}
      >
        {isProcessingBatch && batchInvoices[batchProgress.current - 1] && (
          <InvoiceRenderer 
            invoice={batchInvoices[batchProgress.current - 1]} 
            theme={theme} 
            company={company} 
          />
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Operations Center</h2>
            <p className="text-slate-500">Manage {invoices.length} invoices across {uniqueCustomers.length} customers</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Operation</span>
            </button>

            <button 
              onClick={() => setShowPdfModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-purple-500/20"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Upload PDF Invoice</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-blue-500/20"
            >
              <Upload className="w-4 h-4" />
              <span>Import Operations</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileChange} 
            />

            <div className="relative inline-block">
              <button 
                onClick={() => setShowExcelMenu(!showExcelMenu)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-all shadow-sm shadow-emerald-700/20"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </button>

              {showExcelMenu && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                  <button 
                    onClick={() => {
                      exportToExcel(invoices, 'NileFleet_All_Data');
                      setShowExcelMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between"
                  >
                    <span>Export All Data</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">{invoices.length} inv</span>
                  </button>
                  {searchTerm.trim() && (
                    <button 
                      onClick={() => {
                        exportToExcel(filtered, 'NileFleet_Filtered_Data');
                        setShowExcelMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between border-t border-slate-100"
                    >
                      <span>Export Filtered Search</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">{filtered.length} inv</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setShowBatchTool(!showBatchTool);
                setShowStatementTool(false);
              }}
              className={`inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all border ${showBatchTool ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Layers className="w-4 h-4" />
              <span>Batch Download</span>
              {showBatchTool ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
            
            <button 
              onClick={() => {
                setShowStatementTool(!showStatementTool);
                setShowBatchTool(false);
              }}
              className={`inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all border ${showStatementTool ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" />
              <span>SOA Statement</span>
              {showStatementTool ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>

            <button 
              onClick={onLoadSample}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors border border-slate-200"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Sample Data</span>
            </button>

            <button 
              onClick={onClearAll}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search bookings..." 
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Batch Download UI */}
      {showBatchTool && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Batch PC Download</h3>
              <p className="text-xs text-slate-500">Auto-download multiple PDFs directly to your computer</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Select Target Customer</label>
              <select 
                className="w-full bg-white border border-indigo-200 p-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                value={batchCustomer}
                onChange={(e) => setBatchCustomer(e.target.value)}
              >
                <option value="">Choose a customer to bulk download...</option>
                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center gap-3">
               <div className="text-right">
                 <div className="text-[10px] font-black text-slate-400 uppercase leading-none">Selected</div>
                 <div className="text-xl font-black text-indigo-600 leading-none">{batchInvoices.length}</div>
               </div>
               <div className="h-8 w-px bg-slate-100" />
               <button 
                 onClick={processBatchDownload}
                 disabled={!batchCustomer || batchInvoices.length === 0}
                 className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black px-6 py-2 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
               >
                 <Download className="w-4 h-4" />
                 <span>Download All as PDFs</span>
               </button>
            </div>
          </div>
        </div>
      )}

      {showStatementTool && (
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Generate Customer Statement</h3>
              <p className="text-xs text-slate-500">Combine all operations for a specific client and shipper into one document</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Customer</label>
              <select 
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.customer}
                onChange={(e) => setStatementForm({...statementForm, customer: e.target.value, shipper: ''})}
              >
                <option value="">Choose a customer...</option>
                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Shipper Filter
              </label>
              <select 
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                value={statementForm.shipper}
                disabled={!statementForm.customer}
                onChange={(e) => setStatementForm({...statementForm, shipper: e.target.value})}
              >
                <option value="">All Shippers</option>
                {uniqueShippersForCustomer.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date From</label>
              <input 
                type="date"
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.dateFrom}
                onChange={(e) => setStatementForm({...statementForm, dateFrom: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date To</label>
              <input 
                type="date"
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.dateTo}
                onChange={(e) => setStatementForm({...statementForm, dateTo: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Booking No</label>
              <input 
                type="text"
                placeholder="Search booking..."
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.bookingNo}
                onChange={(e) => setStatementForm({...statementForm, bookingNo: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unit Number</label>
              <input 
                type="text"
                placeholder="Search unit..."
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.unitNumber}
                onChange={(e) => setStatementForm({...statementForm, unitNumber: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Port Out (Go)</label>
              <input 
                type="text"
                placeholder="Search port..."
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.portGo}
                onChange={(e) => setStatementForm({...statementForm, portGo: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Port In (Gi)</label>
              <input 
                type="text"
                placeholder="Search port..."
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.portGi}
                onChange={(e) => setStatementForm({...statementForm, portGi: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trucker</label>
              <input 
                type="text"
                placeholder="Search trucker..."
                className="w-full bg-white border border-blue-200 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={statementForm.trucker}
                onChange={(e) => setStatementForm({...statementForm, trucker: e.target.value})}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setStatementForm({
                  customer: '',
                  shipper: '',
                  dateFrom: '',
                  dateTo: '',
                  bookingNo: '',
                  unitNumber: '',
                  portGo: '',
                  portGi: '',
                  trucker: ''
                })}
                className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg transition-colors text-sm"
              >
                Clear
              </button>
              <button 
                onClick={handleExportStatementToExcel}
                disabled={!statementForm.customer}
                className="px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
                title="Export Filtered Statement to Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button 
                onClick={generateStatement}
                disabled={!statementForm.customer}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <span>Preview SOA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Invoice No</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Booking Ref</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Customer</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Units</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Total Rate</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => {
                const isUsed = usedInvoiceIds.has(inv.id);
                
                return (
                  <tr key={inv.id} className={`hover:bg-slate-50 transition-colors group`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         {isUsed ? (
                           <FileCheck className="w-4 h-4 text-green-500" />
                         ) : (
                           <div className="w-4 h-4 rounded border border-slate-200" />
                         )}
                         <span className={`font-mono text-sm font-bold ${isUsed ? 'text-green-600' : 'text-blue-600'}`}>
                           {inv.serialNumber}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{inv.bookingNo}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900">{inv.customer}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                        {inv.items.length} Units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900">{inv.total.toLocaleString()} EGP</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{inv.date}</td>
                    <td className="px-6 py-4">
                      {isUsed ? (
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded uppercase tracking-widest">Printed</span>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handlePreview(inv)}
                        className={`inline-flex items-center space-x-2 font-bold text-sm transition-all hover:translate-x-1 ${isUsed ? 'text-green-600 hover:text-green-700' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isUsed ? 'Re-Open' : 'Preview'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic bg-slate-50/50">
                    <div className="flex flex-col items-center gap-2">
                       <Search className="w-8 h-8 text-slate-300" />
                       <p>No operations matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Mapping & Raw Position Configurator Modal */}
      {rawCSVData && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Configure Sheet Columns & Positions</h3>
                  <p className="text-xs text-slate-500 font-medium">Map your uploaded spreadsheet columns to the system parameters.</p>
                </div>
              </div>
              <button 
                onClick={() => setRawCSVData(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Row Position and Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    Data Starting Row
                  </label>
                  <p className="text-xs text-slate-400">Define how many rows to skip (e.g. 1 if row 1 is the header).</p>
                  <div className="flex items-center gap-3 mt-1">
                    <input 
                      type="number" 
                      min="0"
                      max={Math.max(0, rawCSVData.rows.length - 1)}
                      className="bg-white border border-slate-200 px-3 py-2 rounded-lg w-24 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      value={skipHeaderRows}
                      onChange={(e) => setSkipHeaderRows(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <span className="text-xs text-slate-600 font-semibold">
                      Data starts at Row <span className="font-bold text-slate-900">#{skipHeaderRows + 1}</span> (Skipping {skipHeaderRows} header row{skipHeaderRows !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                <div className="space-y-1 justify-center flex flex-col">
                  <div className="text-xs font-black text-slate-700 uppercase tracking-widest">Spreadsheet Info</div>
                  <div className="text-sm text-slate-700 font-bold mt-1">
                    Detected <span className="text-blue-600 font-black">{rawCSVData.rows[0]?.length || 0} columns</span> and <span className="text-blue-600 font-black">{rawCSVData.rows.length} total rows</span>
                  </div>
                  <p className="text-xs text-slate-400">Our system automatically attempted to map matching header terms below.</p>
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Define Raw Column Positions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mappingFields.map((field) => {
                    const mappedIdx = csvMapping[field.key] ?? 0;
                    const sampleValue = rawCSVData.rows[skipHeaderRows]?.[mappedIdx] || '—';
                    
                    return (
                      <div key={field.key} className="border border-slate-100 bg-white p-3.5 rounded-xl space-y-2 hover:border-slate-300 transition-colors">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-black text-slate-800 tracking-wide">{field.label}</label>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">System Field</span>
                        </div>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 text-sm p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          value={mappedIdx}
                          onChange={(e) => setCsvMapping(prev => ({ ...prev, [field.key]: parseInt(e.target.value) }))}
                        >
                          {rawCSVData.headers.map((_, colIdx) => {
                            const colLetter = String.fromCharCode(65 + (colIdx % 26));
                            const headerName = rawCSVData.rows[0]?.[colIdx];
                            return (
                              <option key={colIdx} value={colIdx}>
                                Column {colLetter} {headerName ? `: ${headerName}` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <div className="text-[11px] text-slate-500 bg-slate-50/50 p-1.5 rounded border border-slate-100/50 flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Sample Value:</span>
                          <span className="font-bold text-slate-700 truncate max-w-[120px]">{sampleValue}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Live Import Preview (First 3 Rows)</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Updates in Real-time</span>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-widest text-[10px]">
                      <tr>
                        {mappingFields.map(f => <th key={f.key} className="px-4 py-2">{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rawCSVData.rows.slice(skipHeaderRows, skipHeaderRows + 3).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 font-medium text-slate-600">
                          {mappingFields.map(f => {
                            const colIdx = csvMapping[f.key] ?? 0;
                            const cellValue = row[colIdx];
                            return (
                              <td key={f.key} className="px-4 py-2.5 truncate max-w-[150px]">
                                {f.key === 'Rate' ? (
                                  <span className="font-bold text-slate-800">
                                    {(parseFloat(cellValue?.replace(/[^0-9.]/g, '')) || 0).toLocaleString()} EGP
                                  </span>
                                ) : (
                                  cellValue || '—'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {rawCSVData.rows.length <= skipHeaderRows && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">
                            No row data matches with the current row position settings.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button 
                onClick={() => setRawCSVData(null)}
                className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmImport}
                disabled={rawCSVData.rows.length <= skipHeaderRows}
                className="px-6 py-2.5 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Confirm & Import Operations</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload PDF Invoice & AI Extraction Modal */}
      <UploadPdfModal 
        isOpen={showPdfModal} 
        onClose={() => setShowPdfModal(false)} 
        onAddBookings={onAddBookings} 
      />
    </div>
  );
};

export default BookingScreen;