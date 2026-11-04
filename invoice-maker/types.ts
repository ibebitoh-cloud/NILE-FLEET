export interface BookingRow {
  Customer: string;
  BookingNo: string;
  UnitNumber: string;
  PortGo: string;
  PortGi: string;
  Trucker: string;
  Shipper: string;
  Rate: number;
  Date: string;
  InvoiceNo?: string;
}

export interface CustomerSettings {
  name: string;
  dueDateDays: number;
  serialPrefix: string;
  startingSerial: number;
}

export interface CompanyInfo {
  name: string;
  subName: string;
  address: string;
  email: string;
  phone: string;
  authName: string;
  authJobTitle: string;
  authPhone: string;
  authEmail: string;
  logo: string | null;
  signature: string | null;
  watermark: string | null;
  // Positioning fields
  signatureXOffset: number;
  signatureYOffset: number;
  signatureScale: number;
  // Watermark settings
  watermarkOpacity: number;
  watermarkScale: number;
  watermarkRotation: number;
}

export type InvoiceTheme = 
  | 'minimalist-bold'
  | 'minimalist-dark'
  | 'minimalist-blue'
  | 'minimalist-emerald'
  | 'minimalist-modern';

export interface Invoice {
  id: string;
  bookingNo: string;
  customer: string;
  date: string;
  dueDate: string;
  serialNumber: string;
  items: BookingRow[];
  total: number;
  isStatement?: boolean;
  period?: string;
}