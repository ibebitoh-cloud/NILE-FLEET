import React, { useState, useMemo, useContext, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { User, UserRole, Location, UserPermissions, hasReadOnlyAccess } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translateEntity } from '../translations';
import { runThinkingAudit } from '../services/aiService';
import { createRealAccount, activateAllCustomerUsers, resetCustomerPassword } from '../services/authService';
import { AVATARS } from '../constants';

const ALL_SYSTEM_SCREENS = [
  { id: 'dashboard', label: 'Operations Dashboard', icon: '📊', category: 'Operations' },
  { id: 'port-gate', label: 'Port Gate Control', icon: '🚧', category: 'Operations' },
  { id: 'master-view', label: 'Master View Manifest', icon: '📑', category: 'Operations' },
  { id: 'operations', label: 'Operations Tracker', icon: '🚛', category: 'Operations' },
  { id: 'stock', label: 'Genset Stock Management', icon: '⚡', category: 'Operations' },
  { id: 'reservations', label: 'Bookings & Reservations', icon: '📅', category: 'Commercial' },
  { id: 'customers', label: 'Partners Directory', icon: '🤝', category: 'Commercial' },
  { id: 'customer-prices', label: 'Customer Price Matrix', icon: '💰', category: 'Commercial' },
  { id: 'booking-invoices', label: 'Booking Invoices', icon: '🧾', category: 'Commercial' },
  { id: 'financials', label: 'Financials & Payments', icon: '🏦', category: 'Financials' },
  { id: 'analytics', label: 'Analytics Dashboard', icon: '📈', category: 'Analytics' },
  { id: 'intelligence', label: 'AI Intelligence Hub', icon: '🧠', category: 'Analytics' },
  { id: 'reports', label: 'Audit Reports & Analytics', icon: '📝', category: 'Analytics' },
  { id: 'user-mgmt', label: 'User & Access Management', icon: '👤', category: 'Administration' },
  { id: 'notifications', label: 'System Notifications', icon: '🔔', category: 'Administration' },
  { id: 'system-log', label: 'System Activity Log', icon: '🕒', category: 'Administration' },
  { id: 'support', label: 'Support Desk', icon: '🎧', category: 'General' },
  { id: 'user-settings', label: 'Personal User Settings', icon: '⚙️', category: 'General' },
  { id: 'cust-reservations', label: 'Customer Portal Bookings', icon: '📱', category: 'Customer Portal' },
  { id: 'cust-invoices', label: 'Customer Portal Invoices', icon: '💳', category: 'Customer Portal' },
];

const ALL_ACTION_PERMISSIONS: { key: keyof UserPermissions; label: string; icon: string; desc: string }[] = [
  { key: 'canCreate', label: 'Create Records', icon: '➕', desc: 'Allow creating bookings, operations, gensets and other records' },
  { key: 'canEdit', label: 'Edit Records', icon: '✏️', desc: 'Allow changing existing operational and user data' },
  { key: 'canDelete', label: 'Delete Records', icon: '🗑️', desc: 'Allow deleting records such as operations, invoices and gensets' },
  { key: 'canExport', label: 'Export Data & Reports', icon: '📤', desc: 'Allow downloading Excel, CSV, PDF reports' },
  { key: 'canViewFinancials', label: 'View Financial Ledgers', icon: '💵', desc: 'Allow viewing financial amounts, revenue, and expense ledgers' },
  { key: 'canManagePrices', label: 'Manage Price Matrices', icon: '🏷️', desc: 'Allow configuring customer rate matrices & tariffs' },
  { key: 'canApproveBookings', label: 'Approve/Reject Bookings', icon: '⚡', desc: 'Allow confirming customer reservation requests' },
  { key: 'canManageUsers', label: 'Manage Users', icon: '👤', desc: 'Allow creating, editing and managing user access' },
  { key: 'canKillAccess', label: 'Revoke User Access', icon: '⛔', desc: 'Allow disabling a user account' },
  { key: 'canBypassGeofence', label: 'Security Override', icon: '🛡️', desc: 'Allow approved security exceptions' },
];

const getRoleDefaultScreenIds = (role: UserRole): string[] => {
  if (role === UserRole.ADMIN) return ALL_SYSTEM_SCREENS.map(screen => screen.id);
  if (role === UserRole.GATE_OPERATOR) return ['port-gate', 'notifications', 'support', 'user-settings'];
  if (role === UserRole.MANAGER) return ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials', 'intelligence', 'reports', 'notifications', 'system-log', 'support', 'user-settings'];
  if (role === UserRole.CUSTOMER) return ['cust-reservations', 'cust-invoices', 'notifications', 'support'];
  return ['dashboard', 'master-view', 'reports', 'intelligence', 'notifications', 'support', 'system-log'];
};

const getEffectiveAllowedScreenIds = (user: any): string[] => {
  const configured = Array.isArray(user?.allowedScreens) ? user.allowedScreens : [];
  // Customer identities are strictly limited to the customer portal modules,
  // even if an old/stale profile still contains legacy screen IDs.
  if (user?.role === UserRole.CUSTOMER) return getRoleDefaultScreenIds(UserRole.CUSTOMER);
  return configured;
};

const getReadOnlyScreenIds = (role: UserRole): string[] => {
  if (role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.VIEWER) {
    return ['dashboard', 'master-view', 'reports', 'intelligence', 'notifications', 'support', 'system-log'];
  }
  return ['notifications', 'support'];
};

const getRoleDefaultPermissions = (role: UserRole): UserPermissions => ({
  isReadOnly: role === UserRole.VIEWER,
  canCreate: role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.GATE_OPERATOR || role === UserRole.CUSTOMER,
  canEdit: role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.GATE_OPERATOR,
  canDelete: role === UserRole.ADMIN,
  canExport: role !== UserRole.VIEWER,
  canViewFinancials: role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.CUSTOMER,
  canManagePrices: role === UserRole.ADMIN || role === UserRole.MANAGER,
  canApproveBookings: role === UserRole.ADMIN || role === UserRole.MANAGER,
  canManageUsers: role === UserRole.ADMIN,
  canKillAccess: role === UserRole.ADMIN,
  canBypassGeofence: role === UserRole.ADMIN,
});

const READ_ONLY_PERMISSIONS: UserPermissions = {
  isReadOnly: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canExport: false,
  canViewFinancials: false,
  canManagePrices: false,
  canApproveBookings: false,
  canManageUsers: false,
  canKillAccess: false,
  canBypassGeofence: false,
};

