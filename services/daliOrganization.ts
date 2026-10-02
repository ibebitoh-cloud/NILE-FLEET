import { User, UserRole } from '../types';

/** DALI's explicit organizational context for the Nile Fleet Genset Department. */
export interface DaliOrgNode {
  id: string;
  name: string;
  role: string;
  roleAr: string;
  department: string;
  departmentAr: string;
  reportsTo?: string;
  scope: string[];
  scopeAr: string[];
}

export const DALI_ORG_NODES: DaliOrgNode[] = [
  { id: 'ceo', name: 'Sherif Hegazy', role: 'CEO', roleAr: 'الرئيس التنفيذي', department: 'Nile Fleet', departmentAr: 'أسطول النيل', scope: ['Company leadership', 'Overall Nile Fleet operations'], scopeAr: ['إدارة الشركة', 'التشغيل العام لأسطول النيل'] },
  { id: 'transport-head', name: 'Samar Hegazy', role: 'Transport Department Head', roleAr: 'رئيس قسم النقل', department: 'Transport Department', departmentAr: 'قسم النقل', reportsTo: 'ceo', scope: ['Transport operations'], scopeAr: ['عمليات النقل'] },
  { id: 'genset-head', name: 'Yasmine Hegazy', role: 'Genset Department Head', roleAr: 'رئيس قسم المولدات', department: 'Genset Department', departmentAr: 'فرع المولدات', reportsTo: 'ceo', scope: ['Genset operations', 'Genset fleet status', 'Port coordination', 'Maintenance coordination', 'Workshop coordination'], scopeAr: ['عمليات المولدات', 'حالة أسطول المولدات', 'التنسيق بين الموانئ', 'تنسيق الصيانة', 'تنسيق الورشة'] },
];

export const isDaliAllowedRole = (user?: Pick<User, 'role'> | null) =>
  user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

export function getDaliOrgNodeForUser(user: Pick<User, 'role' | 'department' | 'jobTitle'>): DaliOrgNode | null {
  const department = String(user.department || '').trim().toUpperCase();
  const title = String(user.jobTitle || '').trim().toUpperCase();
  if (department.includes('GENSET') || department.includes('مولد')) return DALI_ORG_NODES.find(n => n.id === 'genset-head') || null;
  if (department.includes('TRANSPORT') || department.includes('نقل')) return DALI_ORG_NODES.find(n => n.id === 'transport-head') || null;
  if (user.role === UserRole.ADMIN) return DALI_ORG_NODES.find(n => n.id === 'ceo') || null;
  if (title.includes('GENSET')) return DALI_ORG_NODES.find(n => n.id === 'genset-head') || null;
  return null;
}

export function buildDaliOrganizationContext(user: User, isArabic: boolean): string {
  const currentNode = getDaliOrgNodeForUser(user);
  const hierarchy = DALI_ORG_NODES.map(node => {
    const parent = node.reportsTo ? DALI_ORG_NODES.find(n => n.id === node.reportsTo) : undefined;
    return node.name + ' — ' + (isArabic ? node.roleAr : node.role) + (parent ? ' → reports to ' + parent.name : '');
  }).join('\n');
  const userLines = [
    'CURRENT USER ROLE: ' + user.role,
    'CURRENT USER DEPARTMENT: ' + (user.department || 'Not specified'),
    'CURRENT USER JOB TITLE: ' + (user.jobTitle || 'Not specified'),
    'CURRENT USER ASSIGNED PORTS: ' + ((user.assignedPorts || []).join(', ') || 'Not specified'),
    'CURRENT USER DALI ACCESS: ' + (isDaliAllowedRole(user) ? 'ALLOWED' : 'DENIED'),
    'CURRENT USER SENTINEL ACCESS: ' + (isDaliAllowedRole(user) ? 'ALLOWED' : 'DENIED'),
  ];
  const genset = DALI_ORG_NODES.find(n => n.id === 'genset-head');
  return [
    'DALI ORGANIZATION CONTEXT',
    'Nile Fleet = أسطول النيل. DALI is specialized in the Genset Department (فرع المولدات).',
    'Use this hierarchy only as organizational context. Never invent a reporting line or responsibility that is not recorded here or in the user profile.',
    'When asked who is responsible, identify the relevant department or role from this structure and clearly say when a specific person is not recorded.',
    'DALI and Sentinel access are restricted to ADMIN and MANAGER. Customers and other roles must not receive DALI or Sentinel access.',
    '', 'CURRENT USER:', ...userLines,
    currentNode ? 'CURRENT USER ORGANIZATIONAL AREA: ' + currentNode.name + ' — ' + (isArabic ? currentNode.roleAr : currentNode.role) : 'CURRENT USER ORGANIZATIONAL AREA: Not explicitly mapped.',
    '', 'RECORDED COMPANY HIERARCHY:', hierarchy,
    '', 'GENSET DEPARTMENT SCOPE:', (isArabic ? (genset?.scopeAr || []) : (genset?.scope || [])).join(', '),
  ].join('\n');
}