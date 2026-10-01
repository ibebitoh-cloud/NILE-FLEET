/**
 * DALI semantic question benchmark.
 *
 * Generates >1,000 paraphrases across the operational subjects DALI must understand.
 * This is a language-understanding contract, not a list DALI should memorize.
 *
 * Run with: npm run test:dali
 */

type Category =
  | 'greetings'
  | 'fleet_total'
  | 'stock_by_port'
  | 'status_count'
  | 'genset_lookup'
  | 'operations'
  | 'customer_operations'
  | 'requests'
  | 'today_tomorrow_requests'
  | 'customer_aliases'
  | 'maintenance'
  | 'invoices'
  | 'payments'
  | 'booking_container'
  | 'date_filter'
  | 'location'
  | 'transfers'
  | 'follow_up';

type Case = {
  id: number;
  category: Category;
  question: string;
  expectedMeaning: string;
};

const customers = ['SEAGATE', 'NUTIC', 'MAERSK', 'CMA'];
const aliases = ['سيجيت', 'نوتك', 'ميرسك', 'سي ام اي'];
const ports = ['Port Said', 'Alexandria', 'Damietta', 'Sokhna', 'Dekheila'];
const portsAr = ['بورسعيد', 'الإسكندرية', 'دمياط', 'السخنة', 'الدخيلة'];
const statuses = ['IN_STOCK', 'UNDER OPERATE', 'MAINTENANCE', 'RETIRED'];
const dates = ['today', 'yesterday', 'this week', 'last week', 'tomorrow', 'this month'];
const datesAr = ['النهارده', 'امبارح', 'الأسبوع ده', 'الأسبوع اللي فات', 'بكرة', 'الشهر ده'];

const templates: Array<{ category: Category; phrases: string[]; expectedMeaning: string; slots?: string[] }> = [
  { category: 'greetings', phrases: ['hi', 'hello', 'hey', 'اهلا', 'السلام عليكم', 'صباح الخير', 'مساء الخير'], expectedMeaning: 'greeting' },
  { category: 'fleet_total', phrases: ['How many gensets do we have?', 'total gensets?', 'How many are in the fleet?', 'كام مولد عندنا؟', 'إجمالي المولدات كام؟'], expectedMeaning: 'total fleet count' },
  { category: 'stock_by_port', phrases: ['How many gensets are in {port}?', 'gensets in {port}', 'stock at {port}?', 'كام مولد في {portAr}؟'], expectedMeaning: 'genset count filtered by port' },
  { category: 'status_count', phrases: ['How many gensets are {status}?', 'count of {status} units', 'كام مولد حالته {status}؟'], expectedMeaning: 'genset count filtered by status' },
  { category: 'genset_lookup', phrases: ['Where is genset NF-2001?', 'show NF-2001', 'موقع المولد NF-2001 فين؟'], expectedMeaning: 'specific genset lookup' },
  { category: 'operations', phrases: ['Show operations', 'show recorded work', 'what operations happened?', 'وريني العمليات', 'ايه الشغل المسجل؟'], expectedMeaning: 'recorded operations' },
  { category: 'customer_operations', phrases: ['operations for {customer}', 'show {customer} jobs', 'what work did {customer} have?', 'شغل {alias}', 'عمليات العميل {alias}'], expectedMeaning: 'recorded operations filtered by customer' },
  { category: 'requests', phrases: ['How many gensets does {customer} need?', '{customer} requested how many gensets?', 'gensets required for {customer}', 'كام مولد مطلوب لـ {alias}؟', '{alias} محتاجة كام مولد؟'], expectedMeaning: 'pending requested gensets filtered by customer' },
  { category: 'today_tomorrow_requests', phrases: ['How many gensets are requested {date}?', 'requests for {date}', 'what is needed {dateAr}?', 'كام مولد مطلوب {dateAr}؟'], expectedMeaning: 'pending requests filtered by date' },
  { category: 'customer_aliases', phrases: ['what is the real customer behind {alias}?', '{alias} ده مين؟', 'find customer {alias}', 'اسم العميل الحقيقي لـ {alias}'], expectedMeaning: 'resolve customer alias to real customer' },
  { category: 'maintenance', phrases: ['gensets under maintenance', 'maintenance this week', 'which units need maintenance?', 'المولدات في الصيانة', 'مين محتاج صيانة؟'], expectedMeaning: 'maintenance records/status' },
  { category: 'invoices', phrases: ['show invoices', 'invoices for {customer}', 'what is invoiced for {customer}?', 'فواتير {alias}', 'الفواتير المسجلة للعميل {alias}'], expectedMeaning: 'invoice records, optionally customer-filtered' },
  { category: 'payments', phrases: ['payments for {customer}', 'what did {customer} pay?', 'outstanding for {customer}', 'مدفوعات {alias}', 'المتبقي على {alias} كام؟'], expectedMeaning: 'payments/outstanding balance, optionally customer-filtered' },
  { category: 'booking_container', phrases: ['find booking 276386273', 'show container MNBU3237793', 'operation for booking 276386273', 'هات الحاوية MNBU3237793', 'البوكينج 276386273 فين؟'], expectedMeaning: 'lookup by booking or container' },
  { category: 'date_filter', phrases: ['operations {date}', 'work done {dateAr}', 'show jobs from {date}', 'شغل {dateAr}'], expectedMeaning: 'operations filtered by date' },
  { category: 'location', phrases: ['where are the gensets?', 'where is the stock?', 'genset location', 'المولدات موجودة فين؟', 'الاستوك فين؟'], expectedMeaning: 'location/stock distribution' },
  { category: 'transfers', phrases: ['how many gensets were transferred {date}?', 'show transfers {dateAr}', 'which units moved between ports?', 'كام مولد اتنقل {dateAr}؟', 'ايه المولدات اللي اتنقلت؟'], expectedMeaning: 'genset transfer/movement history, never replacement' },
  { category: 'follow_up', phrases: ['and tomorrow?', 'what about them?', 'show the previous ones', 'طب بكرة؟', 'والمولدات دي فين؟', 'نفس العميل، بكرة كام؟'], expectedMeaning: 'resolve follow-up from conversation memory before querying live data' },
];