const isSystemAssistantUser = (user: any): boolean => {
  const name = String(user?.name || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();
  const company = String(user?.companyName || '').trim().toLowerCase();
  return name === 'dali' || name.startsWith('dali ') || email.startsWith('dali@') ||
    email.includes('dali@') || company === 'dali' || company.startsWith('dali ');
};

const ALL_LOCATIONS = Object.values(Location);

const UserMgmt: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  
  const [users, setUsers] = useState<any[]>(() => db.getUsers().filter(u => !isSystemAssistantUser(u)));
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'INTERNAL' | 'CUSTOMER' | 'SERVICE'>('ALL');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'PROFILE' | 'SCREENS' | 'PERMISSIONS' | 'SECURITY'>('PROFILE');
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);
  const avatarFallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editingUser?.name || editingUser?.email || 'Nile Fleet')}&backgroundColor=001f3f&fontFamily=Arial&fontWeight=700`;
  const profilePhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [authAdvice, setAuthAdvice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActivatingCustomers, setIsActivatingCustomers] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<'HYGIENE' | 'ISOLATION' | 'ROTATION' | 'GEOFENCE'>('HYGIENE');

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = hasReadOnlyAccess(currentUser);
  const isCreator = String(currentUser.email || '').trim().toLowerCase() === 'bebito@nilefleet.com' || currentUser.isCreator === true;
  const isAdmin = isCreator || currentUser.role === UserRole.ADMIN || currentUser.permissions?.canManageUsers;

  const refreshData = () => {
    setUsers(db.getUsers().filter(u => !isSystemAssistantUser(u)));
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    return users.filter(u => {
      if (isSystemAssistantUser(u)) return false;
      const matchesSearch = String(u.name || '').toLowerCase().includes(normalizedSearch) ||
                            String(u.email || '').toLowerCase().includes(normalizedSearch) ||
                            String(u.companyName || '').toLowerCase().includes(normalizedSearch);
      
      const matchesRole = roleFilter === 'ALL' ||
                          (roleFilter === 'INTERNAL' && u.role !== UserRole.CUSTOMER && !u.isServiceAccount) ||
                          (roleFilter === 'CUSTOMER' && u.role === UserRole.CUSTOMER) ||
                          (roleFilter === 'SERVICE' && u.isServiceAccount === true);
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const initNewUser = () => {
    setEditingUser({
      name: '',
      email: '',
      role: UserRole.MANAGER,
      password: Math.random().toString(36).slice(-8) + 'A1!',
      assignedPorts: [Location.ALEX, Location.DAM],
      allowedScreens: ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials',  'intelligence', 'reports', 'notifications', 'system-log', 'support', 'user-settings'],
      permissions: {
        isReadOnly: false,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canExport: true,
        canViewFinancials: false,
        canManagePrices: false,
        canApproveBookings: true,
        canManageUsers: false,
        canKillAccess: false,
        canBypassGeofence: false,
      },
      companyName: '',
      phoneNumber: '',
      jobTitle: 'Field Operator',
      department: 'Operations',
      avatarUrl: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      mfaEnabled: false,
      isServiceAccount: false,
      pastOutstandingAmount: 0,
      revoked: false
    });
    setModalTab('PROFILE');
    setShowAddModal(true);
  };

  const handleOpenEditUser = (u: any) => {
    setEditingUser({
      ...u,
      assignedPorts: u.assignedPorts || [],
      allowedScreens: getEffectiveAllowedScreenIds(u).length > 0 ? getEffectiveAllowedScreenIds(u) : (
        u.role === UserRole.ADMIN 
          ? ALL_SYSTEM_SCREENS.map(s => s.id)
          : u.role === UserRole.GATE_OPERATOR
          ? ['port-gate', 'notifications', 'support', 'user-settings']
          : u.role === UserRole.MANAGER
          ? ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials',  'intelligence', 'reports', 'notifications', 'system-log', 'support', 'user-settings']
          : u.role === UserRole.CUSTOMER
          ? ['cust-reservations', 'cust-invoices', 'notifications', 'support']
          : ['dashboard', 'master-view', 'reports', 'intelligence', 'support']
      ),
      permissions: {
        isReadOnly: u.permissions?.isReadOnly ?? false,
        canCreate: u.permissions?.canCreate ?? (u.role === UserRole.ADMIN || u.role === UserRole.GATE_OPERATOR || u.role === UserRole.CUSTOMER),
        canEdit: u.permissions?.canEdit ?? (u.role === UserRole.ADMIN || u.role === UserRole.GATE_OPERATOR),
        canDelete: u.permissions?.canDelete ?? (u.role === UserRole.ADMIN),
        canExport: u.permissions?.canExport ?? true,
        canViewFinancials: u.permissions?.canViewFinancials ?? (u.role === UserRole.ADMIN || u.role === UserRole.CUSTOMER),
        canManagePrices: u.permissions?.canManagePrices ?? (u.role === UserRole.ADMIN),
        canApproveBookings: u.permissions?.canApproveBookings ?? (u.role === UserRole.ADMIN),
        canManageUsers: u.permissions?.canManageUsers ?? (u.role === UserRole.ADMIN),
        canKillAccess: u.permissions?.canKillAccess ?? (u.role === UserRole.ADMIN),
        canBypassGeofence: u.permissions?.canBypassGeofence ?? (u.role === UserRole.ADMIN),
      }
    });
    setModalTab('PROFILE');
    setShowAddModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (editingUser) {
      if (editingUser.isCreator || String(editingUser.email || '').trim().toLowerCase() === 'bebito@nilefleet.com') {
        editingUser.role = UserRole.ADMIN;
        editingUser.jobTitle = 'SYSTEM DIRECTOR';
        editingUser.department = 'NILE FLEET COMMAND';
        editingUser.permissions = { isReadOnly:false, canCreate:true, canEdit:true, canDelete:true, canExport:true, canViewFinancials:true, canManagePrices:true, canApproveBookings:true, canManageUsers:true, canKillAccess:true, canBypassGeofence:true };
        editingUser.allowedScreens = ALL_SYSTEM_SCREENS.map(s => s.id);
      }
      const saved = await db.updateUser(editingUser.id, editingUser);
      if (!saved) {
        const detail = db.getLastDbError();
        alert(lang === 'ar' ? `تعذر حفظ تحديثات المستخدم في قاعدة البيانات. ${detail}` : `User updates could not be saved to the database. ${detail}`);
        return;
      }
      setEditingUser(null);
      setShowAddModal(false);
      refreshData();
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const isCustomer = editingUser.role === UserRole.CUSTOMER;
    const companyName = isCustomer ? (editingUser.companyName || editingUser.name) : editingUser.companyName;

    if (!editingUser.id) {
      // New account: create a REAL login via the secure server-side function
      if (!editingUser.email || !editingUser.password) {
        alert(lang === 'ar' ? 'البريد الإلكتروني وكلمة المرور مطلوبان' : 'Email and password are required');
        return;
      }
      const { userId, error } = await createRealAccount(editingUser.email, editingUser.password, {
        ...editingUser,
        companyName,
        jobTitle: String(editingUser.jobTitle || '').trim(),
        department: String(editingUser.department || '').trim(),
      });
      if (error) {
        alert((lang === 'ar' ? 'فشل إنشاء الحساب: ' : 'Failed to create account: ') + error);
        return;
      }
      await db.reloadUsers();
      if (!userId || !db.getUsers().some(user => user.id === userId)) {
        alert(lang === 'ar'
          ? `تم إنشاء حساب الدخول لكن تعذر تحميل ملف المستخدم. ${db.getLastDbError() || 'تحقق من أعمدة جدول profiles.'}`
          : `The login was created, but its profile is not visible in the app. ${db.getLastDbError() || 'Check the profiles table columns.'}`);
        return;
      }
    } else {
      const newUser = {
        ...editingUser,
        companyName,
        jobTitle: String(editingUser.jobTitle || '').trim(),
        department: String(editingUser.department || '').trim(),
      };
      const saved = await db.updateUser(editingUser.id, newUser);
      if (!saved) {
        alert((lang === 'ar' ? 'تعذر حفظ بيانات المستخدم والوظيفة في قاعدة البيانات. ' : 'Could not save the user and organization position to the database. ') + db.getLastDbError());
        return;
      }
    }

    setShowAddModal(false);
    setEditingUser(null);
    refreshData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (isReadOnly) return;
    const target = users.find(u => u.id === userId);
    if (target?.isCreator === true || String(target?.email || '').trim().toLowerCase() === 'bebito@nilefleet.com') {
      alert(lang === 'ar' ? 'حساب منشئ النظام محمي ولا يمكن حذفه.' : 'The system creator account is protected and cannot be deleted.');
      return;
    }
    if (window.confirm(lang === 'ar' ? 'هل تريد إلغاء صلاحية هذا المستخدم ومنعه من تسجيل الدخول؟' : 'Revoke this user’s access and block future sign-ins?')) {
      const deleted = await db.deleteUser(userId);
      if (!deleted) {
        alert(lang === 'ar' ? 'تعذر حذف المستخدم من قاعدة البيانات.' : 'User could not be deleted from the database.');
        return;
      }
      if (editingUser?.id === userId) {
        setShowAddModal(false);
        setEditingUser(null);
      }
      refreshData();
    }
  };

  const togglePortAccess = (loc: Location) => {
    if (!editingUser) return;
    const current: Location[] = editingUser.assignedPorts || [];
    const exists = current.includes(loc);
    const updated = exists ? current.filter(p => p !== loc) : [...current, loc];
    setEditingUser({ ...editingUser, assignedPorts: updated });
  };

  const toggleScreenAccess = (screenId: string) => {
    if (!editingUser) return;
    if (editingUser.permissions?.isReadOnly && !getReadOnlyScreenIds(editingUser.role).includes(screenId)) return;
    const current: string[] = getEffectiveAllowedScreenIds(editingUser);
    // Customers may only toggle their two customer-portal modules.
    if (editingUser.role === UserRole.CUSTOMER && !getRoleDefaultScreenIds(UserRole.CUSTOMER).includes(screenId)) return;
    const exists = current.includes(screenId);
    const updated = exists ? current.filter(s => s !== screenId) : [...current, screenId];
    setEditingUser({ ...editingUser, allowedScreens: updated });
  };

  const setScreenPreset = (preset: 'ALL' | 'ROLE' | 'READONLY' | 'CLEAR') => {
    if (!editingUser) return;
    if (preset === 'ALL') {
      setEditingUser({ ...editingUser, allowedScreens: ALL_SYSTEM_SCREENS.map(s => s.id), permissions: { ...editingUser.permissions, ...getRoleDefaultPermissions(UserRole.ADMIN) } });
    } else if (preset === 'CLEAR') {
      setEditingUser({ ...editingUser, allowedScreens: [] });
    } else if (preset === 'READONLY') {
      setEditingUser({
        ...editingUser,
        allowedScreens: getReadOnlyScreenIds(editingUser.role),
        permissions: { ...editingUser.permissions, ...READ_ONLY_PERMISSIONS },
      });
    } else if (preset === 'ROLE') {
      setEditingUser({ ...editingUser, allowedScreens: getRoleDefaultScreenIds(editingUser.role), permissions: { ...editingUser.permissions, ...getRoleDefaultPermissions(editingUser.role) } });
    }
  };

  const togglePermission = (permKey: keyof UserPermissions) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      permissions: {
        ...editingUser.permissions,
        [permKey]: !editingUser.permissions?.[permKey]
      }
    });
  };

  const handleSelectAvatar = (url: string) => {
    setEditingUser((prev: any) => ({ ...prev, avatarUrl: url }));
    setShowAvatarStudio(false);
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;

    if (!file.type.startsWith('image/')) {
      alert(lang === 'ar' ? 'يرجى اختيار صورة صالحة.' : 'Please select a valid image file.');
      e.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(lang === 'ar' ? 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت.' : 'Profile photo must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditingUser((prev: any) => ({ ...prev, avatarUrl: reader.result as string }));
      setShowAvatarStudio(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerateCustomerPassword = async () => {
    if (!editingUser || editingUser.role !== UserRole.CUSTOMER || isReadOnly || !isAdmin || isResettingPassword) return;
    const confirmed = window.confirm(
      lang === 'ar'
        ? 'سيتم إنشاء كلمة مرور جديدة لهذا العميل وتأكيد البريد الإلكتروني. كلمة المرور الحالية لن يمكن استرجاعها بعد التغيير. هل تريد المتابعة؟'
        : 'Generate a new password for this customer and confirm the email? The current password cannot be recovered after this change. Continue?'
    );
    if (!confirmed) return;

    setIsResettingPassword(true);
    try {
      const result = await resetCustomerPassword(editingUser.id);
      if (result.error || !result.password) {
        alert((lang === 'ar' ? 'فشل إنشاء كلمة المرور: ' : 'Password generation failed: ') + (result.error || 'Unknown error'));
        return;
      }
      setEditingUser((prev: any) => prev ? { ...prev, password: result.password } : prev);
      setShowPassword(true);
      alert(lang === 'ar'
        ? 'تم إنشاء كلمة مرور جديدة. احفظها وأرسلها للعميل بشكل آمن.'
        : 'A new password was generated. Save it and send it to the customer securely.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleActivateAllCustomers = async () => {
    if (isReadOnly || !isAdmin || isActivatingCustomers) return;
    const customerCount = users.filter(u => u.role === UserRole.CUSTOMER && !u.revoked).length;
    if (!customerCount) {
      alert(lang === 'ar' ? 'لا توجد حسابات عملاء نشطة للتفعيل.' : 'No active customer accounts found.');
      return;
    }
    const confirmed = window.confirm(
      lang === 'ar'
        ? `سيتم إنشاء كلمة مرور عشوائية جديدة لكل حساب من حسابات العملاء النشطة (${customerCount}) وتأكيد البريد الإلكتروني وتفعيل الحساب. هل تريد المتابعة؟`
        : `This will generate a new random password for all ${customerCount} active customer accounts, confirm their email, and activate them. Continue?`
    );
    if (!confirmed) return;

    setIsActivatingCustomers(true);
    try {
      const result = await activateAllCustomerUsers();
      if (result.error) {
        alert((lang === 'ar' ? 'فشل تفعيل حسابات العملاء: ' : 'Customer activation failed: ') + result.error);
        return;
      }
      await db.reloadUsers();
      refreshData();
      const credentials = (result.users || []).map(u => `${u.email}\t${u.password}`).join('\n');
      const summary = lang === 'ar'
        ? `تم تفعيل ${result.count || 0} حساب عميل. فشل: ${result.failed || 0}.\n\nسيتم عرض بيانات الدخول مرة واحدة فقط. احفظها بأمان.`
        : `Activated ${result.count || 0} customer accounts. Failed: ${result.failed || 0}.\n\nCredentials are shown only once. Save them securely.`;
      alert(summary + (credentials ? `\n\nEMAIL\tPASSWORD\n${credentials}` : ''));
    } finally {
      setIsActivatingCustomers(false);
    }
  };

  const runAuthAudit = async () => {
    setIsThinking(true);
    setAuthAdvice('');
    try {
      const prompt = `
        You are a Cybersecurity & Authorization Auditor for Nile Fleet.
        Analyze the complete system user roster and permissions:
        ${JSON.stringify(users.map(u => ({ name: u.name, role: u.role, ports: u.assignedPorts, screens: u.allowedScreens?.length, permissions: u.permissions, revoked: u.revoked })))}

        Provide a strategic report on access hygiene and strategic recommendations for credential rotation.
        Respond in ${lang === 'en' ? 'English' : 'Arabic'}. Keep it concise.
      `;
      const result = await runThinkingAudit(prompt, 4000);
      setAuthAdvice(result || 'Audit engine returned empty results.');
    } catch (e: any) {
      setAuthAdvice(`Access review unavailable: ${e?.message || 'AI service request failed.'}`);
    } finally {
      setIsThinking(false);
    }
  };

  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest font-mono";
  const inputClass = "w-full px-4 py-3 bg-[var(--input-bg)] border-2 border-[var(--border-primary)] rounded-2xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all";

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 text-start pb-24 text-[var(--text-primary)]">
      
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
           <h2 className="text-3xl font-black text-[#001F3F] dark:text-white uppercase tracking-tighter italic">Organization Access Directory</h2>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 font-mono">Full Granular User Access Data & Module Authorization Matrix</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            type="button"
            onClick={() => setShowMatrixModal(true)} 
            className="bg-slate-900 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-2"
          >
            <span>📊</span> System Access Matrix
          </button>
          {!isReadOnly && isAdmin && (
            <button
              type="button"
              onClick={handleActivateAllCustomers}
              disabled={isActivatingCustomers}
              className="bg-emerald-600 text-white border border-emerald-400 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-wait"
              title="Generate new passwords, confirm emails, and activate all active customer accounts"
            >
              {isActivatingCustomers ? '⏳ Activating Customers...' : '🔐 Activate All Customers'}
            </button>
          )}
          {!isReadOnly && (
            <button 
              type="button"
              onClick={initNewUser} 
              className="bg-[#001F3F] text-[#C2A378] border border-[#C2A37855] px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:scale-105 transition-all"
            >
              + Register New Identity
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-7 space-y-6">
          {/* SEARCH & FILTER BAR */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Search identity by name, email, partner company..." 
                className="w-full pl-12 pr-6 py-3 bg-[var(--input-bg)] border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:border-[var(--accent)] transition-all text-[var(--text-primary)]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shrink-0 flex-wrap gap-1">
               <button type="button" onClick={() => setRoleFilter('ALL')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${roleFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-[#001F3F] dark:text-white shadow-sm' : 'text-slate-400'}`}>All Roster</button>
               <button type="button" onClick={() => setRoleFilter('INTERNAL')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${roleFilter === 'INTERNAL' ? 'bg-white dark:bg-slate-700 text-[#001F3F] dark:text-white shadow-sm' : 'text-slate-400'}`}>Staff</button>
               <button type="button" onClick={() => setRoleFilter('CUSTOMER')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${roleFilter === 'CUSTOMER' ? 'bg-white dark:bg-slate-700 text-[#001F3F] dark:text-white shadow-sm' : 'text-slate-400'}`}>Partners</button>
               <button type="button" onClick={() => setRoleFilter('SERVICE')} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${roleFilter === 'SERVICE' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-400'}`}>API Tokens</button>
            </div>
          </div>

          {/* USER CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.map(u => {
              const isSA = u.isServiceAccount === true;
              const screenCount = getEffectiveAllowedScreenIds(u).length;
              return (
                <div 
                  key={u.id} 
                  className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all relative overflow-hidden text-start flex flex-col justify-between ${
                    u.revoked 
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' 
                      : (isSA ? 'bg-amber-50/20 dark:bg-amber-950/5 border-amber-200/50' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700')
                  }`}
                >
                   {u.revoked && (
                     <div className="absolute top-0 right-0 left-0 bg-rose-600 text-white font-black uppercase text-[8px] tracking-[0.25em] text-center py-1">
                       ☠ Access Suspension Activated
                     </div>
                   )}
                   <div className="flex items-start justify-between relative z-10 mt-2">
                      <div className="flex items-center gap-4">
                         <div className="relative">
                            <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center overflow-hidden border-2 border-slate-150 shadow-inner bg-slate-150">
                               <img src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} className="w-full h-full object-cover" alt="avatar" />
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${u.role === UserRole.ADMIN ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                         </div>
                         <div>
                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-base leading-none">{u.companyName || u.name}</h4>
                            <p className="text-[9px] font-black text-[#C2A378] uppercase tracking-widest mt-1">{u.jobTitle || u.role.replace('_', ' ')}</p>
                            <p className="text-[9px] font-bold text-slate-400 lowercase mt-0.5">{u.email}</p>
                         </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        {!isReadOnly && (
                          <button 
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-110 transition-all font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                            title="Edit User Access Data"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        )}
                        {!isReadOnly && isAdmin && currentUser.id !== u.id && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2.5 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                            title="Revoke user access"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                   </div>

                   {/* ACCESS DETAILS SUMMARY */}
                   <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                     <div className="flex items-center justify-between text-[9px] font-mono">
                       <span className="text-slate-400 font-bold uppercase">Screen Modules:</span>
                       <span className="font-black text-[#C2A378]">{screenCount} / {ALL_SYSTEM_SCREENS.length} Enabled</span>
                     </div>
                     <div className="flex items-center justify-between text-[9px] font-mono">
                       <span className="text-slate-400 font-bold uppercase">Assigned Ports:</span>
                       <div className="flex flex-wrap gap-1">
                         {u.assignedPorts && u.assignedPorts.length > 0 ? (
                           u.assignedPorts.map((p: any) => (
                             <span key={p} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded font-black text-[8px]">
                               {p}
                             </span>
                           ))
                         ) : (
                           <span className="text-slate-400 italic">All Ports</span>
                         )}
                       </div>
                     </div>
                   </div>

                   <div className="mt-4 flex flex-wrap gap-2 relative z-10 items-center justify-between">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {isSA ? (
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-xl font-mono font-black text-[8px] tracking-wider uppercase border border-amber-500/20">
                            🔒 {u.apiKeys?.length ? 'API token configured' : 'No API token configured'}
                          </span>
                        ) : (
                          <div className="px-3 py-1 bg-slate-900 text-[#C2A378] rounded-xl font-mono font-black text-[9px] tracking-widest shadow-inner">
                             {u.password || '••••••••'}
                          </div>
                        )}
                        {u.mfaEnabled && (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl font-black text-[8px] uppercase font-mono">
                            MFA
                          </span>
                        )}
                      </div>

                      {/* REVOCATION TOGGLE */}
                      {!isReadOnly && isAdmin && currentUser.id !== u.id && (
                        <button 
                          type="button"
                          onClick={async () => {
                            const nextState = !u.revoked;
                            const saved = await db.updateUser(u.id, { revoked: nextState });
                            if (saved) refreshData();
                            else alert(lang === 'ar' ? 'تعذر تحديث صلاحية المستخدم.' : 'Could not update user access.');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                            u.revoked 
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600 border-transparent shadow-sm' 
                              : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100 animate-pulse'
                          }`}
                        >
                          {u.revoked ? '✓ Restore' : '☠ KILL Access'}
                        </button>
                      )}
                   </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT AUDIT & COMPLIANCE SIDEBAR */}
        <div className="space-y-6 xl:col-span-5">
           <div className="bg-[#001F3F] p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C2A378]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div>
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-xl shadow-inner animate-pulse">🛡️</div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase text-[#C2A378]">Access Intelligence</h3>
                 </div>
                 
                 <div className="space-y-4 mb-4">
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] font-black uppercase text-slate-300">Authorization Audit Engine</p>
                          <p className="text-xs font-black italic text-[#C2A378]">
                             {users.length} Registered System Identities
                          </p>
                       </div>
                       <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                 </div>

                 <div className="min-h-[140px] mb-4 bg-white/5 rounded-3xl p-5 border border-white/10 overflow-y-auto max-h-[180px] custom-scrollbar text-start text-[10px] font-mono leading-relaxed text-slate-350">
                    {isThinking ? 'Analyzing authorization matrices...' : authAdvice || 'Run compliance scanner to analyze user access hygiene & port permissions...'}
                 </div>
              </div>
              
              <button 
                type="button"
                onClick={runAuthAudit}
                disabled={isThinking}
                className="w-full bg-white/10 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-white/20 transition-all disabled:opacity-50"
              >
                {isThinking ? 'Reading roster...' : 'Execute Audit Compliance Scan'}
              </button>
           </div>

           {/* SECURE AUDITING MULTI-TAB PANEL */}
           <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 p-8 shadow-sm text-start space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4 font-black">
                <h3 className="text-base text-slate-850 dark:text-white uppercase tracking-tight">Security Status</h3>
                <p className="text-[9px] text-[#C2A378] uppercase tracking-wider mt-1 font-mono">Security features and checks currently available in this app</p>
              </div>

              {/* Tabs list */}
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                <button type="button" onClick={() => setActiveTab('HYGIENE')} className={`py-4 px-1 rounded-xl text-[8px] font-black uppercase transition-all ${activeTab === 'HYGIENE' ? 'bg-[#001F3F] text-white shadow' : 'text-slate-400 hover:text-slate-800'}`}>Accounts</button>
                <button type="button" onClick={() => setActiveTab('ISOLATION')} className={`py-4 px-1 rounded-xl text-[8px] font-black uppercase transition-all ${activeTab === 'ISOLATION' ? 'bg-[#001F3F] text-white shadow' : 'text-slate-400 hover:text-slate-800'}`}>Isolate</button>
                <button type="button" onClick={() => setActiveTab('ROTATION')} className={`py-4 px-1 rounded-xl text-[8px] font-black uppercase transition-all ${activeTab === 'ROTATION' ? 'bg-[#001F3F] text-white shadow' : 'text-slate-400 hover:text-slate-800'}`}>Rotation</button>
                <button type="button" onClick={() => setActiveTab('GEOFENCE')} className={`py-4 px-1 rounded-xl text-[8px] font-black uppercase transition-all ${activeTab === 'GEOFENCE' ? 'bg-[#001F3F] text-white shadow' : 'text-slate-400 hover:text-slate-800'}`}>Geofence</button>
              </div>

              {/* Tab Content A: Account Hygiene */}
              {activeTab === 'HYGIENE' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl space-y-2">
                    <h5 className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest font-mono">No security audit result available</h5>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">This page does not verify identity de-identification, service-account restrictions, MFA enforcement, or password policy. Do not treat it as a security certification.</p>
                  </div>
                </div>
              )}

              {/* Tab Content B: Customer Isolation */}
              {activeTab === 'ISOLATION' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">This screen has no tenant-isolation test. Customer data access must be verified with real customer accounts and Supabase row-level security policies.</p>
                </div>
              )}

              {/* Tab Content C: Credential Rotation */}
              {activeTab === 'ROTATION' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">Password expiration, forced rotation, and reminder delivery are not configured by this app. No rotation reminders have been sent.</p>
                </div>
              )}

              {/* Tab Content D: Geofencing Control Link */}
              {activeTab === 'GEOFENCE' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">IP-based login geofencing and incident logging are not implemented here. Assigned port access shown in user profiles does not mean login location is enforced.</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* FULL USER ACCESS DATA MODAL / EDITOR */}
      {showAddModal && editingUser && !isReadOnly && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[300] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-4xl w-full overflow-hidden border-[8px] border-slate-900 animate-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
             {/* Modal Header */}
             <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="text-start flex items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => setShowAvatarStudio(true)}>
                    <img src={editingUser.avatarUrl || avatarFallback} onError={(e) => { const img = e.currentTarget; if (img.src !== avatarFallback) img.src = avatarFallback; }} alt="avatar" className="w-12 h-12 rounded-2xl object-cover border-2 border-[#C2A378]" />
                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Change</div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">
                      {editingUser.id ? `Edit User: ${editingUser.name || 'User Profile'}` : 'Create User'}
                    </h3>
                    <p className="text-[9px] text-[#C2A378] font-black uppercase tracking-[0.3em] font-mono">
                      User Profile & Access
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} className="p-2.5 bg-white/10 hover:bg-rose-600 rounded-full transition-all text-white">✕</button>
             </div>

             {/* Modal Navigation Tabs */}
             <div className="bg-slate-100 dark:bg-slate-800 p-2 border-b border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto shrink-0">
               <button 
                 type="button" 
                 onClick={() => setModalTab('PROFILE')} 
                 className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${modalTab === 'PROFILE' ? 'bg-[#001F3F] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
               >
                 👤 Profile
               </button>
               <button 
                 type="button" 
                 onClick={() => setModalTab('SCREENS')} 
                 className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${modalTab === 'SCREENS' ? 'bg-[#001F3F] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
               >
                 🖥️ Screens ({editingUser.allowedScreens?.length || 0})
               </button>
               <button 
                 type="button" 
                 onClick={() => setModalTab('PERMISSIONS')} 
                 className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${modalTab === 'PERMISSIONS' ? 'bg-[#001F3F] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
               >
                 ⚡ Permissions
               </button>
               <button 
                 type="button" 
                 onClick={() => setModalTab('SECURITY')} 
                 className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${modalTab === 'SECURITY' ? 'bg-[#001F3F] text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
               >
                 🔒 Account Status
               </button>
             </div>
             
             {/* Modal Body Form */}
             <form onSubmit={editingUser.id ? handleUpdateUser : handleAddUser} className="p-6 md:p-8 space-y-6 text-start flex-1 overflow-y-auto custom-scrollbar">
                
                {/* TAB 1: IDENTITY & LOGISTICS */}
                {modalTab === 'PROFILE' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* PROFILE PHOTO */}
                      <div className="lg:col-span-3 p-5 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                        <p className={labelClass}>{lang === 'ar' ? 'صورة الملف الشخصي' : 'Profile Photo'}</p>
                        <div className="relative group mb-4">
                          <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl bg-slate-200 dark:bg-slate-900">
                            <img
                              src={editingUser.avatarUrl || avatarFallback}
                              onError={(e) => { const img = e.currentTarget; if (img.src !== avatarFallback) img.src = avatarFallback; }}
                              className="w-full h-full object-cover"
                              alt="profile"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => profilePhotoInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-[#001F3F] text-[#C2A378] border-2 border-white dark:border-slate-800 shadow-lg font-black"
                            title={lang === 'ar' ? 'رفع صورة' : 'Upload Photo'}
                          >
                            ↑
                          </button>
                        </div>
                        <input
                          ref={profilePhotoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePhotoUpload}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAvatarStudio(true)}
                          className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider"
                        >
                          {lang === 'ar' ? 'اختيار صورة' : 'Choose Avatar'}
                        </button>
                        <p className="text-[8px] text-slate-400 mt-2">
                          {lang === 'ar' ? 'JPG / PNG • حتى 2 ميجابايت' : 'JPG / PNG • Max 2 MB'}
                        </p>
                      </div>

                      {/* IDENTITY + LOGISTICS */}
                      <div className="lg:col-span-9 space-y-5">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                          <span className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">🪪</span>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">
                              {lang === 'ar' ? 'الهوية واللوجستيات' : 'Identity & Logistics'}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-medium">
                              {lang === 'ar' ? 'بيانات المستخدم التشغيلية والهوية ومعلومات موقع العمل في نموذج واحد.' : 'Identity, role, contact and logistics assignment in one profile.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'الاسم المعروض' : 'Display Name'} *</label>
                            <input required className={inputClass} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} placeholder={lang === 'ar' ? 'مثال: مصطفى إبراهيم' : 'e.g. Mostafa Ibrahim'} />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'} *</label>
                            <input required type="email" className={inputClass} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} placeholder="user@nilefleet.com" />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'الصفة الوظيفية' : 'Role Class'} *</label>
                            <select className={inputClass} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                              <option value={UserRole.ADMIN}>SYSTEM DIRECTOR (Full System Access)</option>
                              <option value={UserRole.MANAGER}>MANAGER (Operations & Business Management)</option>
                              <option value={UserRole.GATE_OPERATOR}>GATE OPERATOR (Field Operations & Terminal)</option>
                              <option value={UserRole.VIEWER}>SURVEILLANCE / AUDITOR (View Only Monitoring)</option>
                              <option value={UserRole.CUSTOMER}>PARTNER / CUSTOMER (Client Portal Access)</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'الشركة / الشريك' : 'Partner / Company Name'}</label>
                            <input className={inputClass} value={editingUser.companyName || ''} onChange={e => setEditingUser({...editingUser, companyName: e.target.value})} placeholder="e.g. MAERSK / NILE FLEET" />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}</label>
                            <input className={inputClass} value={editingUser.jobTitle || ''} onChange={e => setEditingUser({...editingUser, jobTitle: e.target.value})} placeholder="e.g. Logistics Manager" />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'الإدارة' : 'Department'}</label>
                            <input className={inputClass} value={editingUser.department || ''} onChange={e => setEditingUser({...editingUser, department: e.target.value})} placeholder="e.g. Port Operations" />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                            <input className={inputClass} value={editingUser.phoneNumber || ''} onChange={e => setEditingUser({...editingUser, phoneNumber: e.target.value})} placeholder="+20 1xx xxx xxxx" />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'المحافظة' : 'Governorate'}</label>
                            <input className={inputClass} value={editingUser.governorate || ''} onChange={e => setEditingUser({...editingUser, governorate: e.target.value})} placeholder={lang === 'ar' ? 'مثال: بورسعيد' : 'e.g. Port Said'} />
                          </div>
                        </div>

                        <div className="p-5 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl border border-blue-500/20">
                          <div className="flex items-center justify-between mb-4 gap-3">
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">{lang === 'ar' ? 'الموانئ المخصصة' : 'Assigned Logistics Ports'}</h4>
                              <p className="text-[9px] text-slate-400 mt-0.5">{lang === 'ar' ? 'حدد الموانئ التي يمكن لهذا المستخدم تشغيلها وإدارة عملياتها.' : 'Select the ports this user can operate and manage.'}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button type="button" onClick={() => setEditingUser({ ...editingUser, assignedPorts: [...ALL_LOCATIONS] })} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase">
                                {lang === 'ar' ? 'كل الموانئ' : 'Select All'}
                              </button>
                              <button type="button" onClick={() => setEditingUser({ ...editingUser, assignedPorts: [] })} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[8px] font-black uppercase">
                                {lang === 'ar' ? 'مسح' : 'Clear'}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {ALL_LOCATIONS.map(loc => {
                              const isAssigned = editingUser.assignedPorts?.includes(loc);
                              return (
                                <button
                                  key={loc}
                                  type="button"
                                  onClick={() => togglePortAccess(loc)}
                                  className={`p-3 rounded-xl border-2 text-start transition-all ${isAssigned ? 'bg-blue-500/10 border-blue-500 text-blue-600' : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                >
                                  <span className="block font-black text-[10px] uppercase">{loc}</span>
                                  <span className="block text-[8px] mt-0.5 text-slate-400">
                                    {loc === Location.DAM ? 'Damietta' : loc === Location.ALEX ? 'Alexandria' : loc === Location.GOUDA ? 'Gouda' : loc === Location.SOKHNA ? 'Sokhna' : loc === Location.SCCT ? 'SCCT' : loc === Location.PSD ? 'Port Said' : loc === Location.MAL ? 'Mallaoui' : 'Workshop'}
                                  </span>
                                  {isAssigned && <span className="float-end text-emerald-500 font-black">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'الرصيد السابق المستحق' : 'Past Outstanding Ledger Balance (EGP)'}</label>
                            <input type="number" className={inputClass} value={editingUser.pastOutstandingAmount || 0} onChange={e => setEditingUser({...editingUser, pastOutstandingAmount: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div>
                            <label className={labelClass}>{lang === 'ar' ? 'تاريخ الانضمام' : 'Joined Date'}</label>
                            <input type="date" className={inputClass} value={editingUser.joinedDate || ''} onChange={e => setEditingUser({...editingUser, joinedDate: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#C2A378]">{lang === 'ar' ? 'بيانات الدخول' : 'Authentication Credentials'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>{lang === 'ar' ? 'كلمة مرور البوابة' : 'Portal Password'}</label>
                          <div className="relative">
                            <input type={showPassword ? "text" : "password"} className={inputClass} value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} placeholder={editingUser.role === UserRole.CUSTOMER && !editingUser.password ? (lang === 'ar' ? 'كلمة المرور غير متاحة — أنشئ كلمة جديدة' : 'Password not available — generate a new one') : ''} />
                            <div className="absolute right-2 top-2 flex items-center gap-1">
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="px-2 py-1 text-xs text-slate-400 font-bold uppercase">
                                {showPassword ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
                              </button>
                            </div>
                          </div>
                          {editingUser.role === UserRole.CUSTOMER && (
                            <button
                              type="button"
                              onClick={handleGenerateCustomerPassword}
                              disabled={isReadOnly || !isAdmin || isResettingPassword}
                              className="mt-2 w-full rounded-xl border border-[#C2A378]/40 bg-[#C2A378]/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-[#C2A378] hover:bg-[#C2A378]/20 disabled:opacity-50"
                            >
                              {isResettingPassword
                                ? (lang === 'ar' ? 'جاري إنشاء كلمة المرور...' : 'Generating New Password...')
                                : (lang === 'ar' ? 'إنشاء كلمة مرور جديدة' : 'Generate New Password')}
                            </button>
                          )}
                          {editingUser.role === UserRole.CUSTOMER && (
                            <p className="mt-1.5 text-[10px] text-slate-400">
                              {lang === 'ar' ? 'يتم ضبط كلمة المرور مباشرة في Supabase Auth ولا يتم حفظها في ملف العميل.' : 'The new password is set directly in Supabase Auth and is not stored in the customer profile.'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: SCREEN / MODULE ACCESS CONTROL */}
                {modalTab === 'SCREENS' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 gap-3">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Screen & Module Access Matrix</h4>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Choose the screens this user can open. Read-Only also disables changes; Clear removes all screen access.</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setScreenPreset('ALL')}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase tracking-wider"
                        >
                          ⚡ Full Access
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setScreenPreset('ROLE')}
                          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase tracking-wider"
                        >
                          🛡️ Role Default
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setScreenPreset('READONLY')}
                          aria-pressed={editingUser.permissions?.isReadOnly === true}
                          className={`px-2.5 py-1.5 bg-amber-600 text-white rounded-xl text-[8px] font-black uppercase tracking-wider ${editingUser.permissions?.isReadOnly ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
                        >
                          👁️ Read-Only
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setScreenPreset('CLEAR')}
                          className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[8px] font-black uppercase tracking-wider"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {ALL_SYSTEM_SCREENS.map(screen => {
                        const isAllowed = editingUser.allowedScreens?.includes(screen.id);
                        const isLockedByReadOnly = editingUser.permissions?.isReadOnly === true && !getReadOnlyScreenIds(editingUser.role).includes(screen.id);
                        return (
                          <button
                            type="button"
                            key={screen.id} 
                            disabled={isLockedByReadOnly}
                            onClick={() => toggleScreenAccess(screen.id)}
                            aria-pressed={!!isAllowed}
                            className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${isLockedByReadOnly ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${
                              isAllowed 
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400'
                            }`}
                          >
                             <div className="flex items-center gap-2.5">
                               <span className="text-xl">{screen.icon}</span>
                               <div>
                                 <p className="font-black text-xs leading-tight">{screen.label}</p>
                                 <p className="text-[8px] font-mono uppercase text-slate-400 mt-0.5">{screen.category}</p>
                               </div>
                             </div>
                             <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${isAllowed ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
                               {isAllowed ? '✓' : ''}
                             </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 4: ACTION RIGHTS & PERMISSIONS */}
                {modalTab === 'PERMISSIONS' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">Granular Functional Rights</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Control specific action capabilities such as record creation, data purging, price edits, and kill-switches.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ALL_ACTION_PERMISSIONS.map(perm => {
                        const isGranted = !!editingUser.permissions?.[perm.key];
                        return (
                          <div 
                            key={perm.key} 
                            onClick={() => togglePermission(perm.key)}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                              isGranted 
                                ? 'bg-blue-500/10 border-blue-500 text-slate-900 dark:text-white shadow-sm' 
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400'
                            }`}
                          >
                            <span className="text-2xl mt-0.5">{perm.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h5 className="font-black text-xs uppercase tracking-wider">{perm.label}</h5>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono ${isGranted ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  {isGranted ? 'GRANTED' : 'DENIED'}
                                </span>
                              </div>
                              <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-1">{perm.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 5: SECURITY STATUS & REVOCATION */}
                {modalTab === 'SECURITY' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                       <h4 className="text-sm font-black uppercase text-[#C2A378]">Security Flags & Account Types</h4>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div 
                           onClick={() => setEditingUser({...editingUser, mfaEnabled: !editingUser.mfaEnabled})}
                           className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                             editingUser.mfaEnabled 
                               ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' 
                               : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                           }`}
                         >
                            <div>
                              <p className="font-black text-xs uppercase">Multi-Factor Auth (MFA)</p>
                              <p className="text-[9px] font-medium text-slate-400 mt-0.5">Require 2FA code on login</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[9px] font-black ${editingUser.mfaEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {editingUser.mfaEnabled ? 'ACTIVE' : 'OFF'}
                            </span>
                         </div>

                         <div 
                           onClick={() => setEditingUser({...editingUser, isServiceAccount: !editingUser.isServiceAccount})}
                           className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                             editingUser.isServiceAccount 
                               ? 'bg-amber-500/10 border-amber-500 text-amber-600' 
                               : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                           }`}
                         >
                            <div>
                              <p className="font-black text-xs uppercase">Service Account (API Only)</p>
                              <p className="text-[9px] font-medium text-slate-400 mt-0.5">Prohibit UI login, use token keys</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[9px] font-black ${editingUser.isServiceAccount ? 'bg-amber-500 text-slate-900' : 'bg-slate-200 text-slate-600'}`}>
                              {editingUser.isServiceAccount ? 'SERVICE KEY' : 'USER PASS'}
                            </span>
                         </div>
                       </div>
                    </div>

                    <div className="p-6 bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-200 dark:border-rose-900 space-y-4">
                       <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Access Suspension & Danger Controls</h4>
                       <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">Kill-Switch Access Revocation</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Instantly suspend all login privileges for this identity across all terminals.</p>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setEditingUser({ ...editingUser, revoked: !editingUser.revoked })}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              editingUser.revoked ? 'bg-emerald-600 text-white shadow-lg' : 'bg-rose-600 text-white shadow-lg animate-pulse'
                            }`}
                          >
                            {editingUser.revoked ? '✓ Restore Access' : '☠ REVOKE & SUSPEND ACCESS'}
                          </button>
                       </div>

                       {editingUser.id && (
                         <div className="border-t border-rose-200 dark:border-rose-900 pt-4 flex justify-between items-center">
                           <div>
                             <p className="text-xs font-bold text-rose-600">Delete User Identity Profile</p>
                             <p className="text-[9px] text-slate-400">Revoke access so this profile can no longer sign in. The profile remains in the database.</p>
                           </div>
                           <button 
                             type="button"
                             onClick={() => handleDeleteUser(editingUser.id)}
                             className="px-5 py-2.5 bg-rose-900 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-950"
                           >
                             Delete Profile
                           </button>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {/* Submit Action Bar */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                   <button 
                     type="button" 
                     onClick={() => setShowAddModal(false)}
                     className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit" 
                     className="px-8 py-3 bg-[#001F3F] text-[#C2A378] border border-[#C2A37855] rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:scale-105 transition-all"
                   >
                     Commit Access Profile Updates
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* SYSTEM ACCESS MATRIX SPREADSHEET MODAL */}
      {showMatrixModal && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border-[8px] border-slate-900 flex flex-col my-auto">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                   <h3 className="text-xl font-black italic uppercase tracking-tight text-[#C2A378]">System User Access Data Matrix</h3>
                   <p className="text-[9px] text-slate-400 font-mono">Consolidated overview of all user accounts, permissions, assigned ports, and screen access rights</p>
                </div>
                <button type="button" onClick={() => setShowMatrixModal(false)} className="p-2 text-white hover:bg-rose-600 rounded-full">✕</button>
             </div>

             <div className="p-6 flex-1 overflow-auto custom-scrollbar">
               <table className="w-full text-start border-collapse text-xs">
                 <thead>
                   <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-400 font-black uppercase text-[9px] tracking-widest font-mono">
                     <th className="p-3 text-start">Identity</th>
                     <th className="p-3 text-start">Role</th>
                     <th className="p-3 text-start">Assigned Hubs</th>
                     <th className="p-3 text-start">Allowed Screens</th>
                     <th className="p-3 text-start">Action Rights</th>
                     <th className="p-3 text-start">Status</th>
                     <th className="p-3 text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {users.map(u => {
                     const screensCount = getEffectiveAllowedScreenIds(u).length;
                     return (
                       <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                         <td className="p-3">
                           <div className="flex items-center gap-3">
                             <img src={u.avatarUrl} className="w-8 h-8 rounded-lg object-cover" alt="avatar" />
                             <div>
                               <p className="font-black text-slate-900 dark:text-white uppercase">{u.companyName || u.name}</p>
                               <p className="text-[9px] text-slate-400">{u.email}</p>
                             </div>
                           </div>
                         </td>
                         <td className="p-3">
                           <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 font-black text-[9px] uppercase rounded-lg">
                             {u.role}
                           </span>
                         </td>
                         <td className="p-3">
                           <div className="flex flex-wrap gap-1">
                             {u.assignedPorts && u.assignedPorts.length > 0 ? (
                               u.assignedPorts.map((p: any) => (
                                 <span key={p} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded font-black text-[8px]">{p}</span>
                               ))
                             ) : (
                               <span className="text-slate-400 italic text-[9px]">All Hubs</span>
                             )}
                           </div>
                         </td>
                         <td className="p-3">
                           <span className="font-black text-[#C2A378] text-[10px] font-mono">{screensCount} / {ALL_SYSTEM_SCREENS.length} Screens</span>
                         </td>
                         <td className="p-3">
                           <div className="flex flex-wrap gap-1">
                             {u.permissions?.canCreate && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[8px] font-black">Create</span>}
                             {u.permissions?.canEdit && <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[8px] font-black">Edit</span>}
                             {u.permissions?.canDelete && <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 rounded text-[8px] font-black">Delete</span>}
                             {u.permissions?.canViewFinancials && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[8px] font-black">Financials</span>}
                           </div>
                         </td>
                         <td className="p-3">
                           {u.revoked ? (
                             <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-black text-[8px] uppercase">SUSPENDED</span>
                           ) : (
                             <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded font-black text-[8px] uppercase">ACTIVE</span>
                           )}
                         </td>
                         <td className="p-3 text-center">
                           {!isReadOnly && (
                             <button 
                               type="button" 
                               onClick={() => { setShowMatrixModal(false); handleOpenEditUser(u); }}
                               className="px-3 py-1 bg-blue-600 text-white rounded-lg font-black text-[9px] uppercase hover:bg-blue-700"
                             >
                               Edit Access
                             </button>
                           )}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* AVATAR SELECTOR STUDIO MODAL */}
      {showAvatarStudio && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[500] flex items-center justify-center p-6" onClick={() => setShowAvatarStudio(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] max-w-4xl w-full h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
                <h3 className="text-xl font-black italic uppercase tracking-widest text-[#C2A378]">Identity Avatar Hub</h3>
                <button type="button" onClick={() => setShowAvatarStudio(false)} className="text-white hover:text-rose-500">✕</button>
             </div>
             <div className="flex-1 overflow-y-auto p-10 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {AVATARS.map((url, idx) => (
                   <div 
                      key={idx} 
                      onClick={() => handleSelectAvatar(url)}
                      className={`aspect-square rounded-xl overflow-hidden border-4 cursor-pointer hover:scale-110 transition-all ${editingUser?.avatarUrl === url ? 'border-[#C2A378] shadow-lg' : 'border-slate-100 dark:border-slate-800'}`}
                   >
                      <img src={url} className="w-full h-full object-cover" alt="stock avatar" />
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMgmt;
