import React, { useContext, useEffect } from 'react';
import { LanguageContext } from '../App';

interface Props { onGenset: () => void; }

const CompanyHomeV2: React.FC<Props> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const ar = lang === 'ar';

  useEffect(() => {
    const onScroll = () => {};
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ports = ar
    ? ['بورسعيد', 'الإسكندرية', 'دمياط', 'السخنة', 'الدخيلة', 'مصر']
    : ['PORT SAID', 'ALEXANDRIA', 'DAMietta', 'SOKHNA', 'DEKHEILA', 'EGYPT'];

  const leadership = ar
    ? [['شريف حجازي', 'الرئيس التنفيذي'], ['سمر حجازي', 'رئيس قطاع النقل'], ['ياسمين حجازي', 'رئيس قطاع الجينسيت']]
    : [['SHERIF HEGAZY', 'CEO'], ['SAMAR HEGAZY', 'HEAD OF TRANSPORT DEPARTMENT'], ['YASMINE HEGAZY', 'HEAD OF GENSET DEPARTMENT']];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="relative min-h-screen overflow-x-hidden bg-[#020509] text-white">
      <style>{`
        @keyframes bpScan { from { transform: translateY(-100%); opacity: 0; } 15% { opacity: .8; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes bpPulse { 0%, 100% { opacity: .18; } 50% { opacity: .55; } }
        .bp-scan { animation: bpScan 7s linear infinite; }
        .bp-pulse { animation: bpPulse 3s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020b18]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(45,175,255,.075)_1px,transparent_1px),linear-gradient(90deg,rgba(45,175,255,.075)_1px,transparent_1px)] bg-[size:36px_36px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(25,160,255,.20),transparent_48%),linear-gradient(180deg,#03182a,#020b18_60%,#01050b)] opacity-35" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
          <g fill="none" stroke="rgba(74,193,255,.25)" strokeWidth="1">
            <path d="M70 735H1530M70 770H1530M70 805H1530" />
            <path d="M120 120V820M250 120V820M1350 120V820M1480 120V820" />
            <circle cx="180" cy="190" r="95" />
            <circle cx="1410" cy="210" r="125" />
          </g>
          <g className="bp-pulse" fill="none" stroke="rgba(90,205,255,.58)" strokeWidth="1.5">
            <path d="M190 650L350 490L610 490L760 610L1120 610L1270 510L1460 510" />
            <path d="M350 490L430 365L700 365L760 610" />
            <path d="M1270 510L1320 350L1450 350" />
          </g>
          <g fill="none" stroke="rgba(94,210,255,.82)" strokeWidth="2">
            <path d="M300 610H570V470H665L735 525V610H780" />
            <path d="M690 560H1090V610H690Z" />
            <path d="M1080 610H1390L1470 660V700H1080Z" />
            <circle cx="430" cy="675" r="48" /><circle cx="430" cy="675" r="18" />
            <circle cx="1010" cy="675" r="48" /><circle cx="1010" cy="675" r="18" />
            <circle cx="1320" cy="675" r="48" /><circle cx="1320" cy="675" r="18" />
          </g>
          <path className="bp-scan" d="M0 260H1600" stroke="rgba(110,220,255,.8)" strokeWidth="2" />
        </svg>
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet" />
            <div>
              <div className="text-lg font-black">NILE <span className="text-[#C2A378]">FLEET</span></div>
              <div className="text-[8px] font-bold uppercase tracking-[.3em] text-slate-400">{ar ? 'خدمات النقل واللوجستيات' : 'Transport & Logistics Service'}</div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <nav className="hidden gap-7 text-[10px] font-black uppercase tracking-[.2em] text-slate-300 md:flex">
              <a href="#about">{ar ? 'عن الشركة' : 'About'}</a>
              <a href="#operations">{ar ? 'العمليات' : 'Operations'}</a>
              <a href="#leadership">{ar ? 'الإدارة' : 'Leadership'}</a>
              <a href="#contact">{ar ? 'اتصل بنا' : 'Contact'}</a>
            </nav>
            <button onClick={() => setLang(ar ? 'en' : 'ar')} className="rounded-lg border border-[#C2A378]/30 px-3 py-2 text-[9px] font-black uppercase text-[#C2A378]">{ar ? 'EN' : 'العربية'}</button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative min-h-[90vh] overflow-hidden border-b border-white/10">
          <div className="mx-auto flex min-h-[90vh] max-w-7xl items-center px-5 py-24 lg:px-8">
            <div className="max-w-5xl">
              <p className="mb-5 text-[10px] font-black uppercase tracking-[.45em] text-[#C2A378]">{ar ? 'منذ 2009 · مصر' : 'Since 2009 · Egypt'}</p>
              <h1 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[7rem]">{ar ? 'نحرّك البضائع.' : 'Moving cargo.'}<br /><span className="text-[#C2A378]">{ar ? 'نحرّك الأعمال.' : 'Moving business.'}</span></h1>
              <p className="mt-9 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">{ar ? 'نيل فليت لخدمات النقل واللوجستيات تقدم حلولاً موثوقة لنقل الشاحنات والحاويات والخدمات اللوجستية المتكاملة في جميع أنحاء مصر.' : 'Nile Fleet for Transport and Logistics Service delivers reliable trucking, container transportation, and integrated logistics solutions across Egypt.'}</p>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar ? 'عن نيل فليت' : 'About Nile Fleet'}</p>
          <h2 className="mt-4 whitespace-pre-line text-4xl font-black uppercase italic sm:text-5xl">{ar ? 'صُممت للطريق.\nومرتبطة بالميناء.' : 'Built for the road.\nConnected to the port.'}</h2>
          <p className="mt-8 max-w-4xl text-sm leading-8 text-slate-300 sm:text-base">{ar ? 'نيل فليت لخدمات النقل واللوجستيات تقدم خدمات نقل الشاحنات والحاويات والحلول اللوجستية المتكاملة في مصر.' : 'Nile Fleet for Transport and Logistics Service provides trucking, container transportation, and integrated logistics solutions across Egypt.'}</p>
        </section>

        <section className="border-y border-white/10 bg-white/[.025]">
          <div className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
            <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar ? 'الشبكة التشغيلية' : 'Network'}</p>
            <h2 className="mt-3 text-4xl font-black uppercase italic">{ar ? 'شبكة تشغيلية على مستوى مصر' : 'A Nationwide Operating Network'}</h2>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ports.map((port, i) => <div key={port} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="text-[9px] font-black tracking-[.2em] text-slate-500">0{i + 1}</div><div className="mt-8 text-xs font-black uppercase">{port}</div></div>)}
            </div>
          </div>
        </section>

        <section id="operations" className="border-y border-white/10 bg-black/35">
          <div className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
            <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar ? 'عملياتنا' : 'Our Operations'}</p>
            <h2 className="mt-3 text-4xl font-black uppercase italic">{ar ? 'النقل والخدمات اللوجستية' : 'Transport & Logistics'}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <button onClick={onGenset} className="rounded-3xl border border-[#C2A378]/30 bg-white/[.04] p-8 text-left transition-all hover:border-[#C2A378]/70">
                <div className="text-[9px] font-black uppercase tracking-[.25em] text-[#C2A378]">{ar ? 'دخول النظام' : 'System Access'}</div>
                <div className="mt-5 text-3xl font-black uppercase italic">{ar ? 'نظام الجينسيت' : 'GENSET SYSTEM'}</div>
                <p className="mt-3 text-sm leading-7 text-slate-400">{ar ? 'دخول المستخدمين المصرح لهم إلى منصة تشغيل وإدارة الجينسيت.' : 'Authorized users can access the Genset operations platform.'}</p>
              </button>
              <div className="rounded-3xl border border-white/10 bg-white/[.03] p-8">
                <div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">{ar ? 'قريباً' : 'Coming Soon'}</div>
                <div className="mt-5 text-3xl font-black uppercase italic">{ar ? 'النقل' : 'TRANSPORT'}</div>
                <p className="mt-3 text-sm leading-7 text-slate-400">{ar ? 'إدارة متكاملة للنقل بالشاحنات ونقل الحاويات قيد التطوير.' : 'Integrated trucking and container transport management is under development.'}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="leadership" className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar ? 'الإدارة' : 'Leadership'}</p>
          <h2 className="mt-3 text-4xl font-black uppercase italic">{ar ? 'الأشخاص الذين يقودون العمليات' : 'People behind the operation'}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {leadership.map(([name, role]) => <div key={name} className="rounded-3xl border border-white/10 bg-white/[.035] p-8"><div className="mb-16 h-1 w-10 bg-[#C2A378]" /><div className="text-xl font-black uppercase">{name}</div><div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{role}</div></div>)}
          </div>
        </section>

        <section id="contact" className="border-t border-white/10 bg-white/[.025]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">{ar ? 'اتصل بنا' : 'Contact'}</p>
            <h2 className="mt-3 text-4xl font-black uppercase italic">Nile Fleet</h2>
            <p className="mt-6 text-sm leading-8 text-slate-300">{ar ? '23 يوليو - مبنى أبو الخير - الدور الثاني - بورسعيد - مصر' : '23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt'}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#001F3F]/85">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="text-xl font-black">NILE <span className="text-[#C2A378]">FLEET</span></div><p className="mt-2 text-xs text-slate-400">{ar ? 'آمن. موثوق. واضح. متصل.' : 'Safe. Reliable. Visible. Connected.'}</p></div>
      </footer>
    </div>
  );
};

export default CompanyHomeV2;