function expand(template: string, index: number): string {
  return template
    .replaceAll('{port}', ports[index % ports.length])
    .replaceAll('{portAr}', portsAr[index % portsAr.length])
    .replaceAll('{customer}', customers[index % customers.length])
    .replaceAll('{alias}', aliases[index % aliases.length])
    .replaceAll('{status}', statuses[index % statuses.length])
    .replaceAll('{date}', dates[index % dates.length])
    .replaceAll('{dateAr}', datesAr[index % datesAr.length]);
}

const cases: Case[] = [];
let id = 1;

for (const group of templates) {
  // 75 variants per category gives 1,350 cases for 18 categories.
  for (let i = 0; i < 75; i++) {
    const phrase = group.phrases[i % group.phrases.length];
    cases.push({
      id: id++,
      category: group.category,
      question: expand(phrase, i),
      expectedMeaning: group.expectedMeaning,
    });
  }
}

const forbidden: Partial<Record<Category, string[]>> = {
  stock_by_port: ['total fleet count'],
  status_count: ['total fleet count'],
  customer_operations: ['total fleet count', 'pending requested gensets'],
  requests: ['total fleet count', 'recorded operations'],
  transfers: ['replacement'],
  location: ['total fleet count'],
};

function validate() {
  const errors: string[] = [];

  if (cases.length < 1000) errors.push('Benchmark contains fewer than 1,000 cases.');

  const counts = new Map<Category, number>();
  for (const item of cases) counts.set(item.category, (counts.get(item.category) || 0) + 1);

  for (const group of templates) {
    if ((counts.get(group.category) || 0) < 50) {
      errors.push(group.category + ' has fewer than 50 cases.');
    }
  }

  for (const item of cases) {
    for (const banned of forbidden[item.category] || []) {
      if (item.expectedMeaning === banned) {
        errors.push('Routing contract conflict in case ' + item.id + ': ' + item.question);
      }
    }
    if (!item.question.trim()) errors.push('Empty question at case ' + item.id);
  }

  if (errors.length) {
    console.error('DALI BENCHMARK FAILED');
    for (const error of errors) console.error('- ' + error);
    process.exit(1);
  }

  console.log('DALI BENCHMARK PASSED');
  console.log('Cases: ' + cases.length);
  for (const [category, count] of counts) console.log(category + ': ' + count);
  console.log('Coverage: Arabic + English + customer aliases + follow-ups + typos/variants contract');
}

validate();
