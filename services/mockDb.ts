
import { 
  Genset, Reservation, Operation, Invoice, User, Location, 
  UserRole, GensetStatus, ReservationStatus, AuditEntry, 
  CustomerPrice, Procurement, GasTransaction, Employee, 
  PayrollTransaction, Payment, FoodExpense, TransportExpense, 
  PortRent, SystemNotification, SupportContact, FAQItem, PortInfo,
  GensetMaintenanceLog, MaintenanceServiceType
} from '../types';
import { INITIAL_STOCK, MOCK_RESERVATIONS, MOCK_USERS, AVATARS } from '../constants';

export type { User };

class MockDB {
  private stock: Genset[] = INITIAL_STOCK;
  private reservations: Reservation[] = MOCK_RESERVATIONS;
  private users: User[] = [...MOCK_USERS].map(u => ({
    ...u,
    pastOutstandingAmount: u.role === UserRole.CUSTOMER ? Math.floor(Math.random() * 80000) : 0
  }) as User);
  private operations: Operation[] = [];
  private invoices: Invoice[] = [];
  private payments: Payment[] = [];
  private customerPrices: CustomerPrice[] = [];
  private internalSerialCounter: number = 1000;
  private maintenanceLogs: GensetMaintenanceLog[] = [];
  
  private procurements: Procurement[] = [];
  private gasTransactions: GasTransaction[] = [];
  private employees: Employee[] = [];
  private payrollTransactions: PayrollTransaction[] = [];
  
  private foodExpenses: FoodExpense[] = [];
  private transportExpenses: TransportExpense[] = [];
  private portRents: PortRent[] = [];

  private supportContacts: SupportContact[] = [
    { id: 'c1', name: 'Bebito Command', nameAr: 'القيادة ببيتو', role: 'COO', roleAr: 'مدير العمليات', avatar: '👨‍💼', status: 'ONLINE', whatsapp: '201146475759' },
    { id: 'c2', name: 'Eslam Logistics', nameAr: 'إسلام لوجستيات', role: 'Field Director', roleAr: 'المدير الميداني', avatar: '🚛', status: 'BUSY', whatsapp: '201112223333' }
  ];

  private faqs: FAQItem[] = [
    { id: 'f1', question: "How do I report a genset failure?", questionAr: "كيف أبلغ عن عطل في المولد؟", answer: "Contact 'Eslam Logistics' via Voice Link immediately. Provide your Unit SN and Container ID.", answerAr: "تواصل مع 'إسلام لوجستيات' عبر رابط الصوت فوراً. زودنا برقم المولد ورقم الحاوية." },
    { id: 'f2', question: "Billing discrepancy in Statement?", questionAr: "يوجد اختلاف في فاتورة الحساب؟", answer: "All commercial rates are based on your signed Rate Matrix. Contact Bebito for audits.", answerAr: "جميع الأسعار التجارية تعتمد على مصفوفة الأسعار الموقعة. تواصل مع ببيتو للتدقيق." }
  ];

  private portsInfo: PortInfo[] = [
    { id: 'p1', location: Location.ALEX, address: 'Alexandria Main Terminal, Gate 27', addressAr: 'محطة الإسكندرية الرئيسية، بوابة 27', contactName: 'M. Fawzy', contactPhone: '+20 123 456 789' },
    { id: 'p2', location: Location.DAM, address: 'Damietta Port Logistics Hub, Office 4', addressAr: 'ميناء دمياط، المركز اللوجستي، مكتب 4', contactName: 'Ahmed Ali', contactPhone: '+20 123 789 456' }
  ];

  private notifications: SystemNotification[] = [
    {
      id: 'notif-1',
      type: 'WARNING',
      message: 'System Initialized successfully.',
      messageAr: 'تم بدء تشغيل النظام بنجاح.',
      timestamp: new Date().toISOString(),
      active: true,
      forceBanner: true
    }
  ];

  private historyStack: string[] = [];
  private auditLogs: AuditEntry[] = [];

  constructor() {
    this.initDefaultPrices();
    this.seedLargeDataset();
    this.syncCustomersFromOperations();
    this.seedExpenses();
    this.seedMaintenanceLogs();
    this.saveSnapshot("System Initialization");
  }

  private generateInternalSerial(): string {
    this.internalSerialCounter++;
    return `NF-${this.internalSerialCounter}`;
  }

