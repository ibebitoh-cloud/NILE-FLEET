import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type OrgRow = {
  id:string; employee_name:string; employee_name_ar:string|null; job_title:string|null; job_title_ar:string|null;
  department:string|null; department_ar:string|null; reports_to:string|null; manager_id:string|null;
  assigned_ports:string[]|null; dali_access:boolean; sentinel_access:boolean; active:boolean;
};

const fallback: OrgRow[] = [
  {id:'ceo',employee_name:'Sherif Hegazy',employee_name_ar:'شريف حجازي',job_title:'COMPANY DIRECTOR',job_title_ar:'مدير الشركة',department:'Nile Fleet',department_ar:'أسطول النيل',reports_to:null,manager_id:null,assigned_ports:[],dali_access:true,sentinel_access:true,active:true},
  {id:'bebito',employee_name:'Bebito',employee_name_ar:'بيبيتو',job_title:'SYSTEM DIRECTOR',job_title_ar:'مدير النظام',department:'NILE FLEET COMMAND',department_ar:'قيادة أسطول النيل',reports_to:'Sherif Hegazy',manager_id:null,assigned_ports:[],dali_access:true,sentinel_access:true,active:true},
  {id:'transport',employee_name:'Samar Hegazy',employee_name_ar:'سمر حجازي',job_title:'TRANSPORT DEPARTMENT HEAD',job_title_ar:'رئيس قسم النقل',department:'Transport',department_ar:'قسم النقل',reports_to:'Sherif Hegazy',manager_id:null,assigned_ports:[],dali_access:true,sentinel_access:true,active:true},
  {id:'genset-head',employee_name:'Yasmine Hegazy',employee_name_ar:'ياسمين حجازي',job_title:'GENSET DEPARTMENT HEAD',job_title_ar:'رئيسة قسم المولدات',department:'Genset Department',department_ar:'قسم المولدات',reports_to:'Sherif Hegazy',manager_id:null,assigned_ports:[],dali_access:true,sentinel_access:true,active:true},
  {id:'genset-manager',employee_name:'Eslam',employee_name_ar:'إسلام',job_title:'GENSET DEPARTMENT MANAGER',job_title_ar:'مدير قسم المولدات',department:'Genset Department',department_ar:'قسم المولدات',reports_to:null,manager_id:null,assigned_ports:[],dali_access:true,sentinel_access:true,active:true},
  {id:'maintenance',employee_name:'Nasr',employee_name_ar:'نصر',job_title:'HEAD OF MAINTENANCE',job_title_ar:'رئيس الصيانة',department:'Maintenance / Workshop',department_ar:'الصيانة / الورشة',reports_to:null,manager_id:null,assigned_ports:[],dali_access:false,sentinel_access:false,active:true}
];

