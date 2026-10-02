import { User, UserRole } from '../types';
import { supabase } from './supabaseClient';

/** DALI's organizational context is stored in Supabase so changes do not require a code edit. */
export interface DaliOrgNode {
  id: string;
  userId?: string;
  name: string;
  nameAr?: string;
  role: string;
  roleAr: string;
  department: string;
  departmentAr: string;
  reportsTo?: string;
  scope: string[];
  scopeAr: string[];
  assignedPorts?: string[];
  daliAccess: boolean;
  sentinelAccess: boolean;
  active: boolean;
}

const FALLBACK_ORG_NODES: DaliOrgNode[] = [
  { id: 'ceo', name: 'Sherif Hegazy', role: 'CEO', roleAr: 'الرئيس التنفيذي', department: 'Nile Fleet', departmentAr: 'أسطول النيل', scope: ['Company leadership', 'Overall Nile Fleet operations'], scopeAr: ['إدارة الشركة', 'التشغيل العام لأسطول النيل'], daliAccess: true, sentinelAccess: true, active: true },
  { id: 'transport-head', name: 'Samar Hegazy', role: 'Transport Department Head', roleAr: 'رئيس قسم النقل', department: 'Transport Department', departmentAr: 'قسم النقل', reportsTo: 'Sherif Hegazy', scope: ['Transport operations'], scopeAr: ['عمليات النقل'], daliAccess: true, sentinelAccess: true, active: true },
  { id: 'genset-head', name: 'Yasmine Hegazy', role: 'Genset Department Head', roleAr: 'رئيس قسم المولدات', department: 'Genset Department', departmentAr: 'فرع المولدات', reportsTo: 'Sherif Hegazy', scope: ['Genset operations', 'Genset fleet status', 'Port coordination', 'Maintenance coordination', 'Workshop coordination'], scopeAr: ['عمليات المولدات', 'حالة أسطول المولدات', 'التنسيق بين الموانئ', 'تنسيق الصيانة', 'تنسيق الورشة'], daliAccess: true, sentinelAccess: true, active: true },
];

export const isDaliAllowedRole = (user?: Pick<User, 'role'> | null) =>
  user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

function fallbackNodeForUser(user: Pick<User, 'role' | 'department' | 'jobTitle'>): DaliOrgNode | null {
  const department = String(user.department || '').trim().toUpperCase();
  const title = String(user.jobTitle || '').trim().toUpperCase();
  if (department.includes('GENSET') || department.includes('مولد')) return FALLBACK_ORG_NODES.find(n => n.id === 'genset-head') || null;
  if (department.includes('TRANSPORT') || department.includes('نقل')) return FALLBACK_ORG_NODES.find(n => n.id === 'transport-head') || null;
  if (user.role === UserRole.ADMIN) return FALLBACK_ORG_NODES.find(n => n.id === 'ceo') || null;
  if (title.includes('GENSET')) return FALLBACK_ORG_NODES.find(n => n.id === 'genset-head') || null;
  return null;
}

export async function getDaliOrganizationNodes(): Promise<DaliOrgNode[]> {
  const { data, error } = await supabase
    .from('organization_structure')
    .select('id,user_id,employee_name,employee_name_ar,job_title,job_title_ar,department,department_ar,reports_to,assigned_ports,responsibilities,responsibilities_ar,dali_access,sentinel_access,active')
    .eq('active', true)
    .order('employee_name');

  if (error) {
    console.warn('DALI organization lookup failed; using safe fallback context:', error);
    return FALLBACK_ORG_NODES;
  }

  const rows = (data || []) as any[];
  const byId = new Map(rows.map(row => [String(row.id), row]));
  return rows.map(row => ({
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    name: String(row.employee_name || ''),
    nameAr: row.employee_name_ar ? String(row.employee_name_ar) : undefined,
    role: String(row.job_title || ''),
    roleAr: String(row.job_title_ar || row.job_title || ''),
    department: String(row.department || ''),
    departmentAr: String(row.department_ar || row.department || ''),
    reportsTo: row.reports_to
      ? String(row.reports_to)
      : (row.manager_id && byId.has(String(row.manager_id)) ? String(byId.get(String(row.manager_id))?.employee_name || '') : undefined),
    scope: Array.isArray(row.responsibilities) ? row.responsibilities.map(String) : [],
    scopeAr: Array.isArray(row.responsibilities_ar) ? row.responsibilities_ar.map(String) : [],
    assignedPorts: Array.isArray(row.assigned_ports) ? row.assigned_ports.map(String) : [],
    daliAccess: row.dali_access === true,
    sentinelAccess: row.sentinel_access === true,
    active: row.active !== false,
  }));
}

export async function buildDaliOrganizationContext(user: User, isArabic: boolean): Promise<string> {
  const nodes = await getDaliOrganizationNodes();
  const currentNode = (user.id && nodes.find(n => n.userId === user.id)) || fallbackNodeForUser(user);
  const hierarchy = nodes.map(node => {
    return node.name + ' — ' + (isArabic ? node.roleAr : node.role) + (node.reportsTo ? ' → reports to ' + node.reportsTo : '');
  }).join('\n');

  const userLines = [
    'CURRENT USER ROLE: ' + user.role,
    'CURRENT USER DEPARTMENT: ' + (user.department || 'Not specified'),
    'CURRENT USER JOB TITLE: ' + (user.jobTitle || 'Not specified'),
    'CURRENT USER ASSIGNED PORTS: ' + ((user.assignedPorts || []).join(', ') || 'Not specified'),
    'CURRENT USER DALI ACCESS: ' + (isDaliAllowedRole(user) ? 'ALLOWED' : 'DENIED'),
    'CURRENT USER SENTINEL ACCESS: ' + (isDaliAllowedRole(user) ? 'ALLOWED' : 'DENIED'),
  ];

  const genset = nodes.find(n =>
    n.department.toUpperCase().includes('GENSET') || n.departmentAr.includes('مولد')
  );

  return [
    'DALI ORGANIZATION CONTEXT',
    'Nile Fleet = أسطول النيل. DALI is specialized in the Genset Department (فرع المولدات).',
    'Use the Supabase organization structure as the authoritative company hierarchy. Never invent a reporting line, responsibility, access level, or assigned port that is not recorded in the organization structure or user profile.',
    'When asked who is responsible, identify the relevant department or role from this structure and clearly say when a specific person is not recorded.',
    'DALI and Sentinel access are restricted to ADMIN and MANAGER. Customers and other roles must not receive DALI or Sentinel access.',
    '',
    'CURRENT USER:', ...userLines,
    currentNode ? 'CURRENT USER ORGANIZATIONAL AREA: ' + currentNode.name + ' — ' + (isArabic ? currentNode.roleAr : currentNode.role) : 'CURRENT USER ORGANIZATIONAL AREA: Not explicitly mapped.',
    '',
    'RECORDED COMPANY HIERARCHY:', hierarchy || 'No active organization records are currently configured.',
    '',
    'GENSET DEPARTMENT SCOPE:', (isArabic ? (genset?.scopeAr || genset?.scope || []) : (genset?.scope || [])).join(', ') || 'Not specified in organization structure.',
  ].join('\n');
}
