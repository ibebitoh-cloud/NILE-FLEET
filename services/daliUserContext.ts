import { User, UserRole } from '../types';
import type { DaliAlertScope } from './daliAlerts';

/**
 * Tailors DALI to the signed-in user: which alerts they see, which questions DALI
 * suggests, and how it reads vague questions such as "my stock". Based on the
 * department and assigned ports in the user's profile; users without them see
 * the whole company, as before.
 */

type Area = 'genset' | 'transport' | 'maintenance' | 'finance' | 'all';

export function daliAreaForUser(user: Pick<User, 'role' | 'department' | 'jobTitle'>, isCreator = false): Area {
  if (isCreator) return 'all';
  const text = `${user.department || ''} ${user.jobTitle || ''}`.toUpperCase();
  if (/MAINTENANCE|WORKSHOP|صيان|ورش/.test(text)) return 'maintenance';
  if (/GENSET|مولد/.test(text)) return 'genset';
  if (/TRANSPORT|TRUCK|نقل/.test(text)) return 'transport';
  if (/FINANC|ACCOUNT|BILLING|مالي|حساب/.test(text)) return 'finance';
  return 'all';
}

export function daliAlertScopeForUser(user: User, isCreator = false): DaliAlertScope {
  const area = daliAreaForUser(user, isCreator);
  const ports = isCreator ? [] : (user.assignedPorts || []).map(String);
  const topics: DaliAlertScope['topics'] =
    area === 'genset' ? ['maintenance', 'requests', 'stock']
    : area === 'maintenance' ? ['maintenance']
    : area === 'transport' ? ['requests']
    : area === 'finance' ? ['invoices']
    : user.role === UserRole.ADMIN || isCreator ? [] : ['maintenance', 'requests', 'stock', 'invoices'];
  return { ports, topics };
}

export function daliSuggestionsForUser(user: User, ar: boolean, isCreator = false): string[] | null {
  const area = daliAreaForUser(user, isCreator);
  const ports = isCreator ? [] : (user.assignedPorts || []).map(String);
  const at = ports.length ? (ar ? ` في ${ports.join(' و')}` : ` at ${ports.join(' and ')}`) : '';
  if (area === 'genset') return ar
    ? [`المخزون${at}`, `طلبات النهارده وبكرة${at}`, 'المولدات اللي فات موعد صيانتها']
    : [`Stock${at}`, `Today's and tomorrow's requests${at}`, 'Which gensets are past their next service date?'];
  if (area === 'maintenance') return ar
    ? ['المولدات اللي في الصيانة', 'المولدات اللي فات موعد صيانتها', 'سجل صيانة لمولد']
    : ['Which gensets are in maintenance?', 'Which gensets are past their next service date?', 'Log maintenance for a genset'];
  if (area === 'transport') return ar
    ? [`طلبات النهارده وبكرة${at}`, 'الطلبات اللي مستنية الموافقة', 'عمليات النهارده']
    : [`Today's and tomorrow's requests${at}`, 'Which requests are still waiting for approval?', "Show today's operations"];
  if (area === 'finance') return ar
    ? ['الفواتير المتأخرة السداد', 'إجمالي المستحقات', 'مدفوعات الشهر ده']
    : ['Which invoices are overdue?', 'Total outstanding balance', 'Payments this month'];
  return ports.length ? (ar ? [`المخزون${at}`, `طلبات النهارده${at}`, 'أي تنبيهات؟'] : [`Stock${at}`, `Today's requests${at}`, 'Any alerts?']) : null;
}

/** One prompt line so the model reads "my port", "my stock", "my team" correctly. */
export function daliUserFocusLine(user: User, isCreator = false): string {
  const area = daliAreaForUser(user, isCreator);
  const ports = isCreator ? [] : (user.assignedPorts || []).map(String);
  if (area === 'all' && !ports.length) return 'USER FOCUS: whole company.';
  return `USER FOCUS: ${area === 'all' ? 'whole company' : area} area${ports.length ? `, assigned ports ${ports.join(', ')}` : ''}. When a question is vague ("my stock", "my port", "our requests", "عندي", "بتاعتي"), answer for this area and these ports first and say so; when the user names another port or area, answer for that instead. Never hide company-wide facts the user's role is allowed to see.`;
}