  private seedLargeDataset() {
    const demoCustomers = ['ELAMIR', 'MAERSK', 'MSC', 'FISSAL'];
    const demoCommodities = ['ORANGES', 'CITRUS', 'GRAPES', 'POTATOES', 'STRAWBERRIES', 'POMEGRANATE', 'FROZEN FISH', 'ONIONS'];
    const demoClippers = ['Mohamed Fawzy', 'Ahmed Ali', 'Mahmoud Hassan', 'Eslam Logistics', 'Ibrahim Said', 'Sherif Hegazy'];
    const ports = Object.values(Location).filter(l => l !== Location.MAL);
    
    // Existing dynamic seed
    for (let i = 0; i < 15; i++) {
      const custName = demoCustomers[i % demoCustomers.length];
      const portIn = ports[i % ports.length];
      const portOut = ports[(i + 1) % ports.length];
      const unit = this.stock[i % this.stock.length];
      const commodity = demoCommodities[i % demoCommodities.length];
      const clipperName = demoClippers[i % demoClippers.length];
      
      const op: Operation = {
        id: `op-seed-${i}`,
        internalSerial: this.generateInternalSerial(),
        customerName: custName,
        dateReceived: '2026-01-01',
        operationDate: '2026-01-05',
        clipOnDate: '2026-01-05',
        clipOffDate: '',
        clipOnPort: portIn,
        clipOffPort: portOut,
        trucker: custName,
        bookingNumber: `BK-100${i}`,
        beneficiaryName: 'GENERAL CARGO',
        containerNumber: `MSKU${2000000 + i}`,
        gensetNumber: unit.unitNumber,
        commodity: commodity,
        clipperName: clipperName,
        status: i % 3 === 0 ? 'DONE' : 'IN PROGRESS',
        rate: '2200.00',
        vat: '308.00',
        shipperAddress: 'Industrial Zone',
        reviewedByManager: i % 2 === 0,
        invoiced: i % 3 === 0
      };
      
      this.operations.push(op);
      
      if (op.invoiced) {
        const dueDate = i % 2 === 0 ? '2026-05-01' : '2026-07-15'; // Some past due, some future
        const inv: Invoice = {
          id: `INV-SEED-${1000 + i}`,
          customerId: `cust-${custName.toLowerCase()}`,
          customerName: custName,
          bookingNumber: op.bookingNumber,
          amount: parseFloat(op.rate) + parseFloat(op.vat),
          date: '2026-04-15',
          dueDate: dueDate,
          status: i % 6 === 0 ? 'PAID' : 'UNPAID',
          containerNumbers: [op.containerNumber],
          portIn: op.clipOnPort,
          portOut: op.clipOffPort,
          operationIds: [op.id],
          etaStatus: 'VALID',
          etaInternalId: `ETA-SEED-${1000 + i}`
        };
        this.invoices.push(inv);
      }
      
      if (op.status === 'IN PROGRESS') {
        unit.status = GensetStatus.CLIPPED_ON;
      } else if (op.status === 'DONE') {
        unit.status = GensetStatus.IN_STOCK;
        unit.location = op.clipOffPort as Location;
      }
    }

    for (let i = 0; i < 30; i++) {
      const custName = demoCustomers[i % demoCustomers.length];
      const hub = ports[i % ports.length];
      const op: Operation = {
        id: `op-upcoming-${i}`,
        internalSerial: this.generateInternalSerial(),
        customerName: custName,
        dateReceived: '2026-01-10',
        operationDate: '2026-01-25',
        clipOnDate: '2026-01-25',
        clipOffDate: '',
        clipOnPort: hub,
        clipOffPort: hub,
        trucker: 'TBA',
        bookingNumber: `BK-UP-${1000 + i}`,
        beneficiaryName: 'PENDING CARGO',
        containerNumber: '',
        gensetNumber: '',
        status: 'UNDER OPERATE',
        rate: '0.00',
        vat: '0.00',
        shipperAddress: 'Logistics Hub',
        reviewedByManager: false,
        invoiced: false
      };
      this.operations.push(op);
    }
  }

  private seedExpenses() {
    this.employees = [
      { id: 'emp-1', name: 'Ahmed Fawzy', position: 'Supervisor', baseSalary: 15000, startDate: '2024-01-01' },
      { id: 'emp-2', name: 'Mohamed Ali', position: 'Operator', baseSalary: 8000, startDate: '2024-02-01' },
      { id: 'emp-3', name: 'Hassan Mahmoud', position: 'Driver', baseSalary: 7500, startDate: '2024-03-01' }
    ];

    this.gasTransactions = [
      { id: 'gas-1', date: '2026-01-01', type: 'TOPUP', amount: 45000, reference: 'Oktan Jan Supply' },
      { id: 'gas-2', date: '2026-01-10', type: 'TOPUP', amount: 30000, reference: 'Emergency Refill' }
    ];

    this.foodExpenses = [
      { id: 'food-1', amount: 1200, fromDate: '2026-01-01', toDate: '2026-01-07', workerCount: 5, workerNames: 'Ahmed, Mohamed, Hassan, Ali, Sayed', notes: 'Weekly allocation' }
    ];
  }

