import React, { useContext, useEffect, useState } from 'react';
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

    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/65 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet"/><div><div className="text-lg font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><div className="text-[8px] font-bold uppercase tracking-[.3em] text-slate-400">Transport & Logistics Service</div></div></div>
        <div className="flex items-center gap-5">
          <nav className="hidden gap-7 text-[10px] font-black uppercase tracking-[.2em] text-slate-300 md:flex"><a href="#about">About</a><a href="#services">Services</a><a href="#leadership">Leadership</a></nav>
          <button onClick={()=>setLang(ar?'en':'ar')} className="rounded-lg border border-[#C2A378]/30 px-3 py-2 text-[9px] font-black uppercase text-[#C2A378]">{ar?'EN':'العربية'}</button>
        </div>
      </div>
    </header>

    <main className="relative z-10">
      <section className="relative min-h-[82vh] overflow-hidden border-b border-white/10">
        <div className="mx-auto grid min-h-[82vh] max-w-7xl items-center px-5 py-20 lg:px-8">
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

      <section id="services" className="border-y border-white/10 bg-black/40">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Our Operations</p><h2 className="mt-3 text-4xl font-black uppercase italic">Transport & Logistics</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <button onClick={onGenset} className="group rounded-2xl border border-[#C2A378]/30 bg-white/[.025] p-6 text-left hover:border-[#C2A378]/70 transition-all"><div className="text-[9px] font-black uppercase tracking-[.25em] text-[#C2A378]">System Access</div><div className="mt-5 text-2xl font-black uppercase italic">GENSET SYSTEM</div><p className="mt-2 text-xs leading-6 text-slate-400">Authorized users can access the existing Genset operations platform.</p></button>
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6"><div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">Coming Soon</div><div className="mt-5 text-2xl font-black uppercase italic">TRANSPORT</div><p className="mt-2 text-xs leading-6 text-slate-400">Integrated trucking and container transport management is under development.</p></div>
          </div>
        </div>
      </section>

      <section id="leadership" className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Leadership</p><h2 className="mt-3 text-4xl font-black uppercase italic">People behind the operation</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{[['SHERIF HEGAZY','CEO'],['SAMAR HEGAZY','HEAD OF TRANSPORT DEPARTMENT'],['YASMINE HEGAZY','HEAD OF GENSET DEPARTMENT']].map(([n,r])=><div key={n} className="rounded-3xl border border-white/10 bg-white/[.025] p-7"><div className="mb-12 h-1 w-10 bg-[#C2A378]"/><div className="text-xl font-black uppercase">{n}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{r}</div></div>)}</div></section>

      <footer className="border-t border-white/10 bg-[#001F3F]"><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="grid gap-8 md:grid-cols-2"><div><div className="text-xl font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><p className="mt-2 text-xs text-slate-300">Safe. Reliable. Visible. Connected.</p></div><div className="md:text-right"><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">Head Office</div><div className="mt-2 text-sm text-slate-300">23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt</div><div className="mt-2 text-xs text-slate-400">mohamedalaa@nilefleetlogistics.com · +20 114 647 5759</div></div></div></div></footer>
    </main>
  </div>;
};

export default CompanyHomeV2;
