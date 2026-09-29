
import { Location, GensetStatus, Genset, Reservation, ReservationStatus, UserRole, User } from './types';

export const LOCATIONS = Object.values(Location);

/**
 * 60+ High-Quality Cartoon Avatars for Nile Fleet
 */
const generateAvatars = () => {
  const avatars: string[] = [];
  for (let i = 0; i < 20; i++) {
    avatars.push(`https://api.dicebear.com/7.x/avataaars/svg?seed=nf-character-${i}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&mood[]=happy`);
  }
  for (let i = 0; i < 20; i++) {
    avatars.push(`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=nf-ops-${i}&backgroundColor=001f3f,3b82f6,1e293b&fontColor=c2a378`);
  }
  for (let i = 0; i < 20; i++) {
    avatars.push(`https://api.dicebear.com/7.x/notionists/svg?seed=nf-fun-${i}&backgroundColor=f1f5f9,f8fafc`);
  }
  return avatars;
};

export const AVATARS = generateAvatars();

/**
 * Port palette: deliberately separated hues with white foregrounds.
 * Do not reuse/soften these colors for adjacent port cells; the color itself
 * is the visual identifier for the physical location.
 */
export const PORT_STYLING: Record<Location, { bg: string, text: string, border: string }> = {
  [Location.DAM]: { bg: 'bg-[#0F766E]', text: 'text-white', border: 'border-[#115E59]' },       // Teal
  [Location.ALEX]: { bg: 'bg-[#B45309]', text: 'text-white', border: 'border-[#92400E]' },      // Amber
  [Location.GOUDA]: { bg: 'bg-[#1D4ED8]', text: 'text-white', border: 'border-[#1E40AF]' },     // Blue
  [Location.SOKHNA]: { bg: 'bg-[#C2410C]', text: 'text-white', border: 'border-[#9A3412]' },    // Orange
  [Location.SCCT]: { bg: 'bg-[#0E7490]', text: 'text-white', border: 'border-[#155E75]' },      // Cyan
  [Location.PSD]: { bg: 'bg-[#6D28D9]', text: 'text-white', border: 'border-[#5B21B6]' },        // Violet
  [Location.MAL]: { bg: 'bg-[#15803D]', text: 'text-white', border: 'border-[#166534]' },       // Green
  [Location.WORKSHOP]: { bg: 'bg-[#475569]', text: 'text-white', border: 'border-[#334155]' },  // Slate
};

const generateInitialStock = (): Genset[] => {
  const stockData: Record<Location, string[]> = {
    [Location.ALEX]: [
      '121604-101', '206037', 'HRSG594770', '5171-149', '121172-121', '146810-110', 
      '5175-125', '100516-106', 'SZLG221-260', 'SZLG221-231', 'SZLG221234', '206035', 
      'SZLG221-263', 'HRSG594766', 'HRSG147194', '206022', 'SZLG221-237', 'SZLG220924', 
      '121282-127', '121568-113', '594167-140', '5168-135', '206044', '5149-144', 
      '206013', '100540-108', '206021', '100504-114', '592312-150'
    ],
    [Location.DAM]: [
      'SZLG220-951', '122208-105', '594179-153', '5160-139', '121818-103', 'HRSG594747', 
      '594188-204', 'SZLG221-253', 'SZLG221-222', 'SZLG221268', '100527-157', 'SZLG221243', 
      '592174-118', 'SZLG221270', 'SZLG221-216', 'SZLG221226', '100545-102', '100321-109', 
      '5162-141', '121369-154', '206038', 'SZLG221-218', '100310-111', '102552-134', 
      '121518-160', '121281-129', 'HRSG594776', 'HRSG220541', 'SZLG221227', 'SZLG221224', 
      '100313-126', 'HRSG147268', 'SZLG221-221', 'SZLG221282'
    ],
    [Location.GOUDA]: [
      'HRSG594764', 'SZLG221-283', 'HRSG594769', 'FSRG1006022', '206002', '121977-202', 
      'SZLG221-273', 'HRSG594759', 'SZLG221-236', 'SZLG220-910', 'SZLG221-257', '5152-159', 
      'HRSG594774', 'SZLG221-235', 'SZLG221-252', '206030', 'HRSG594779', 'SZLG221-248', 
      'SZLG221-210', 'HRSG220525', 'HRSG220301', 'FSRG1006059', 'SZLG221-254', 'SZLG221-212', 
      'SZLG221214', 'SZLG221-238', 'HRSG594772', '206040', 'HRSG220313'
    ],
    [Location.SOKHNA]: [
      'ACLR555030', '5154-124', 'HL9999', 'FSRG1006249', '206004', 'MAEG147291', 
      'HRSG220494', 'SZLG220978', 'SZLG221-255', '5177-120', 'SZLG221-266', 'SZLG221-272', 
      'SZLG221-276', 'SZLG221-241', 'HRSG594756', '206024', '318286-130', '318242-142', 
      'MAEG146979', '206006', '206028', 'HRSG147055', 'HRSG594811', '100535-104'
    ],
    [Location.PSD]: [
      '121378-123', 'SZLG221215'
    ],
    [Location.MAL]: [
      '121422-119', 'FSRG100576', 'SZLG221-223', '120222-146', '206017', '318259-145', 
      'SZLG221-240', 'SZLG221-261', 'SZLG221-284', 'SZLG221-258', '206036', '100050-128', 
      'CRLG121-808', '5181-133', '5184-138', 'HRSG594803', 'HRSG594787', 'HRSG594791', 
      'HRSG594773', 'HRSG594781', 'HRSG594757', 'HRSG594801', 'HRSG594797', 'HRSG594775', 
      'HRSG594792', '5173-122', '122343-112', 'FSRG1005617'
    ],
    [Location.WORKSHOP]: [],
    [Location.SCCT]: [
      'SZLG221-281', 'SZLG220-983', 'HRSG220517', 'HRSG122128', '100311-156', '100512-107', 
      '100552-152'
    ]
  };

  const stock: Genset[] = [];
  Object.entries(stockData).forEach(([loc, units]) => {
    units.forEach((unit, idx) => {
      stock.push({
        id: `G-${unit}-${loc}`,
        unitNumber: unit,
        location: loc as Location,
        status: GensetStatus.IN_STOCK
      });
    });
  });
  return stock;
};