  private seedMaintenanceLogs() {
    const records: GensetMaintenanceLog[] = [
      {
        id: 'maint-101',
        gensetNumber: 'SZLG221-240',
        serviceDate: '2026-02-15',
        serviceType: 'OIL_CHANGE',
        technician: 'Mohamed Fawzy',
        location: Location.ALEX,
        runningHours: 1250,
        cost: 1850,
        status: 'COMPLETED',
        description: 'Scheduled 250-hr lube change. Drained engine oil, replaced LF16015 lube filter, inspected fan belt tension.',
        partsReplaced: '15W-40 Synthetic Oil (18L), LF16015 Filter',
        nextServiceDue: '2026-05-15',
        createdAt: '2026-02-15T09:30:00Z'
      },
      {
        id: 'maint-102',
        gensetNumber: 'SZLG221-284',
        serviceDate: '2026-02-28',
        serviceType: 'FILTER_REPLACEMENT',
        technician: 'Ahmed Ali',
        location: Location.DAM,
        runningHours: 2100,
        cost: 1400,
        status: 'COMPLETED',
        description: 'Replaced primary fuel water separator and secondary spin-on filter due to low fuel rail pressure alarm.',
        partsReplaced: 'FS19732 Fuel/Water Separator, FF5612 Fuel Filter',
        nextServiceDue: '2026-05-28',
        createdAt: '2026-02-28T14:15:00Z'
      },
      {
        id: 'maint-103',
        gensetNumber: 'CRLG121-808',
        serviceDate: '2026-03-05',
        serviceType: 'ELECTRICAL_CHECK',
        technician: 'Sherif Hegazy',
        location: Location.ALEX,
        runningHours: 3400,
        cost: 2600,
        status: 'COMPLETED',
        description: 'Replaced 460V 32A reefer socket receptacle, calibrated internal circuit breaker, verified AVR output voltage stability at 460V ± 1.5%.',
        partsReplaced: 'Reefer Power Socket 32A 4P, AVR Sensing Wire Harness',
        nextServiceDue: '2026-06-05',
        createdAt: '2026-03-05T11:00:00Z'
      },
      {
        id: 'maint-104',
        gensetNumber: '5181-133',
        serviceDate: '2026-03-10',
        serviceType: 'ROUTINE_INSPECTION',
        technician: 'Eslam Logistics',
        location: Location.ALEX,
        runningHours: 850,
        cost: 650,
        status: 'COMPLETED',
        description: 'Pre-trip seasonal inspection. Checked radiator coolant level, battery load capacity (12.6V, 800 CCA), cleaned air intake pre-cleaner.',
        partsReplaced: 'Battery Terminal Clamps, Pre-cleaner Foam Element',
        nextServiceDue: '2026-06-10',
        createdAt: '2026-03-10T08:45:00Z'
      },
      {
        id: 'maint-105',
        gensetNumber: '100050-128',
        serviceDate: '2026-03-11',
        serviceType: 'EMERGENCY_REPAIR',
        technician: 'Mohamed Fawzy',
        location: Location.ALEX,
        runningHours: 2950,
        cost: 3200,
        status: 'IN_PROGRESS',
        description: 'High water temperature shut-down alert. Diagnosed coolant leak at upper radiator hose elbow. Disassembled for hose replacement and pressure testing.',
        partsReplaced: 'Upper Radiator Hose, Constant Torque Clamps, 50/50 Premix Coolant',
        nextServiceDue: '2026-04-11',
        createdAt: '2026-03-11T13:20:00Z'
      },
      {
        id: 'maint-106',
        gensetNumber: 'SZLG221-258',
        serviceDate: '2026-03-20',
        serviceType: 'ENGINE_OVERHAUL',
        technician: 'Sherif Hegazy',
        location: Location.ALEX,
        runningHours: 5200,
        cost: 14500,
        status: 'SCHEDULED',
        description: 'Scheduled top-end decoke, valve clearance adjustment, injector spray pattern calibration, and turbocharger play check.',
        partsReplaced: 'Injector Nozzles (x4), Valve Cover Gasket, Turbo Gasket Kit',
        nextServiceDue: '2026-03-25',
        createdAt: '2026-03-11T16:00:00Z'
      }
    ];

    this.maintenanceLogs = records;

    // Apply metadata to matching gensets
    records.forEach(log => {
      const unit = this.stock.find(s => s.unitNumber.toUpperCase() === log.gensetNumber.toUpperCase());
      if (unit) {
        if (!unit.lastMaintenanceDate || new Date(log.serviceDate) > new Date(unit.lastMaintenanceDate)) {
          unit.lastMaintenanceDate = log.serviceDate;
        }
        if (log.nextServiceDue) unit.nextMaintenanceDue = log.nextServiceDue;
        if (log.runningHours) unit.runningHours = log.runningHours;
        unit.maintenanceCount = (unit.maintenanceCount || 0) + 1;
        if (log.status === 'IN_PROGRESS') {
          unit.status = GensetStatus.MAINTENANCE;
        }
      }
    });
  }

  getNotifications(user: User) { 
    return this.notifications.filter(n => {
      if (!n.targetUserId && !n.targetOrgName) return true;
      if (n.targetUserId === user.id) return true;
      const userOrg = user.companyName || user.name;
      if (n.targetOrgName === userOrg) return true;
      return false;
    });
  }

  getActiveNotifications(user: User) { 
    return this.getNotifications(user).filter(n => n.active);
  }
  
  addNotification(n: Omit<SystemNotification, 'id' | 'timestamp' | 'active'>) {
    this.notifications.unshift({
      ...n,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      active: true
    });
    this.notifyChange();
  }