const Card:React.FC<{row:OrgRow; ar:boolean; featured?:boolean}> = ({row,ar,featured}) => {
  const name=ar?(row.employee_name_ar||row.employee_name):row.employee_name;
  const title=ar?(row.job_title_ar||row.job_title||''):row.job_title||'';
  const dept=ar?(row.department_ar||row.department||''):row.department||'';
  return <div className={'group relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl '+(featured?'border-[#C2A378]/70 bg-[#C2A378]/10 shadow-[0_0_45px_rgba(194,163,120,.12)]':'border-white/10 bg-white/[.045]')}>
    <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[#C2A378]/10 blur-2xl transition-all group-hover:bg-[#C2A378]/20"/>
    <div className="relative flex items-start justify-between gap-3">
      <div><div className="text-[10px] font-black tracking-[.25em] uppercase text-[#C2A378]">{dept}</div><div className="mt-2 text-xl font-black text-white">{name}</div><div className="mt-1 text-xs font-bold text-slate-300">{title}</div></div>
      <div className="flex gap-1">{row.dali_access&&<span title={ar?'دالي':'DALI'} className="rounded-full border border-[#C2A378]/30 bg-[#C2A378]/10 px-2 py-1 text-[8px] font-black text-[#C2A378]">D</span>}{row.sentinel_access&&<span title={ar?'المراقبة':'Sentinel'} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] font-black text-emerald-300">S</span>}</div>
    </div>
  </div>;
};

const Organization:React.FC=()=>{
 const ar=document.documentElement.lang==='ar';
 const [rows,setRows]=useState<OrgRow[]>([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{const {data,error}=await supabase.from('organization_structure').select('id,employee_name,employee_name_ar,job_title,job_title_ar,department,department_ar,reports_to,manager_id,assigned_ports,dali_access,sentinel_access,active').eq('active',true);if(live)setRows(error||!data?fallback:data as OrgRow[]);setLoading(false)})();return()=>{live=false}},[]);
 const byDept=useMemo(()=>{const map=new Map<string,OrgRow[]>();rows.forEach(r=>{const key=ar?(r.department_ar||r.department||'أخرى'):(r.department||'Other');if(!map.has(key))map.set(key,[]);map.get(key)!.push(r)});return map},[rows,ar]);
 const ceo=rows.find(r=>r.employee_name==='Sherif Hegazy')||fallback[0];
 const direct=rows.filter(r=>r.employee_name!=='Sherif Hegazy' && r.reports_to==='Sherif Hegazy');
 return <div dir={ar?'rtl':'ltr'} className="min-h-full pb-10">
   <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
     <div><div className="text-[9px] font-black uppercase tracking-[.35em] text-[#C2A378]">{ar?'خريطة القيادة':'ORGANIZATION MAP'}</div><h1 className="mt-2 text-3xl font-black text-white">{ar?'الهيكل التنظيمي':'Organization Structure'}</h1><p className="mt-1 max-w-2xl text-xs font-medium text-slate-400">{ar?'هيكل أسطول النيل ومواقع المسؤولية، مع طبقة دالي والرقابة منفصلة عن الهيكل الإداري.':'Nile Fleet leadership and responsibility map. DALI and Sentinel are intelligence layers, not people in the hierarchy.'}</p></div>
     <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{loading?(ar?'جاري التحميل…':'LOADING…'):(ar?rows.length+' أفراد مسجلين':rows.length+' ACTIVE PEOPLE')}</div>
   </div>
   <div className="mx-auto max-w-md"><Card row={ceo} ar={ar} featured/></div>
   <div className="mx-auto my-4 h-8 w-px bg-gradient-to-b from-[#C2A378]/70 to-white/10"/>
   <div className="grid gap-4 md:grid-cols-3">{direct.map(r=><Card key={r.id} row={r} ar={ar}/>)}</div>
   <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"/>
   <div className="grid gap-5 lg:grid-cols-3">{Array.from(byDept.entries()).filter(([k])=>k!==(ar?ceo.department_ar:ceo.department)).map(([dept,people])=><section key={dept} className="rounded-3xl border border-white/10 bg-black/10 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-white">{dept}</h2><span className="text-[8px] font-black text-[#C2A378]">{people.length}</span></div><div className="space-y-3">{people.filter(p=>!direct.some(d=>d.id===p.id)).map(p=><Card key={p.id} row={p} ar={ar}/>)}</div></section>)}</div>
   <div className="mt-8 grid gap-4 md:grid-cols-2">
    <div className="rounded-3xl border border-[#C2A378]/20 bg-[#C2A378]/5 p-5"><div className="text-[9px] font-black uppercase tracking-[.3em] text-[#C2A378]">DALI</div><div className="mt-2 text-lg font-black text-white">{ar?'طبقة ذكاء المولدات':'Genset Intelligence Layer'}</div><p className="mt-1 text-xs text-slate-400">{ar?'دالي يستخدم هذا الهيكل لفهم المسؤوليات والصلاحيات ولا يظهر كشخص في الشجرة.':'DALI uses this map to understand responsibility and access. It is not an employee in the tree.'}</p></div>
    <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-5"><div className="text-[9px] font-black uppercase tracking-[.3em] text-emerald-300">SENTINEL</div><div className="mt-2 text-lg font-black text-white">{ar?'طبقة المراقبة':'Monitoring Layer'}</div><p className="mt-1 text-xs text-slate-400">{ar?'يراقب التعارضات والتنبيهات التشغيلية دون أن يصبح جزءًا من الهيكل الإداري.':'Monitors operational conflicts and alerts without becoming part of the management hierarchy.'}</p></div>
   </div>
 </div>;
};
export default Organization;
