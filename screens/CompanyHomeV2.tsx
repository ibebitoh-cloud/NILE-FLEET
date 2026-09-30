import React, { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../App';

interface Props { onGenset: () => void; }

const CompanyHomeV2: React.FC<Props> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const ar = lang === 'ar';
  const [p, setP] = useState({x:0,y:0});
  const [scroll, setScroll] = useState(0);\n  const assembly = Math.min(1, Math.max(0, scroll / 850));\n  const eased = assembly * assembly * (3 - 2 * assembly);

  useEffect(() => {
    const move=(e:MouseEvent)=>setP({x:(e.clientX/window.innerWidth-.5)*2,y:(e.clientY/window.innerHeight-.5)*2});
    const scr=()=>setScroll(window.scrollY);
    window.addEventListener('mousemove',move,{passive:true});
    window.addEventListener('scroll',scr,{passive:true});
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('scroll',scr)};
  },[]);

  return <div dir={ar?'rtl':'ltr'} className="relative min-h-screen overflow-x-hidden bg-[#020509] text-white">
    <style>{`
      @keyframes roadMove{from{transform:translateX(0)}to{transform:translateX(-120px)}}
      @keyframes truckDrive{0%{transform:translateX(-18vw)}45%{transform:translateX(28vw)}100%{transform:translateX(120vw)}}
      @keyframes lightSweep{0%,100%{opacity:0;transform:translateX(-30%)}12%{opacity:.5}28%{opacity:0;transform:translateX(110%)}}
      @keyframes glitch{0%,91%,100%{opacity:0}92%{opacity:.7;transform:translateX(-18px)}94%{opacity:.18;transform:translateX(14px)}96%{opacity:.45;transform:translateX(-5px)}}
      @keyframes flash{0%,87%,94%,100%{opacity:0}89%{opacity:.24}91%{opacity:.03}}
      .nf-road{animation:roadMove 1.2s linear infinite}.nf-truck{animation:truckDrive 13s linear infinite}.nf-glitch{animation:glitch 5s steps(1) infinite}.nf-flash{animation:flash 7s steps(1) infinite}.nf-light{animation:lightSweep 6s ease-in-out infinite}
    `}</style>

    <style>{`
      @keyframes bpScan{0%{transform:translateY(-100%);opacity:0}15%{opacity:.8}100%{transform:translateY(100%);opacity:0}}
      @keyframes bpPulse{0%,100%{opacity:.18}50%{opacity:.55}}
      @keyframes bpDash{to{stroke-dashoffset:-80}}
      @keyframes bpOrbit{to{transform:rotate(360deg)}}
      .bp-scan{animation:bpScan 7s linear infinite}.bp-pulse{animation:bpPulse 3s ease-in-out infinite}.bp-dash{animation:bpDash 3s linear infinite}.bp-orbit{transform-box:fill-box;transform-origin:center;animation:bpOrbit 18s linear infinite}
    `}</style>

    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020b18]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(45,175,255,.075)_1px,transparent_1px),linear-gradient(90deg,rgba(45,175,255,.075)_1px,transparent_1px)] bg-[size:36px_36px]"/>
      <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_50%_42%,rgba(25,160,255,.20),transparent_48%),linear-gradient(180deg,#03182a,#020b18_60%,#01050b)]"/>
      <div className="absolute inset-0 opacity-25 bg-[repeating-linear-gradient(0deg,transparent 0,transparent 5px,rgba(100,205,255,.06) 6px)]"/>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
        <defs>
          <filter id="bpGlow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="bpLine" x1="0" x2="1"><stop offset="0" stopColor="rgba(40,180,255,.08)"/><stop offset=".5" stopColor="rgba(110,220,255,.8)"/><stop offset="1" stopColor="rgba(40,180,255,.08)"/></linearGradient>
        </defs>
        <g fill="none" stroke="rgba(74,193,255,.25)" strokeWidth="1">
          <path d="M70 735H1530M70 770H1530M70 805H1530"/>
          <path d="M120 120V820M250 120V820M1350 120V820M1480 120V820"/>
          <circle cx="180" cy="190" r="95"/><circle cx="180" cy="190" r="70"/>
          <circle cx="1410" cy="210" r="125"/><circle cx="1410" cy="210" r="92"/>
        </g>
        <g className="bp-pulse" fill="none" stroke="rgba(90,205,255,.58)" strokeWidth="1.5">
          <path d="M190 650L350 490L610 490L760 610L1120 610L1270 510L1460 510"/>
          <path d="M350 490L430 365L700 365L760 610"/><path d="M1270 510L1320 350L1450 350"/>
        </g>
        <g fontFamily="monospace" fill="rgba(104,211,255,.68)" fontSize="14">
          <text x="90" y="105">NILE FLEET // TRANSPORT ENGINEERING</text>
          <text x="92" y="125">LIVE ASSEMBLY PROTOCOL // SCROLL TO BUILD</text>
          <text x="345" y="330">CAB MODULE</text><text x="670" y="330">POWER UNIT</text><text x="1080" y="575">CHASSIS</text><text x="1180" y="750">WHEEL SYSTEM</text>
          <text x="90" y="850">TECHNICAL BLUEPRINT / INTERACTIVE VEHICLE ASSEMBLY</text>
        </g>
        <g fill="none" stroke="rgba(94,210,255,.82)" strokeWidth="2" filter="url(#bpGlow)" strokeLinecap="round" strokeLinejoin="round">
          <g style={{transform:`translate(${-230 + 230*eased}px,${-95 + 95*eased}px)`}}>
            <path d="M300 610H570V470H665L735 525V610H780"/><path d="M570 470V610M665 470V525M570 520H665"/><path d="M600 485H655L700 520H600Z" opacity=".55"/><path d="M330 610V570H535V610"/>
          </g>
          <g style={{transform:`translate(${-190 + 190*eased}px,${-155 + 155*eased}px)`}}>
            <path d="M690 560H1090V610H690Z"/><path d="M735 560V525H1015V560M790 525V495H955V525"/><path d="M710 580H1070" strokeDasharray="10 12" className="bp-dash"/>
          </g>
          <g style={{transform:`translate(${210 - 210*eased}px,${-100 + 100*eased}px)`}}>
            <path d="M1080 610H1390L1470 660V700H1080Z"/><path d="M1140 610V700M1310 610V700"/>
          </g>
          <g style={{transform:`translate(${-160 + 160*eased}px,${120 - 120*eased}px)`}}>
            <circle cx="430" cy="675" r="48"/><circle cx="430" cy="675" r="18"/><circle cx="1010" cy="675" r="48"/><circle cx="1010" cy="675" r="18"/><circle cx="1320" cy="675" r="48"/><circle cx="1320" cy="675" r="18"/>
          </g>
        </g>
        <g className="bp-orbit" fill="none" stroke="rgba(86,210,255,.28)" strokeWidth="1" strokeDasharray="5 10"><ellipse cx="800" cy="560" rx="560" ry="205"/></g>
        <g stroke="url(#bpLine)" strokeWidth="2" opacity=".8"><path className="bp-scan" d="M0 260H1600"/></g>
        <g fill="rgba(100,215,255,.8)" fontFamily="monospace" fontSize="11"><text x="1030" y="455">01 // CAB</text><text x="780" y="445">02 // ENGINE</text><text x="1260" y="470">03 // FRAME</text><text x="350" y="760">04 // AXLES</text></g>
      </svg>
      <div className="absolute left-[6%] top-[17%] h-24 w-24 rounded-full border border-cyan-300/25 shadow-[0_0_50px_rgba(40,180,255,.16)]"/>
      <div className="absolute right-[7%] top-[24%] h-36 w-36 rounded-full border border-cyan-300/20"/>
      <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/10"/>
      <div className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-[#01050b] via-transparent to-transparent"/>
      <div className="bp-scan absolute left-0 right-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-cyan-300/[.07] to-transparent"/>
    </div>


    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet"/><div><div className="text-lg font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><div className="text-[8px] font-bold uppercase tracking-[.3em] text-slate-400">{ar?'خدمات النقل واللوجستيات':'Transport & Logistics Service'}</div></div></div>
        <div className="flex items-center gap-5"><nav className="hidden gap-7 text-[10px] font-black uppercase tracking-[.2em] text-slate-300 md:flex"><a href="#about">{ar?'عن الشركة':'About'}</a><a href="#operations">{ar?'العمليات':'Operations'}</a><a href="#leadership">{ar?'الإدارة':'Leadership'}</a><a href="#contact">{ar?'اتصل بنا':'Contact'}</a></nav><button onClick={()=>setLang(ar?'en':'ar')} className="rounded-lg border border-[#C2A378]/30 px-3 py-2 text-[9px] font-black uppercase text-[#C2A378]">{ar?'EN':'العربية'}</button></div>
      </div>
    </header>

    <main className="relative z-10">
      <section className="relative min-h-[90vh] overflow-hidden border-b border-white/10">
        <div className="mx-auto flex min-h-[90vh] max-w-7xl items-center px-5 py-24 lg:px-8">
          <div className="max-w-5xl"><p className="mb-5 text-[10px] font-black uppercase tracking-[.45em] text-[#C2A378]">{ar?'منذ 2009 · مصر':'Since 2009 · Egypt'}</p><h1 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[7rem]">{ar?'نحرّك البضائع.':'Moving cargo.'}<br/><span className="text-[#C2A378]">{ar?'نحرّك الأعمال.':'Moving business.'}</span></h1><p className="mt-9 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{ar?'نيل فليت لخدمات النقل واللوجستيات تقدم حلولاً موثوقة لنقل الشاحنات والحاويات والخدمات اللوجستية المتكاملة في جميع أنحاء مصر.':'Nile Fleet for Transport and Logistics Service delivers reliable trucking, container transportation, and integrated logistics solutions across Egypt.'}</p><div className="mt-8 h-px w-32 bg-[#C2A378]"/><p className="mt-6 max-w-2xl text-xs font-semibold leading-7 text-slate-400">{ar?'أكثر من 17 عاماً من الخبرة في إدارة الأسطول وعمليات الموانئ ودعم سلاسل الإمداد، مع التركيز على السلامة والالتزام بالمواعيد والرؤية التشغيلية.':'More than 17 years of experience across fleet management, port logistics operations, and supply-chain support, focused on safety, on-time execution, and operational visibility.'}</p></div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar?'عن نيل فليت':'About Nile Fleet'}</p><h2 className="mt-4 whitespace-pre-line text-4xl font-black uppercase italic sm:text-5xl">{ar?'صُممت للطريق.\nومرتبطة بالميناء.':'Built for the road.\nConnected to the port.'}</h2></div><div className="text-sm leading-8 text-slate-300 sm:text-base">{ar?'نيل فليت لخدمات النقل واللوجستيات هي إحدى شركات النقل والخدمات اللوجستية في مصر، وتقدم خدمات موثوقة لنقل الشاحنات والحاويات والحلول اللوجستية المتكاملة منذ عام 2009. وبخبرة تتجاوز 17 عاماً، تدعم الشركة الأعمال في مختلف أنحاء مصر من خلال ضمان نقل البضائع بأمان وفي الوقت المحدد مع توفير رؤية تشغيلية واضحة.':'Nile Fleet for Transport and Logistics Service is one of Egypt’s leading transportation and logistics providers, offering reliable trucking, container transportation, and integrated logistics solutions since 2009. With more than 17 years of industry experience, the company supports businesses across Egypt by ensuring cargo moves safely, on time, and with full operational visibility.'}<br/><br/>{ar?'تخدم نيل فليت الخطوط الملاحية ووكلاء الشحن والمستوردين والمصدرين والعملاء الصناعيين من خلال إدارة الأسطول وعمليات الموانئ والدعم اللوجستي لسلاسل الإمداد.':'Nile Fleet serves shipping lines, freight forwarders, importers, exporters, and industrial clients through fleet management, port logistics operations, and supply-chain support.'}</div></div><div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[ar?'2009':'2009',ar?'التأسيس':'Founded'],[ar?'17+':'17+',ar?'عاماً من الخبرة':'Years Experience'],[ar?'مصر':'Egypt',ar?'عمليات على مستوى الجمهورية':'Nationwide Operations'],[ar?'24/7':'24/7',ar?'تركيز تشغيلي':'Operational Focus']].map(([v,l])=><div key={l} className="rounded-2xl border border-white/10 bg-white/[.035] p-7 backdrop-blur-sm"><div className="text-3xl font-black text-[#C2A378]">{v}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-slate-400">{l}</div></div>)}</div></section>

      <section className="border-y border-white/10 bg-white/[.025]"><div className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><div className="grid gap-6 md:grid-cols-3">{[[ar?'مهمتنا':'Our Mission',ar?'تقديم حلول نقل ولوجستيات آمنة وفعالة ومبتكرة مع الحفاظ على أعلى معايير الجودة والاعتمادية والاحترافية.':'To deliver safe, efficient, and innovative transportation and logistics solutions while maintaining high standards of quality, reliability, and professionalism.'],[ar?'رؤيتنا':'Our Vision',ar?'بناء عمليات لوجستية أكثر اتصالاً ووضوحاً واستجابة تساعد العملاء على نقل البضائع وإدارة سلاسل الإمداد بثقة.':'To build more connected, visible, and responsive logistics operations that help customers move cargo and manage supply chains with confidence.'],[ar?'قيمنا':'Our Values',ar?'السلامة · النزاهة · الاعتمادية · التميز · الابتكار · العمل الجماعي · نجاح العميل':'Safety · Integrity · Reliability · Excellence · Innovation · Teamwork · Customer Success']].map(([t,b])=><article key={t} className="min-h-52 rounded-3xl border border-white/10 bg-black/25 p-8 backdrop-blur-sm"><div className="mb-8 h-1 w-12 bg-[#C2A378]"/><h3 className="text-2xl font-black uppercase italic">{t}</h3><p className="mt-4 text-sm leading-7 text-slate-400">{b}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><div className="grid gap-12 lg:grid-cols-[1fr_.9fr]"><div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar?'الشبكة التشغيلية':'Network'}</p><h2 className="mt-3 text-4xl font-black uppercase italic">{ar?'شبكة تشغيلية على مستوى مصر':'A Nationwide Operating Network'}</h2><p className="mt-6 max-w-2xl text-sm leading-8 text-slate-300">{ar?'تربط عملياتنا الطرق والموانئ والعملاء وشركاء سلاسل الإمداد من خلال تركيز مستمر على السلامة والتنفيذ في الوقت المحدد والرؤية التشغيلية والكفاءة.':'Our operations connect roads, ports, customers, and supply-chain partners with a continuous focus on safety, on-time execution, operational visibility, and efficiency.'}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{['PORT SAID','ALEXANDRIA','DAMietta','SOKHNA','DEKHEILA','EGYPT'].map((x,i)=><div key={x} className="rounded-2xl border border-white/10 bg-white/[.03] p-5 backdrop-blur-sm"><div className="text-[9px] font-black tracking-[.2em] text-slate-500">0{i+1}</div><div className="mt-8 text-xs font-black uppercase">{ar?['بورسعيد','الإسكندرية','دمياط','السخنة','الدخيلة','مصر'][i]:x}</div></div>)}</div></div></section>

      <section id="operations" className="border-y border-white/10 bg-black/35"><div className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar?'عملياتنا':'Our Operations'}</p><h2 className="mt-3 text-4xl font-black uppercase italic">{ar?'النقل والخدمات اللوجستية':'Transport & Logistics'}</h2><div className="mt-10 grid gap-5 md:grid-cols-2"><button onClick={onGenset} className="group rounded-3xl border border-[#C2A378]/30 bg-white/[.04] p-8 text-left backdrop-blur-sm transition-all hover:border-[#C2A378]/70 hover:bg-white/[.07]"><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#C2A378]">{ar?'دخول النظام':'System Access'}</div><div className="mt-5 text-3xl font-black uppercase italic">{ar?'نظام الجينسيت':'GENSET SYSTEM'}</div><p className="mt-3 text-sm leading-7 text-slate-400">{ar?'للمستخدمين المصرح لهم الدخول إلى منصة تشغيل وإدارة الجينسيت الحالية.':'Authorized users can access the existing Genset operations platform.'}</p><div className="mt-5 text-xs font-black text-[#C2A378]">{ar?'رقم الجينسيت: 01212229077':'GENSET: 01212229077'}</div></button><div className="rounded-3xl border border-white/10 bg-white/[.03] p-8 backdrop-blur-sm"><div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">{ar?'قريباً':'Coming Soon'}</div><div className="mt-5 text-3xl font-black uppercase italic">{ar?'النقل':'TRANSPORT'}</div><p className="mt-3 text-sm leading-7 text-slate-400">{ar?'إدارة متكاملة للنقل بالشاحنات ونقل الحاويات قيد التطوير.':'Integrated trucking and container transport management is under development.'}</p><div className="mt-5 text-xs font-black text-[#C2A378]">{ar?'رقم النقل: 01000992858':'TRANSPORT: 01000992858'}</div></div></div></div></section>

      <section id="leadership" className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar?'الإدارة':'Leadership'}</p><h2 className="mt-3 text-4xl font-black uppercase italic">{ar?'الأشخاص الذين يقودون العمليات':'People behind the operation'}</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{[[ar?'شريف حجازي':'SHERIF HEGAZY',ar?'الرئيس التنفيذي':'CEO'],[ar?'سمر حجازي':'SAMAR HEGAZY',ar?'رئيس قطاع النقل':'HEAD OF TRANSPORT DEPARTMENT'],[ar?'ياسمين حجازي':'YASMINE HEGAZY',ar?'رئيس قطاع الجينسيت':'HEAD OF GENSET DEPARTMENT']].map(([n,r])=><div key={n} className="rounded-3xl border border-white/10 bg-white/[.035] p-8 backdrop-blur-sm"><div className="mb-16 h-1 w-10 bg-[#C2A378]"/><div className="text-xl font-black uppercase">{n}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{r}</div></div>)}</div></section>

      <section id="contact" className="border-t border-white/10 bg-white/[.025]"><div className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="grid gap-10 md:grid-cols-2"><div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar?'المكتب الرئيسي':'Head Office'}</p><h2 className="mt-3 text-4xl font-black uppercase italic">Nile Fleet</h2><a href="https://www.linkedin.com/company/134803963/" target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs font-black text-[#C2A378]">{ar?'صفحة لينكدإن الرسمية':'Official LinkedIn Profile'}</a></div><div className="text-sm leading-8 text-slate-300">{ar?'23 يوليو - مبنى أبو الخير - الدور الثاني - بورسعيد - مصر':'23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt'}<br/><span className="text-slate-400">{ar?'البريد العام: nilefleet@nilefleetlogistics.com':'General Email: nilefleet@nilefleetlogistics.com'}<br/>{ar?'النقل: 01000992858':'Transport: 01000992858'} · {ar?'الجينسيت: 01212229077':'Genset: 01212229077'}</span></div></div></div></section>
    </main>
    <footer className="border-t border-white/10 bg-[#001F3F]/85 backdrop-blur-md"><div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row"><div><div className="text-xl font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><p className="mt-2 text-xs text-slate-400">{ar?'آمن. موثوق. واضح. متصل.':'Safe. Reliable. Visible. Connected.'}</p></div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{ar?'النقل · اللوجستيات · العمليات':'Transport · Logistics · Operations'}</div></div></div></footer>
  </div>ct, { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../App';

interface Props { onGenset: () => void; }

const CompanyHomeV2: React.FC<Props> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const ar = lang === 'ar';
  const [p, setP] = useState({x:0,y:0});
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const move=(e:MouseEvent)=>setP({x:(e.clientX/window.innerWidth-.5)*2,y:(e.clientY/window.innerHeight-.5)*2});
    const scr=()=>setScroll(window.scrollY);
    window.addEventListener('mousemove',move,{passive:true});
    window.addEventListener('scroll',scr,{passive:true});
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('scroll',scr)};
  },[]);

  return <div className="relative min-h-screen overflow-x-hidden bg-[#020509] text-white">
    <style>{`
      @keyframes truckCruise{0%,100%{transform:translateX(-6%) translateY(2px)}50%{transform:translateX(8%) translateY(-3px)}}
      @keyframes glitch{0%,90%,100%{opacity:0}91%{opacity:.65;transform:translateX(-12px)}93%{opacity:.25;transform:translateX(9px)}95%{opacity:.5;transform:translateX(-4px)}}
      @keyframes flash{0%,88%,94%,100%{opacity:0}90%{opacity:.3}92%{opacity:.04}}
      @keyframes scan{from{transform:translateY(-120%)}to{transform:translateY(360%)}}
      .nf-truck{animation:truckCruise 8s ease-in-out infinite}.nf-glitch{animation:glitch 5s steps(1) infinite}.nf-flash{animation:flash 6s steps(1) infinite}.nf-scan{animation:scan 8s linear infinite}
    `}</style>

    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020509]">
      <div className="absolute inset-0" style={{transform:`translate3d(${p.x*-16}px,${p.y*-10-scroll*.025}px,0) scale(1.08)`}}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(255,255,255,.11),transparent_32%),linear-gradient(120deg,#010204,#071522_45%,#000_80%)]"/>
        <div className="absolute inset-x-[-20%] bottom-[10%] h-44 bg-gradient-to-t from-white/[.08] via-white/[.015] to-transparent blur-2xl"/>
      </div>
      <div className="nf-truck absolute bottom-[12%] left-[30%] w-[360px] sm:w-[540px]" style={{transform:`translate3d(${p.x*28+scroll*.055}px,${p.y*9}px,0)`}}>
        <svg viewBox="0 0 700 250" className="w-full drop-shadow-[0_0_35px_rgba(255,255,255,.16)]">
          <g fill="none" stroke="rgba(255,255,255,.78)" strokeWidth="4">
            <path d="M65 166h390V90h100l70 55v21h30"/><path d="M455 90v76M555 90v55M455 120h100"/><path d="M35 166h610"/>
            <circle cx="160" cy="182" r="32"/><circle cx="565" cy="182" r="32"/><circle cx="160" cy="182" r="9"/><circle cx="565" cy="182" r="9"/>
          </g>
          <path d="M480 101h70l55 44h-125z" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.65)" strokeWidth="4"/>
          <path d="M0 207h700" stroke="white" opacity=".12"/>
        </svg>
      </div>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.025)_0,rgba(255,255,255,.025)_1px,transparent_1px,transparent_5px)] opacity-40"/>
      <div className="nf-scan absolute left-0 right-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-white/[.05] to-transparent"/>
      <div className="nf-glitch absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)]"/>
      <div className="nf-flash absolute inset-0 bg-white mix-blend-screen"/>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85"/>
    </div>

    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/45 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet"/><div><div className="text-lg font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><div className="text-[8px] font-bold uppercase tracking-[.3em] text-slate-400">Transport & Logistics Service</div></div></div>
        <div className="flex items-center gap-5">
          <nav className="hidden gap-7 text-[10px] font-black uppercase tracking-[.2em] text-slate-300 md:flex"><a href="#about">About</a><a href="#operations">Operations</a><a href="#leadership">Leadership</a><a href="#contact">Contact</a></nav>
          <button onClick={()=>setLang(ar?'en':'ar')} className="rounded-lg border border-[#C2A378]/30 px-3 py-2 text-[9px] font-black uppercase text-[#C2A378]">{ar?'EN':'العربية'}</button>
        </div>
      </div>
    </header>

    <main className="relative z-10">
      <section className="relative min-h-[90vh" overflow-hidden border-b border-white/10">
        <div className="mx-auto grid min-h-[90vh] max-w-7xl items-center px-5 py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="mb-5 text-[10px] font-black uppercase tracking-[.45em] text-[#C2A378]">Since 2009 · Egypt</p>
            <h1 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[7rem]">Moving cargo.<br/><span className="text-[#C2A378]">Moving business.</span></h1>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{ar?'نيل فليت لخدمات النقل واللوجستيات — حلول موثوقة لنقل البضائع والحاويات وإدارة العمليات اللوجستية في مصر.':'Nile Fleet for Transport and Logistics Service delivers reliable trucking, container transportation, and integrated logistics solutions across Egypt.'}</p>
            <div className="mt-8 h-px w-32 bg-[#C2A378]"/>
            <p className="mt-6 max-w-xl text-xs font-semibold leading-6 text-slate-400">{ar?'خبرة تتجاوز 17 عاماً، مع تركيز على السلامة والالتزام بالمواعيد والرؤية التشغيلية.':'More than 17 years of industry experience, focused on safety, on-time delivery, operational visibility, and customer success.'}</p>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">About Nile Fleet</p><h2 className="mt-4 text-4xl font-black uppercase italic sm:text-5xl">Built for the road.<br/>Connected to the port.</h2></div>
          <div className="text-sm leading-7 text-slate-300 sm:text-base">Nile Fleet for Transport and Logistics Service is one of Egypt’s leading transportation and logistics providers, offering reliable trucking, container transportation, and integrated logistics solutions since 2009. With more than 17 years of industry experience, the company supports businesses across Egypt by ensuring cargo moves safely, on time, and with full operational visibility.<br/><br/>Nile Fleet serves shipping lines, freight forwarders, importers, exporters, and industrial clients through fleet management, port logistics operations, and supply chain support. The organization is driven by a mission to deliver safe, efficient, and innovative logistics solutions while upholding high standards of quality, reliability, and professionalism.</div>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['2009','Founded'],['17+','Years Experience'],['Egypt','Nationwide Operations'],['24/7','Operational Focus']].map(([v,l])=><div key={l} className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="text-3xl font-black text-[#C2A378]">{v}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-slate-400">{l}</div></div>)}</div>
      </section>


      <section className="border-y border-white/10 bg-white/[.025]"><div className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><div className="grid gap-6 md:grid-cols-3">{[['OUR MISSION','To deliver safe, efficient, and innovative transportation and logistics solutions while maintaining high standards of quality, reliability, and professionalism.'],['OUR VISION','To build more connected, visible, and responsive logistics operations that help customers move cargo and manage supply chains with confidence.'],['OUR VALUES','Safety · Integrity · Reliability · Excellence · Innovation · Teamwork · Customer Success']].map(([t,b])=><article key={t} className="min-h-52 rounded-3xl border border-white/10 bg-black/25 p-8 backdrop-blur-sm"><div className="mb-8 h-1 w-12 bg-[#C2A378]"/><h3 className="text-2xl font-black uppercase italic">{t}</h3><p className="mt-4 text-sm leading-7 text-slate-400">{b}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8"><div className="grid gap-12 lg:grid-cols-[1fr_.9fr]"><div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Network</p><h2 className="mt-3 text-4xl font-black uppercase italic">A Nationwide Operating Network</h2><p className="mt-6 max-w-2xl text-sm leading-8 text-slate-300">Our operations connect roads, ports, customers, and supply-chain partners with a continuous focus on safety, on-time execution, operational visibility, and efficiency.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{['PORT SAID','ALEXANDRIA','DAMietta','SOKHNA','DEKHEILA','EGYPT'].map((x,i)=><div key={x} className="rounded-2xl border border-white/10 bg-white/[.03] p-5 backdrop-blur-sm"><div className="text-[9px] font-black tracking-[.2em] text-slate-500">0{i+1}</div><div className="mt-8 text-xs font-black uppercase">{x}</div></div>)}</div></div></section>
      <section id="operations" className="border-y border-white/10 bg-black/40">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Our Operations</p><h2 className="mt-3 text-4xl font-black uppercase italic">Transport & Logistics</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <button onClick={onGenset} className="group rounded-2xl border border-[#C2A378]/30 bg-white/[.025] p-6 text-left hover:border-[#C2A378]/70 transition-all"><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#C2A378]">System Access</div><div className="mt-5 text-2xl font-black uppercase italic">GENSET SYSTEM</div><p className="mt-2 text-xs leading-6 text-slate-400">Authorized users can access the existing Genset operations platform.</p></button>
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6"><div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">Coming Soon</div><div className="mt-5 text-2xl font-black uppercase italic">TRANSPORT</div><p className="mt-2 text-xs leading-6 text-slate-400">Integrated trucking and container transport management is under development.</p></div>
          </div>
        </div>
      </section>

      <section id="leadership" className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Leadership</p><h2 className="mt-3 text-4xl font-black uppercase italic">People behind the operation</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{[['SHERIF HEGAZY','CEO'],['SAMAR HEGAZY','HEAD OF TRANSPORT DEPARTMENT'],['YASMINE HEGAZY','HEAD OF GENSET DEPARTMENT']].map(([n,r])=><div key={n} className="rounded-3xl border border-white/10 bg-white/[.025] p-7"><div className="mb-12 h-1 w-10 bg-[#C2A378]"/><div className="text-xl font-black uppercase">{n}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{r}</div></div>)}</div></section>

      <section id="contact" className="border-t border-white/10 bg-white/[.025]"><div className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="grid gap-10 md:grid-cols-2"><div><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Head Office</p><h2 className="mt-3 text-4xl font-black uppercase italic">Nile Fleet</h2></div><div className="text-sm leading-8 text-slate-300">23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt<br/><span className="text-slate-400">nilefleet@nilefleetlogistics.com · 01000992858 · 01212229077</span></div></div></div></section>\n\n      <footer className="border-t border-white/10 bg-[#001F3F]"><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="grid gap-8 md:grid-cols-2"><div><div className="text-xl font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><p className="mt-2 text-xs text-slate-300">Safe. Reliable. Visible. Connected.</p></div><div className="md:text-right"><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">Head Office</div><div className="mt-2 text-sm text-slate-300">23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt</div><div className="mt-2 text-xs text-slate-400">nilefleet@nilefleetlogistics.com · 01000992858 · 01212229077</div></div></div></div></footer>
    </main>
  </div>;
};

export default CompanyHomeV2;