  dismissNotification(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, active: false } : n);
    this.notifyChange();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.notifyChange();
  }

  totalSystemWipe() {
    this.operations = [];
    this.invoices = [];
    this.payments = [];
    this.procurements = [];
    this.gasTransactions = [];
    this.payrollTransactions = [];
    this.foodExpenses = [];
    this.transportExpenses = [];
    this.portRents = [];
    this.reservations = [];
    this.customerPrices = [];
    this.auditLogs = [];
    this.historyStack = [];
    this.notifications = [];
    this.internalSerialCounter = 1000;
    this.stock = this.stock.map(s => ({ ...s, status: GensetStatus.IN_STOCK }));
    this.users = this.users.filter(u => u.role !== UserRole.CUSTOMER);
    this.maintenanceLogs = [];
    this.saveSnapshot("CRITICAL: TOTAL SYSTEM WIPE EXECUTED. DATA PURGED.");
    this.notifyChange();
  }

  private initDefaultPrices() {
    const demoCustomers = ['ELAMIR', 'ELHANDSIA', 'DALTIX', 'FISSAL', 'MAERSK', 'MSC'];
    const ports = Object.values(Location).filter(l => l !== Location.MAL);
    demoCustomers.forEach(cust => {
      ports.forEach(pIn => {
        ports.forEach(pOut => {
          this.customerPrices.push({
            id: `price-${cust}-${pIn}-${pOut}`,
            customerId: `cust-${cust.toLowerCase()}`,
            customerName: cust,
            portIn: pIn,
            portOut: pOut,
            price: 2200 + (Math.random() * 800),
            includeVat: false 
          });
        });
      });
    });
  }

  syncCustomersFromOperations() {
    const uniqueCustomerNames = Array.from(new Set(this.operations.map(o => o.customerName)));
    const existingCustomerNames = new Set(
      this.users.filter(u => u.role === UserRole.CUSTOMER).map(u => (u.companyName || u.name).toUpperCase())
    );

    let addedCount = 0;
    uniqueCustomerNames.forEach(name => {
      const upperName = name.toUpperCase();
      if (!existingCustomerNames.has(upperName)) {
        const id = `cust-${upperName.toLowerCase().replace(/\s/g, '-')}`;
        const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        this.users.push({
          id,
          name: upperName,
          companyName: upperName,
          email: `${upperName.toLowerCase()}@portal.nilefleet.com`,
          password: Math.random().toString(36).slice(-8),
          role: UserRole.CUSTOMER,
          avatarUrl: randomAvatar,
          pastOutstandingAmount: 0
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.saveSnapshot(`SYSTEM: Sync ${addedCount} customers from ops data`);
      this.notifyChange();
    }
  }

  private saveSnapshot(description: string) {
    const state = JSON.stringify({
      stock: this.stock, users: this.users,
      operations: this.operations, invoices: this.invoices,
      payments: this.payments,
      customerPrices: this.customerPrices,
      internalSerialCounter: this.internalSerialCounter,
      procurements: this.procurements,
      gasTransactions: this.gasTransactions,
      employees: this.employees,
      payrollTransactions: this.payrollTransactions,
      foodExpenses: this.foodExpenses,
      transportExpenses: this.transportExpenses,
      portRents: this.portRents,
      notifications: this.notifications,
      supportContacts: this.supportContacts,
      faqs: this.faqs,
      portsInfo: this.portsInfo,
      maintenanceLogs: this.maintenanceLogs
    });
    this.historyStack.push(state);
    if (this.historyStack.length > 50) this.historyStack.shift();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{"name": "System"}');
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`, timestamp: new Date().toLocaleTimeString(),
      user: currentUser.name, action: description.split(':')[0], details: description
    });
  }

  private notifyChange() {
    window.dispatchEvent(new CustomEvent('db-undo-success'));
  }

  undo() {
    if (this.historyStack.length <= 1) return false;
    this.historyStack.pop();
    const prevState = JSON.parse(this.historyStack[this.historyStack.length - 1]);
    this.stock = prevState.stock;
    this.users = prevState.users;
    this.operations = prevState.operations;
    this.invoices = prevState.invoices;
    this.payments = prevState.payments || [];
    this.customerPrices = prevState.customerPrices || [];
    this.internalSerialCounter = prevState.internalSerialCounter || 1000;
    this.procurements = prevState.procurements || [];
    this.gasTransactions = prevState.gasTransactions || [];
    this.employees = prevState.employees || [];
    this.payrollTransactions = prevState.payrollTransactions || [];
    this.foodExpenses = prevState.foodExpenses || [];
    this.transportExpenses = prevState.transportExpenses || [];
    this.portRents = prevState.portRents || [];
    this.notifications = prevState.notifications || [];
    this.supportContacts = prevState.supportContacts || [];
    this.faqs = prevState.faqs || [];
    this.portsInfo = prevState.portsInfo || [];
    this.maintenanceLogs = prevState.maintenanceLogs || [];
    this.notifyChange();
    return true;
  }

  getStock() { return this.stock; }
  getReservations() { return this.reservations; }
  getOperations() { return this.operations; }
  getInvoices() { return this.invoices; }
  getPayments() { return this.payments; }
  getUsers(): User[] { return this.users; }
  getAuditLogs() { return this.auditLogs; }
  getCustomerPrices() { return this.customerPrices; }
  getProcurements() { return this.procurements; }
  getGasTransactions() { return this.gasTransactions; }
  getEmployees() { return this.employees; }
  getFoodExpenses() { return this.foodExpenses; }
  getTransportExpenses() { return this.transportExpenses; }
  getPortRents() { return this.portRents; }
  getGasBalance() { return this.gasTransactions.reduce((sum, t) => t.type === 'TOPUP' ? sum + t.amount : sum - t.amount, 0); }
  getSupportContacts() { return this.supportContacts; }
  getFAQs() { return this.faqs; }
  getPortsInfo() { return this.portsInfo; }
  getMaintenanceLogs(): GensetMaintenanceLog[] { 
    return [...this.maintenanceLogs].sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()); 
  }
  getMaintenanceLogsForGenset(unitNumber: string): GensetMaintenanceLog[] {
    return this.maintenanceLogs
      .filter(l => l.gensetNumber.toUpperCase() === unitNumber.toUpperCase())
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }

  addMaintenanceLog(log: GensetMaintenanceLog) {
    this.maintenanceLogs.unshift(log);
    const unit = this.stock.find(s => s.unitNumber.toUpperCase() === log.gensetNumber.toUpperCase());
    if (unit) {
      if (!unit.lastMaintenanceDate || new Date(log.serviceDate) >= new Date(unit.lastMaintenanceDate)) {
        unit.lastMaintenanceDate = log.serviceDate;
      }
      if (log.nextServiceDue) unit.nextMaintenanceDue = log.nextServiceDue;
      if (log.runningHours && (!unit.runningHours || log.runningHours > unit.runningHours)) {
        unit.runningHours = log.runningHours;
      }
      unit.maintenanceCount = (unit.maintenanceCount || 0) + 1;
      if (log.status === 'IN_PROGRESS') {
        unit.status = GensetStatus.MAINTENANCE;
      } else if (log.status === 'COMPLETED' && unit.status === GensetStatus.MAINTENANCE) {
        unit.status = GensetStatus.IN_STOCK;
      }
    }
    this.saveSnapshot(`MAINTENANCE: Logged ${log.serviceType} for ${log.gensetNumber}`);
    this.notifyChange();
  }

  updateMaintenanceLog(log: GensetMaintenanceLog) {
    this.maintenanceLogs = this.maintenanceLogs.map(l => l.id === log.id ? log : l);
    const unit = this.stock.find(s => s.unitNumber.toUpperCase() === log.gensetNumber.toUpperCase());
    if (unit) {
      if (log.status === 'IN_PROGRESS') {
        unit.status = GensetStatus.MAINTENANCE;
      } else if (log.status === 'COMPLETED' && unit.status === GensetStatus.MAINTENANCE) {
        unit.status = GensetStatus.IN_STOCK;
      }
      if (log.runningHours && (!unit.runningHours || log.runningHours > unit.runningHours)) {
        unit.runningHours = log.runningHours;
      }
      if (log.nextServiceDue) {
        unit.nextMaintenanceDue = log.nextServiceDue;
      }
    }
    this.saveSnapshot(`MAINTENANCE: Updated record for ${log.gensetNumber}`);
    this.notifyChange();
  }

  deleteMaintenanceLog(id: string) {
    const log = this.maintenanceLogs.find(l => l.id === id);
    this.maintenanceLogs = this.maintenanceLogs.filter(l => l.id !== id);
    if (log) {
      this.saveSnapshot(`MAINTENANCE: Deleted record ${id} for ${log.gensetNumber}`);
    }
    this.notifyChange();
  }

  updateSupportContact(contact: SupportContact) {
    this.supportContacts = this.supportContacts.map(c => c.id === contact.id ? contact : c);
    this.saveSnapshot(`SUPPORT: Updated contact ${contact.name}`);
    this.notifyChange();
  }
  addSupportContact(contact: SupportContact) {
    this.supportContacts.push(contact);
    this.saveSnapshot(`SUPPORT: Added contact ${contact.name}`);
    this.notifyChange();
  }
  deleteSupportContact(id: string) {
    this.supportContacts = this.supportContacts.filter(c => c.id !== id);
    this.saveSnapshot(`SUPPORT: Deleted contact ${id}`);
    this.notifyChange();
  }

  updateFAQ(item: FAQItem) {
    this.faqs = this.faqs.map(f => f.id === item.id ? item : f);
    this.saveSnapshot(`SUPPORT: Updated FAQ ${item.id}`);
    this.notifyChange();
  }
  addFAQ(item: FAQItem) {
    this.faqs.push(item);
    this.saveSnapshot(`SUPPORT: Added FAQ`);
    this.notifyChange();
  }
  deleteFAQ(id: string) {
    this.faqs = this.faqs.filter(f => f.id !== id);
    this.saveSnapshot(`SUPPORT: Deleted FAQ ${id}`);
    this.notifyChange();
  }

  updatePortInfo(info: PortInfo) {
    this.portsInfo = this.portsInfo.map(p => p.id === info.id ? info : p);
    this.saveSnapshot(`SUPPORT: Updated Port Info ${info.location}`);
    this.notifyChange();
  }
  addPortInfo(info: PortInfo) {
    this.portsInfo.push(info);
    this.saveSnapshot(`SUPPORT: Added Port Info ${info.location}`);
    this.notifyChange();
  }
  deletePortInfo(id: string) {
    this.portsInfo = this.portsInfo.filter(p => p.id !== id);
    this.saveSnapshot(`SUPPORT: Deleted Port Info ${id}`);
    this.notifyChange();
  }

  updateOperation(updatedOp: Operation) {
    const oldOp = this.operations.find(o => o.id === updatedOp.id);
    this.operations = this.operations.map(op => op.id === updatedOp.id ? updatedOp : op);
    
    if (oldOp && oldOp.status !== updatedOp.status) {
      if (updatedOp.status === 'IN PROGRESS') {
        this.pushOperationalNotif('CLIP_ON', updatedOp);
      } else if (updatedOp.status === 'DONE') {
        this.pushOperationalNotif('CLIP_OFF', updatedOp);
      }
    }

    this.syncGensetStatusAndLocation(updatedOp);
    
    if (updatedOp.status === 'DONE' && !updatedOp.invoiced) {
      this.generateInvoiceFromBooking(updatedOp.bookingNumber, updatedOp.customerName);
    }

    this.saveSnapshot(`OPS: Updated operation ${updatedOp.bookingNumber}`);
    this.notifyChange();
  }

  private pushOperationalNotif(type: 'CLIP_ON' | 'CLIP_OFF', op: Operation) {
    const isClipOn = type === 'CLIP_ON';
    const msg = isClipOn 
      ? `Genset ${op.gensetNumber} deployed to Container ${op.containerNumber} at ${op.clipOnPort}.`
      : `Genset ${op.gensetNumber} released at ${op.clipOffPort}. Operation complete.`;
    const msgAr = isClipOn
      ? `تم تركيب المولد ${op.gensetNumber} على الحاوية ${op.containerNumber} في ميناء ${op.clipOnPort}.`
      : `تم فك المولد ${op.gensetNumber} في ميناء ${op.clipOffPort}. اكتملت المهمة.`;

    this.addNotification({
      type: isClipOn ? 'INFO' : 'SUCCESS',
      message: `[LOGISTICS]: ${msg}`,
      messageAr: `[العمليات]: ${msgAr}`,
      forceBanner: true
    });
  }

  confirmOperation(id: string) {
    this.operations = this.operations.map(op => op.id === id ? { ...op, reviewedByManager: true } : op);
    this.saveSnapshot(`BOSS: Verified record ${id}`);
    this.notifyChange();
  }

  confirmOperationsBulk(ids: string[]) {
    this.operations = this.operations.map(op => ids.includes(op.id) ? { ...op, reviewedByManager: true } : op);
    this.saveSnapshot(`BOSS: Force Verified ${ids.length} records`);
    this.notifyChange();
  }

  addOperation(op: Operation) {
    if (!op.internalSerial) op.internalSerial = this.generateInternalSerial();
    this.operations = [op, ...this.operations];
    this.syncGensetStatusAndLocation(op);
    
    if (op.status === 'IN PROGRESS') {
      this.pushOperationalNotif('CLIP_ON', op);
    }

    if (op.status === 'DONE' && !op.invoiced) {
      this.generateInvoiceFromBooking(op.bookingNumber, op.customerName);
    }

    this.saveSnapshot(`OPS: Manual Entry ${op.bookingNumber}`);
    this.notifyChange();
  }

  private syncGensetStatusAndLocation(op: Operation) {
    if (!op.gensetNumber) return;
    const genset = this.stock.find(s => s.unitNumber === op.gensetNumber);
    if (!genset) return;
    
    if (op.status === 'IN PROGRESS') {
      genset.status = GensetStatus.CLIPPED_ON;
    } else if (op.status === 'DONE' || op.status === 'CANCEL') {
      genset.status = GensetStatus.IN_STOCK;
      if (op.status === 'DONE' && op.clipOffPort) {
        genset.location = op.clipOffPort as Location;
      }
    }
  }

  generateInvoiceFromBooking(bookingNumber: string, customerName: string): Invoice | null {
    const units = this.operations.filter(o => 
      o.bookingNumber === bookingNumber && 
      o.customerName === customerName && 
      o.status === 'DONE' && 
      !o.invoiced
    );
    
    if (units.length === 0) return null;

    const amount = units.reduce((sum, u) => sum + (parseFloat(u.rate.replace(/,/g, '')) || 0) + (parseFloat(u.vat.replace(/,/g, '')) || 0), 0);
    const opIds = units.map(u => u.id);

    const invoice: Invoice = {
      id: `INV-${Date.now()}`,
      customerId: `cust-${customerName.toLowerCase()}`,
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
      etaStatus: 'DRAFT'
    };

    this.operations = this.operations.map(o => opIds.includes(o.id) ? { ...o, invoiced: true } : o);
    this.invoices.push(invoice);
    this.saveSnapshot(`FIN: Created Invoice ${invoice.id} (Automatic)`);

    this.addNotification({
      type: 'SUCCESS',
      message: `Invoice Issued: ${invoice.id} for ${invoice.customerName}`,
      messageAr: `تم إصدار فاتورة: ${invoice.id} للعميل ${invoice.customerName}`,
      forceBanner: false,
      targetOrgName: invoice.customerName
    });

    this.notifyChange();
    return invoice;
  }

  addPayment(payment: Payment, allocatedInvoiceIds: string[] = []) {
    this.payments.push(payment);
    const user = this.users.find(u => u.id === payment.customerId);
    if (!user) return;

    let remainingMoney = payment.amount;

    allocatedInvoiceIds.forEach(id => {
      const inv = this.invoices.find(i => i.id === id);
      if (inv && inv.status === 'UNPAID') {
        if (remainingMoney >= inv.amount) {
           inv.status = 'PAID';
           remainingMoney -= inv.amount;
        } else {
           inv.amount -= remainingMoney;
           remainingMoney = 0;
        }
      }
    });

    if (remainingMoney > 0) {
      user.pastOutstandingAmount = Math.max(0, (user.pastOutstandingAmount || 0) - remainingMoney);
    }

    this.saveSnapshot(`FIN: Recorded Payment ${payment.amount} from ${payment.customerName}`);
    this.notifyChange();
  }

  updateInvoiceEtaStatus(id: string, etaStatus: 'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID') {
    this.invoices = this.invoices.map(i => i.id === id ? { ...i, etaStatus } : i);
    this.saveSnapshot(`ETA: Status update for ${id} -> ${etaStatus}`);
    this.notifyChange();
  }

  updateInvoice(id: string, updated: Partial<Invoice>) {
    this.invoices = this.invoices.map(i => i.id === id ? { ...i, ...updated } : i);
    this.saveSnapshot(`FIN: Updated Invoice ${id}`);
    this.notifyChange();
  }

  updateUserFinance(userId: string, updates: { pastOutstandingAmount?: number }) {
    this.users = this.users.map(u => u.id === userId ? { ...u, ...updates } : u);
    this.saveSnapshot(`FIN: Updated ledger balance for ${userId}`);
    this.notifyChange();
  }

  addOperationsBulk(ops: Operation[]) {
    ops.forEach(op => {
      if (!op.internalSerial) op.internalSerial = this.generateInternalSerial();
      this.syncGensetStatusAndLocation(op);
      if (op.status === 'IN PROGRESS') this.pushOperationalNotif('CLIP_ON', op);
    });
    this.operations = [...ops, ...this.operations];
    
    const doneBookings = Array.from(new Set(ops.filter(o => o.status === 'DONE').map(o => o.bookingNumber)));
    doneBookings.forEach(bk => {
      const op = ops.find(o => o.bookingNumber === bk);
      if (op) this.generateInvoiceFromBooking(bk, op.customerName);
    });

    this.saveSnapshot(`OPS: Bulk deployment ${ops.length} units`);
    this.notifyChange();
  }

  updateGenset(updatedGenset: Genset) {
    this.stock = this.stock.map(s => s.id === updatedGenset.id ? updatedGenset : s);
    this.saveSnapshot(`STOCK: Updated unit ${updatedGenset.unitNumber}`);
    this.notifyChange();
  }

  addGenset(genset: Genset) {
    this.stock = [genset, ...this.stock];
    this.saveSnapshot(`STOCK: Registered new unit ${genset.unitNumber}`);
    this.notifyChange();
  }

  deleteGenset(id: string) {
    this.stock = this.stock.filter(s => s.id !== id);
    this.saveSnapshot(`STOCK: Deleted unit ${id}`);
    this.notifyChange();
  }

  updateUser(id: string, updates: Partial<User>) {
    this.users = this.users.map(u => u.id === id ? { ...u, ...updates } : u);
    this.saveSnapshot(`USER: Updated user access profile for ${id}`);
    this.notifyChange();
  }

  deleteUser(id: string) {
    this.users = this.users.filter(u => u.id !== id);
    this.saveSnapshot(`USER: Deleted user profile ${id}`);
    this.notifyChange();
  }

  addUser(user: User) {
    this.users.push({
      ...user,
      pastOutstandingAmount: user.pastOutstandingAmount || 0
    });
    this.saveSnapshot(`USER: Registered ${user.role} - ${user.name}`);
    this.notifyChange();
  }

  addCustomer(customer: any) {
    const id = customer.id || `cust-${Date.now()}`;
    const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    this.users.push({ ...customer, id, role: UserRole.CUSTOMER, avatarUrl: randomAvatar, pastOutstandingAmount: customer.pastOutstandingAmount || 0 });
    this.saveSnapshot(`USER: Registered customer ${customer.companyName}`);
    this.notifyChange();
  }

  addReservation(res: Reservation) {
    this.reservations = [res, ...this.reservations];
    this.saveSnapshot(`RES: Booking request ${res.bookingNumber}`);
    this.notifyChange();
  }

  setCustomerPrice(priceData: CustomerPrice) {
    const idx = this.customerPrices.findIndex(p => 
      p.customerName === priceData.customerName && p.portIn === priceData.portIn && p.portOut === priceData.portOut
    );
    if (idx !== -1) this.customerPrices[idx] = priceData;
    else this.customerPrices.push(priceData);
    this.saveSnapshot(`RATE: Rate update for ${priceData.customerName}`);
    this.notifyChange();
  }

  updateReservationStatus(id: string, status: any) {
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status } : r);
    this.notifyChange();
  }

  getEmployeeBalance(empId: string, month: string) {
    const txs = this.payrollTransactions.filter(t => t.employeeId === empId && t.month === month);
    const earnings = txs.filter(t => t.type === 'SALARY_BASE' || t.type === 'BONUS').reduce((s, t) => s + t.amount, 0);
    const deductions = txs.filter(t => t.type === 'ADVANCE').reduce((s, t) => s + t.amount, 0);
    return { earnings, deductions, balance: earnings - deductions };
  }

  getGasByPort() {
    const map: Record<string, number> = {};
    this.operations.forEach(op => {
      const fuel = parseFloat(op.gaz || '0');
      map[op.clipOnPort] = (map[op.clipOnPort] || 0) + fuel;
    });
    return map;
  }

  getGasByGenset() {
    const map: Record<string, number> = {};
    this.operations.forEach(op => {
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

  createOperationFromReservation(res: Reservation) {
    const newOperations: Operation[] = Array.from({ length: res.gensetsNeeded }).map((_, idx) => {
      const op: Operation = {
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
        rate: '0.00',
        vat: '0.00',
        notes: `From Res ${res.id}`,
        invoiced: false,
        reviewedByManager: false
      };
      const foundPrice = this.customerPrices.find(p => p.customerName === res.customerName && p.portIn === res.portIn && p.portOut === res.portOut);
      if (foundPrice) {
        op.rate = foundPrice.price.toFixed(2);
        op.vat = foundPrice.includeVat ? (foundPrice.price * 0.14).toFixed(2) : '0.00';
      }
      return op;
    });
    this.addOperationsBulk(newOperations);
    this.updateReservationStatus(res.id, ReservationStatus.APPROVED);
  }

  deleteOperation(id: string) {
    this.operations = this.operations.filter(o => o.id !== id);
    this.saveSnapshot(`OPS: Deleted operation ${id}`);
    this.notifyChange();
  }

  deleteOperationsBulk(ids: string[]) {
    this.operations = this.operations.filter(o => !ids.includes(o.id));
    this.saveSnapshot(`OPS: Force deleted ${ids.length} manifest entries`);
    this.notifyChange();
  }

  addProcurement(p: Procurement) { this.procurements.push(p); this.saveSnapshot(`EXP: General Procurement ${p.itemDescription}`); this.notifyChange(); }
  updateProcurement(p: Procurement) { this.procurements = this.procurements.map(item => item.id === p.id ? p : item); this.saveSnapshot(`EXP: Updated Procurement ${p.itemDescription}`); this.notifyChange(); }
  deleteProcurement(id: string) { this.procurements = this.procurements.filter(p => p.id !== id); this.saveSnapshot(`EXP: Deleted Procurement ${id}`); this.notifyChange(); }
  updateProcurementStatus(id: string, status: 'PENDING' | 'COMPLETED') { this.procurements = this.procurements.map(p => p.id === id ? { ...p, status } : p); this.notifyChange(); }
  
  addGasTransaction(t: GasTransaction) { this.gasTransactions.push(t); this.saveSnapshot(`EXP: Gas Topup ${t.amount}`); this.notifyChange(); }
  updateGasTransaction(t: GasTransaction) { this.gasTransactions = this.gasTransactions.map(item => item.id === t.id ? t : item); this.saveSnapshot(`EXP: Updated Gas TX ${t.id}`); this.notifyChange(); }
  deleteGasTransaction(id: string) { this.gasTransactions = this.gasTransactions.filter(t => t.id !== id); this.saveSnapshot(`EXP: Deleted Gas TX ${id}`); this.notifyChange(); }
  
  addEmployee(e: Employee) { this.employees.push(e); this.notifyChange(); }
  updateEmployee(e: Employee) { this.employees = this.employees.map(item => item.id === e.id ? e : item); this.notifyChange(); }
  deleteEmployee(id: string) { this.employees = this.employees.filter(e => e.id !== id); this.notifyChange(); }
  addPayrollTransaction(t: PayrollTransaction) { this.payrollTransactions.push(t); this.notifyChange(); }
  updatePayrollTransaction(t: PayrollTransaction) { this.payrollTransactions = this.payrollTransactions.map(item => item.id === t.id ? t : item); this.notifyChange(); }
  deletePayrollTransaction(id: string) { this.payrollTransactions = this.payrollTransactions.filter(t => t.id !== id); this.notifyChange(); }
  
  addFoodExpense(e: FoodExpense) { this.foodExpenses.push(e); this.saveSnapshot(`EXP: Food Allowance ${e.amount}`); this.notifyChange(); }
  updateFoodExpense(e: FoodExpense) { this.foodExpenses = this.foodExpenses.map(item => item.id === e.id ? e : item); this.saveSnapshot(`EXP: Updated Food Exp ${e.id}`); this.notifyChange(); }
  deleteFoodExpense(id: string) { this.foodExpenses = this.foodExpenses.filter(e => e.id !== id); this.saveSnapshot(`EXP: Deleted Food Exp ${id}`); this.notifyChange(); }
  
  addTransportExpense(e: TransportExpense) { this.transportExpenses.push(e); this.saveSnapshot(`EXP: Transport ${e.amount}`); this.notifyChange(); }
  updateTransportExpense(e: TransportExpense) { this.transportExpenses = this.transportExpenses.map(item => item.id === e.id ? e : item); this.saveSnapshot(`EXP: Updated Trans Exp ${e.id}`); this.notifyChange(); }
  deleteTransportExpense(id: string) { this.transportExpenses = this.transportExpenses.filter(e => e.id !== id); this.saveSnapshot(`EXP: Deleted Trans Exp ${id}`); this.notifyChange(); }
  
  addPortRent(e: PortRent) { this.portRents.push(e); this.saveSnapshot(`EXP: Port Rent ${e.amount} at ${e.port}`); this.notifyChange(); }
  updatePortRent(e: PortRent) { this.portRents = this.portRents.map(item => item.id === e.id ? e : item); this.saveSnapshot(`EXP: Updated Rent ${e.id}`); this.notifyChange(); }
  deletePortRent(id: string) { this.portRents = this.portRents.filter(e => e.id !== id); this.saveSnapshot(`EXP: Deleted Rent ${id}`); this.notifyChange(); }
  
  restartHistory() { this.auditLogs = []; this.historyStack = []; this.notifyChange(); }
}

export const db = new MockDB();
