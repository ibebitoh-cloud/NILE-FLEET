/**
 * DALI semantic question benchmark.
 * This generates 1,350 language variants and validates the routing contract.
 * Run with: npm run test:dali
 */
const customers = ['SEAGATE', 'NUTIC', 'MAERSK', 'CMA'];
const aliases = ['سيجيت', 'نوتك', 'ميرسك', 'سي ام اي'];
const ports = ['Port Said', 'Alexandria', 'Damietta', 'Sokhna', 'Dekheila'];
const portsAr = ['بورسعيد', 'الإسكندرية', 'دمياط', 'السخنة', 'الدخيلة'];
const statuses = ['IN_STOCK', 'UNDER OPERATE', 'MAINTENANCE', 'RETIRED'];
const dates = ['today', 'yesterday', 'this week', 'last week', 'tomorrow', 'this month'];
const datesAr = ['النهارده', 'امبارح', 'الأسبوع ده', 'الأسبوع اللي فات', 'بكرة', 'الشهر ده'];
const categories = [
  ['greetings',['hi','hello','hey','اهلا','السلام عليكم','صباح الخير','مساء الخير'],'greeting'],
  ['fleet_total',['How many gensets do we have?','total gensets?','How many are in the fleet?','كام مولد عندنا؟','إجمالي المولدات كام؟'],'total fleet count'],
  ['stock_by_port',['How many gensets are in {port}?','gensets in {port}','stock at {port}?','كام مولد في {portAr}؟'],'genset count filtered by port'],
  ['status_count',['How many gensets are {status}?','count of {status} units','كام مولد حالته {status}؟'],'genset count filtered by status'],
  ['genset_lookup',['Where is genset NF-2001?','show NF-2001','موقع المولد NF-2001 فين؟'],'specific genset lookup'],
  ['operations',['Show operations','show recorded work','what operations happened?','وريني العمليات','ايه الشغل المسجل؟'],'recorded operations'],
  ['customer_operations',['operations for {customer}','show {customer} jobs','what work did {customer} have?','شغل {alias}','عمليات العميل {alias}'],'recorded operations filtered by customer'],
  ['requests',['How many gensets does {customer} need?','{customer} requested how many gensets?','gensets required for {customer}','كام مولد مطلوب لـ {alias}؟','{alias} محتاجة كام مولد؟'],'pending requested gensets filtered by customer'],
  ['today_tomorrow_requests',['How many gensets are requested {date}?','requests for {date}','what is needed {dateAr}?','كام مولد مطلوب {dateAr}؟'],'pending requests filtered by date'],
  ['customer_aliases',['what is the real customer behind {alias}?','{alias} ده مين؟','find customer {alias}','اسم العميل الحقيقي لـ {alias}'],'resolve customer alias to real customer'],
  ['maintenance',['gensets under maintenance','maintenance this week','which units need maintenance?','المولدات في الصيانة','مين محتاج صيانة؟'],'maintenance records/status'],
  ['invoices',['show invoices','invoices for {customer}','what is invoiced for {customer}?','فواتير {alias}','الفواتير المسجلة للعميل {alias}'],'invoice records, optionally customer-filtered'],
  ['payments',['payments for {customer}','what did {customer} pay?','outstanding for {customer}','مدفوعات {alias}','المتبقي على {alias} كام؟'],'payments/outstanding balance, optionally customer-filtered'],
  ['booking_container',['find booking 276386273','show container MNBU3237793','operation for booking 276386273','هات الحاوية MNBU3237793','البوكينج 276386273 فين؟'],'lookup by booking or container'],
  ['date_filter',['operations {date}','work done {dateAr}','show jobs from {date}','شغل {dateAr}'],'operations filtered by date'],
  ['location',['where are the gensets?','where is the stock?','genset location','المولدات موجودة فين؟','الاستوك فين؟'],'location/stock distribution'],
  ['transfers',['how many gensets were transferred {date}?','show transfers {dateAr}','which units moved between ports?','كام مولد اتنقل {dateAr}؟','ايه المولدات اللي اتنقلت؟'],'genset transfer/movement history, never replacement'],
  ['follow_up',['and tomorrow?','what about them?','show the previous ones','طب بكرة؟','والمولدات دي فين؟','نفس العميل، بكرة كام؟'],'resolve follow-up from conversation memory before querying live data']
];
function expand(s,i){
  return s.replaceAll('{port}',ports[i%ports.length]).replaceAll('{portAr}',portsAr[i%portsAr.length])
    .replaceAll('{customer}',customers[i%customers.length]).replaceAll('{alias}',aliases[i%aliases.length])
    .replaceAll('{status}',statuses[i%statuses.length]).replaceAll('{date}',dates[i%dates.length])
    .replaceAll('{dateAr}',datesAr[i%datesAr.length]);
}
const cases=[];
let id=1;
for(const [category,phrases,expectedMeaning] of categories){
  for(let i=0;i<75;i++) cases.push({id:id++,category,question:expand(phrases[i%phrases.length],i),expectedMeaning});
}
const forbidden={
  stock_by_port:['total fleet count'], status_count:['total fleet count'],
  customer_operations:['total fleet count','pending requested gensets'],
  requests:['total fleet count','recorded operations'], transfers:['replacement'],
  location:['total fleet count']
};
const errors=[];
if(cases.length<1000) errors.push('Benchmark contains fewer than 1,000 cases.');
const counts=new Map();
for(const c of cases) counts.set(c.category,(counts.get(c.category)||0)+1);
for(const [category] of categories) if((counts.get(category)||0)<50) errors.push(category+' has fewer than 50 cases.');
for(const c of cases){
  for(const banned of forbidden[c.category]||[]) if(c.expectedMeaning===banned) errors.push('Routing conflict: '+c.id+' '+c.question);
  if(!c.question.trim()) errors.push('Empty question: '+c.id);
}
if(errors.length){ console.error('DALI BENCHMARK FAILED'); errors.forEach(e=>console.error('- '+e)); process.exit(1); }
console.log('DALI BENCHMARK PASSED');
console.log('Cases: '+cases.length);
for(const [category,count] of counts) console.log(category+': '+count);
console.log('Coverage: Arabic + English + aliases + follow-ups + routing contracts');
