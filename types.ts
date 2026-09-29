
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CUSTOMER = 'CUSTOMER',
  VIEWER = 'VIEWER',
  GATE_OPERATOR = 'GATE_OPERATOR'
}

export enum GensetStatus {
  IN_STOCK = 'IN_STOCK',
  CLIPPED_ON = 'CLIPPED_ON',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED'
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum Location {
  DAM = 'DAM',
  ALEX = 'ALEX',
  GOUDA = 'GOUDA',
  SOKHNA = 'SOKHNA',
  SCCT = 'SCCT',
  PSD = 'PSD',
  MAL = 'MAL',
  WORKSHOP = 'WORKSHOP'
}

export interface SystemNotification {
  id: string;
  type: 'CRITICAL' | 'INFO' | 'SUCCESS' | 'WARNING';
  message: string;
  messageAr: string;
  timestamp: string;
  active: boolean;
  forceBanner: boolean;
  targetUserId?: string; 
  targetOrgName?: string; 
}

export interface SupportContact {
  id: string;
  name: string;
  nameAr: string;
  role: string;
  roleAr: string;
  avatar: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  whatsapp: string;
}

export interface FAQItem {
  id: string;
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

export interface PortInfo {
  id: string;
  location: Location;
  address: string;
  addressAr: string;
  mapsUrl?: string;
  contactName: string;
  contactPhone: string;
}

export interface InvoiceSettings {
  primaryColor: string;
  accentColor: string;
  headerAlignment: 'left' | 'center' | 'right';
  fontStyle: 'sans' | 'serif' | 'mono';
  layoutStyle: 'TRADITIONAL' | 'MINIMAL' | 'INDUSTRIAL' | 'MODERN' | 'FUTURISTIC' | 'ELEGANT' | 'COMPACT';
  showLogo: boolean;
  showStamp: boolean;
  showSignature: boolean;
  showCompanyInfo: boolean;
  showBankDetails: boolean;
  showInvoiceId: boolean;
  showIssueDate: boolean;
  showCustomerDetails: boolean;
  showBookingRef: boolean;
  showContainer: boolean;
  showGenset: boolean;
  showRouteInfo: boolean;
  showUnitRate: boolean;
  showVatColumn: boolean;
  showShipperName: boolean;
  showTruckerName: boolean;
  showSubtotalRow: boolean;
  showVatRow: boolean;
  showGrandTotal: boolean;
  footerText: string;
  currency: string;
  customItemName: string;
  documentTitle: string;
  vatPercentage: number;
  companyHeaderAddress: string;
  companyVatNumber: string;
  companyContactEmail: string;
  companyContactPhone: string;
  bankName: string;
  bankIban: string;
  bankSwift: string;
  customHeaderNote: string;
  logoUrl?: string;
  stampUrl?: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  reference: string;
  type: 'CASH' | 'BANK' | 'ADVANCE';
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId?: string;
  amount: number;
}

export interface UserPermissions {
  /** Explicitly restricts the account to viewing screens without data-changing actions. */
  isReadOnly?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  canViewFinancials?: boolean;
  canManagePrices?: boolean;
  canManageUsers?: boolean;
  canApproveBookings?: boolean;
  canKillAccess?: boolean;
  canBypassGeofence?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  companyName?: string;
  companyNameAr?: string;
  avatarUrl?: string;
  theme?: string;
  phoneNumber?: string;
  jobTitle?: string;
  department?: string;
  joinedDate?: string;
  bio?: string;
  signatureUrl?: string;
  assignedPorts?: Location[];
  taxpayerId?: string;
  addressLine?: string;
  governorate?: string;
  postalCode?: string;
  isEtaVerified?: boolean;
  pastOutstandingAmount: number;
  invoiceSettings?: InvoiceSettings;
  isServiceAccount?: boolean;
  /** Reserved system-owner identity. Derived from the creator email; never user-editable. */
  isCreator?: boolean;
  apiKeys?: string[];
  revoked?: boolean;
  lastRotationDate?: string;
  passwordHistory?: string[];
  mfaEnabled?: boolean;
  allowedScreens?: string[];
  permissions?: UserPermissions;
}

export const hasReadOnlyAccess = (user?: Pick<User, 'role' | 'permissions'> | null): boolean =>
  user?.role === UserRole.VIEWER || user?.permissions?.isReadOnly === true;

export interface CustomerPrice {
  id: string;
  customerId: string;
  customerName: string;
  portIn: Location;
  portOut: Location;
  price: number;
  includeVat?: boolean;
}

export type MaintenanceServiceType = 
  | 'OIL_CHANGE' 
  | 'FILTER_REPLACEMENT' 
  | 'ENGINE_OVERHAUL' 
  | 'ELECTRICAL_CHECK' 
  | 'ROUTINE_INSPECTION' 
  | 'EMERGENCY_REPAIR' 
  | 'GENERAL_SERVICE';

export interface GensetMaintenanceLog {
  id: string;
  gensetNumber: string;
  serviceDate: string;
  serviceType: MaintenanceServiceType;
  technician: string;
  location: Location;
  runningHours?: number;
  cost: number;
  /** Date the maintenance work finished. Used to calculate service duration. */
  completedDate?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED';
  description: string;
  partsReplaced?: string;
  nextServiceDue?: string;
  createdAt?: string;
}

export interface Genset {
  id: string;
  unitNumber: string;
  gasLiters?: number;
  location: Location;
  status: GensetStatus;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
  runningHours?: number;
  maintenanceCount?: number;
}

export interface Reservation {
  id: string;
  customerId: string;
  customerName: string;
  bookingNumber: string;
  gensetsNeeded: number;
  portIn: Location;
  portOut: Location;
  reservationDate: string;
  dateReceived?: string;
  status: ReservationStatus;
  shipper?: string;
  trucker?: string;
  beneficiaryName?: string;
  shipperAddress?: string;
}

export interface Operation {
  id: string;
  customerId?: string;
  internalSerial: string;
  reservationId?: string;
  customerName: string;
  dateReceived: string;
  operationDate: string;
  clipOnDate: string;
  clipOffDate: string;
  clipOnPort: Location;
  clipOffPort: Location;
  destination?: string;
  trucker: string;
  bookingNumber: string;
  beneficiaryName: string;
  containerNumber: string;
  gensetNumber: string;
  commodity?: string;
  clipperName?: string;
  driverName?: string;
  driverPhone?: string;
  gaz?: string;
  shipperAddress: string;
  status: 'IN PROGRESS' | 'UNDER OPERATE' | 'DONE' | 'HOLD' | 'CANCEL';
  rate: string;
  vat: string;
  notes?: string;
  manualInvoiceNumber?: string;
  reviewedByManager?: boolean;
  invoiced?: boolean;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  bookingNumber: string;
  amount: number;
  date: string;
  dueDate?: string;
  status: 'PAID' | 'UNPAID';
  containerNumbers: string[];
  portIn: string;
  portOut: string;
  operationIds: string[];
  etaStatus?: 'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID';
  etaInternalId?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface Procurement {
  id: string;
  personName: string;
  itemDescription: string;
  amount: number;
  date: string;
  status: 'PENDING' | 'COMPLETED';
}

export interface GasTransaction {
  id: string;
  date: string;
  type: 'TOPUP' | 'CONSUMPTION';
  amount: number;
  reference: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  baseSalary: number;
  startDate: string;
}

export interface PayrollTransaction {
  id: string;
  employeeId: string;
  type: 'SALARY_BASE' | 'ADVANCE' | 'BONUS';
  amount: number;
  date: string;
  month: string;
  notes?: string;
}

export interface FoodExpense {
  id: string;
  amount: number;
  fromDate: string;
  toDate: string;
  workerCount: number;
  workerNames: string;
  notes?: string;
}

export interface TransportExpense {
  id: string;
  amount: number;
  fromPort: Location;
  toPort: Location;
  date: string;
  workerNames: string;
  notes?: string;
}

export interface PortRent {
  id: string;
  port: Location;
  amount: number;
  date: string;
  period: string; // e.g. "January 2026"
  notes?: string;
}
