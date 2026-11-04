import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw,
  Building2,
  Calendar,
  Hash,
  ArrowRight
} from 'lucide-react';
import { BookingRow } from '../types';
import { parseInvoiceDocument } from '../../services/aiService';

// pdf.js is loaded only when a PDF is dropped, with the worker bundled by Vite.
const loadPdfJs = async () => {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
};


interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddBookings: (bookings: BookingRow[]) => void;
}

export const UploadPdfModal: React.FC<Props> = ({ isOpen, onClose, onAddBookings }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedSuccess, setParsedSuccess] = useState(false);

  // Editable Form Data
  const [customer, setCustomer] = useState('');
  const [bookingNo, setBookingNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<BookingRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setParsedSuccess(false);
    setIsParsing(true);

    try {
      let extractedText = '';
      let processedBase64 = '';
      let mimeType = file.type || 'application/pdf';

      // 1. If PDF file, perform fast client-side extraction or page canvas snapshot
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await loadPdfJs();
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const pdfDoc = await loadingTask.promise;

          let pdfText = '';
          for (let pageNum = 1; pageNum <= Math.min(pdfDoc.numPages, 5); pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageStr = textContent.items.map((item: any) => item.str).join(' ');
            pdfText += `Page ${pageNum}: ${pageStr}\n`;
          }

          if (pdfText.trim().length > 30) {
            extractedText = pdfText;
          } else {
            // Scanned image PDF: render page 1 to compressed JPEG canvas
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;
            processedBase64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
            mimeType = 'image/jpeg';
          }
        } catch (pdfErr) {
          console.warn('Client-side PDFJS extraction warning:', pdfErr);
        }
      }

      // Fallback to reading file base64 if no text and no canvas snapshot produced
      if (!extractedText && !processedBase64) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1] || result;
            resolve(base64Data);
          };
          reader.onerror = (err) => reject(err);
        });
        reader.readAsDataURL(file);
        processedBase64 = await base64Promise;
      }

      // Build lightweight payload for server
      const requestPayload = extractedText 
        ? { extractedText, fileName: file.name }
        : { fileBase64: processedBase64, fileName: file.name, mimeType };

      // Read the document with DALI (Cloudflare Workers AI, signed-in staff only)
      const result = await parseInvoiceDocument(requestPayload);
      if (result.success && result.data) {
        const data = result.data;
        const extractedCustomer = data.customer || '';
        const extractedBookingNo = data.bookingNo || '';
        const extractedDate = data.date || new Date().toISOString().split('T')[0];

        setCustomer(extractedCustomer);
        setBookingNo(extractedBookingNo);
        setInvoiceDate(extractedDate);

        if (Array.isArray(data.items) && data.items.length > 0) {
          const formattedItems: BookingRow[] = data.items.map((it: any) => ({
            Customer: extractedCustomer,
            BookingNo: extractedBookingNo,
            UnitNumber: it.UnitNumber || '',
            PortGo: it.PortGo || '',
            PortGi: it.PortGi || '',
            Trucker: it.Trucker || '',
            Shipper: it.Shipper || '',
            Date: it.Date || extractedDate,
            Rate: typeof it.Rate === 'number' ? it.Rate : parseFloat(it.Rate) || 0,
          }));
          setItems(formattedItems);
        } else {
          setItems([{
            Customer: extractedCustomer,
            BookingNo: extractedBookingNo,
            UnitNumber: '',
            PortGo: '',
            PortGi: '',
            Trucker: '',
            Shipper: '',
            Date: extractedDate,
            Rate: 0,
          }]);
        }

        setParsedSuccess(true);
      } else {
        throw new Error('Could not parse structured data from the document');
      }
    } catch (err: any) {
      console.error('Invoice PDF Parsing Error:', err);
      setParseError(err.message || 'Could not extract invoice data automatically. You can manually enter or edit the fields below.');
      
      // Ensure the manual form fields are ready for user input
      if (items.length === 0) {
        setItems([{
          Customer: customer || '',
          BookingNo: bookingNo || '',
          UnitNumber: '',
          PortGo: '',
          PortGi: '',
          Trucker: '',
          Shipper: '',
          Date: new Date().toISOString().split('T')[0],
          Rate: 0,
        }]);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleAddItem = () => {
    const lastItem = items[items.length - 1];
    setItems(prev => [
      ...prev,
      {
        Customer: customer,
        BookingNo: bookingNo,
        UnitNumber: '',
        PortGo: lastItem ? lastItem.PortGo : '',
        PortGi: lastItem ? lastItem.PortGi : '',
        Trucker: lastItem ? lastItem.Trucker : '',
        Shipper: lastItem ? lastItem.Shipper : '',
        Date: invoiceDate,
        Rate: lastItem ? lastItem.Rate : 0,
      }
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof BookingRow, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndImport = () => {
    if (!customer.trim()) {
      alert('Please enter a Customer name.');
      return;
    }
    if (!bookingNo.trim()) {
      alert('Please enter a Booking or Invoice number reference.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one container / line item.');
      return;
    }

    // Standardize customer and booking number across all items
    const finalItems: BookingRow[] = items.map(item => ({
      ...item,
      Customer: customer.trim(),
      BookingNo: bookingNo.trim(),
      Date: item.Date || invoiceDate,
    }));

    onAddBookings(finalItems);
    onClose();
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.Rate) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Upload PDF Invoice & AI Extractor</h3>
              <p className="text-xs text-slate-300 font-medium">
                Upload a PDF invoice or scanned image to automatically extract and edit details.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
          
          {/* File Upload Zone */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              selectedFile 
                ? 'border-blue-400 bg-blue-50/50' 
                : 'border-slate-300 hover:border-blue-500 hover:bg-white bg-white/60'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,image/png,image/jpeg,image/jpg" 
              className="hidden" 
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            {!selectedFile && !isParsing && (
              <div className="flex flex-col items-center justify-center py-2 space-y-3">
                <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to upload or drag & drop PDF Invoice
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF documents, PNG, JPG scans
                  </p>
                </div>
              </div>
            )}

            {isParsing && (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-black text-blue-900">
                    AI OCR extracting invoice details...
                  </p>
                  <p className="text-xs text-blue-600/80 mt-0.5">
                    Extracting Customer, Booking reference, Containers, Ports & Rates
                  </p>
                </div>
              </div>
            )}

            {selectedFile && !isParsing && (
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {parsedSuccess && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Extracted
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-upload
                  </button>
                </div>
              </div>
            )}
          </div>

          {parseError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice: </span>
                {parseError}
              </div>
            </div>
          )}

          {/* Interactive Invoice Editor Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Review & Edit Extracted Invoice Data
                </h4>
              </div>
              <div className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full font-mono">
                Total: {totalAmount.toLocaleString()} EGP
              </div>
            </div>

            {/* Header Data Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g. Louts Export"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Booking / Invoice Reference
                </label>
                <input
                  type="text"
                  value={bookingNo}
                  onChange={(e) => setBookingNo(e.target.value)}
                  placeholder="e.g. EGY108422"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Container Operation Rows */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Container Operations ({items.length})
                </h5>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-blue-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Container Row
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="bg-slate-50/80 border border-slate-200 p-3.5 rounded-xl space-y-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase">Container #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1 rounded transition-colors"
                        title="Remove container"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Container ID</label>
                        <input
                          type="text"
                          value={item.UnitNumber}
                          onChange={(e) => handleUpdateItem(idx, 'UnitNumber', e.target.value)}
                          placeholder="Unit Number"
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Port (Go)</label>
                        <input
                          type="text"
                          value={item.PortGo}
                          onChange={(e) => handleUpdateItem(idx, 'PortGo', e.target.value)}
                          placeholder="Origin Port"
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Port (Gi)</label>
                        <input
                          type="text"
                          value={item.PortGi}
                          onChange={(e) => handleUpdateItem(idx, 'PortGi', e.target.value)}
                          placeholder="Dest Port"
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Trucker</label>
                        <input
                          type="text"
                          value={item.Trucker}
                          onChange={(e) => handleUpdateItem(idx, 'Trucker', e.target.value)}
                          placeholder="Transporter"
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Rate (EGP)</label>
                        <input
                          type="number"
                          value={item.Rate || ''}
                          onChange={(e) => handleUpdateItem(idx, 'Rate', parseFloat(e.target.value) || 0)}
                          placeholder="Rate"
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAndImport}
            disabled={isParsing || items.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/10 flex items-center gap-2 transition-all"
          >
            <span>Save & Add to System</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