export const INITIAL_STOCK = generateInitialStock();

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'res-1',
    customerId: 'cust-elamir',
    customerName: 'ELAMIR',
    bookingNumber: 'DTX-RES-01',
    gensetsNeeded: 1,
    portIn: Location.ALEX,
    portOut: Location.SOKHNA,
    reservationDate: '2026-01-10',
    status: ReservationStatus.PENDING
  }
];

export const MOCK_USERS = [
  { 
    id: 'admin-bebito', 
    email: 'bebito@nilefleet.com', 
    password: 'mine', 
    role: UserRole.ADMIN, 
    name: 'Mostafa Ibrahim',
    avatarUrl: AVATARS[0],
    jobTitle: 'Chief Operations Officer',
    department: 'Executive Management',
    phoneNumber: '+20 114 647 5759',
    joinedDate: '2020-05-12',
    lastRotationDate: '2026-05-01',
    passwordHistory: ['mine', 'pass1', 'pass2', 'pass3', 'pass4']
  },
  { 
    id: 'admin-eslam', 
    email: 'eslam@nilefleet.com', 
    password: 'eslam', 
    role: UserRole.ADMIN, 
    name: 'Eslam',
    avatarUrl: AVATARS[1],
    jobTitle: 'Logistics Director',
    department: 'Operations',
    phoneNumber: '+20 111 222 3333'
  },
  {
    id: 'gate-alex',
    email: 'alex.gate@nilefleet.com',
    password: 'alex',
    role: UserRole.GATE_OPERATOR,
    name: 'Ahmed Alexandria',
    avatarUrl: AVATARS[21]
  },
  {
    id: 'gate-damietta',
    email: 'damietta.gate@nilefleet.com',
    password: 'dam',
    role: UserRole.GATE_OPERATOR,
    name: 'Mohamed Damietta',
    avatarUrl: AVATARS[22]
  },
  {
    id: 'gate-sokhna',
    email: 'sokhna.gate@nilefleet.com',
    password: 'sokh',
    role: UserRole.GATE_OPERATOR,
    name: 'Hassan Sokhna',
    avatarUrl: AVATARS[23]
  },
  {
    id: 'viewer-audit',
    email: 'auditor@nilefleet.com',
    password: 'audit',
    role: UserRole.VIEWER,
    name: 'Audit Intelligence',
    avatarUrl: AVATARS[15],
    jobTitle: 'Compliance Officer',
    department: 'Finance',
    lastRotationDate: '2026-05-15'
  },
  {
    id: 'cust-elamir',
    email: 'ops@elamir.com',
    password: 'pass',
    role: UserRole.CUSTOMER,
    name: 'ELAMIR LOGISTICS',
    companyName: 'ELAMIR',
    avatarUrl: AVATARS[41]
  },
  {
    id: 'cust-maersk',
    email: 'egypt.ops@maersk.com',
    password: 'maer',
    role: UserRole.CUSTOMER,
    name: 'MAERSK EGYPT',
    companyName: 'MAERSK',
    avatarUrl: AVATARS[42]
  },
  {
    id: 'cust-msc',
    email: 'ops@msc-egypt.com',
    password: 'msc',
    role: UserRole.CUSTOMER,
    name: 'MSC EGYPT',
    companyName: 'MSC',
    avatarUrl: AVATARS[43]
  },
  {
    id: 'cust-fissal',
    email: 'ops@fissal.com',
    password: 'fiss',
    role: UserRole.CUSTOMER,
    name: 'FISSAL TRANSPORT',
    companyName: 'FISSAL',
    avatarUrl: AVATARS[44]
  }
];
