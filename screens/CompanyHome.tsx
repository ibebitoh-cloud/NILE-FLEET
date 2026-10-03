import React, { useContext } from 'react';
import { LanguageContext } from '../App';

interface CompanyHomeProps {
  onGenset: () => void;
}

const CompanyHome: React.FC<CompanyHomeProps> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const ar = lang === 'ar';

  return (
    <div className="min-h-screen bg-[#06111d] text-white overflow-x-hidden">
      <style>{`
        @keyframes fleetFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes fleetLine { 0%{transform:scaleX(.35);opacity:.2} 50%{transform:scaleX(1);opacity:1} 100%{transform:scaleX(.35);opacity:.2} }
        .fleet-float{animation:fleetFloat 5s ease-in-out infinite}
        .fleet-line{animation:fleetLine 3s ease-in-out infinite}
      `}</style>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06111d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/nile-fleet-logo.png" className="h-11 w-11 object-contain" alt="Nile Fleet" />
            <div>
              <div className="text-lg font-black tracking-tight">NILE <span className="text-[#C2A378]">FLEET</span></div>
              <div className="text-[8px] font-bold uppercase tracking-[.3em] text-slate-400">Transport & Logistics Service</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-7 text-[10px] font-black uppercase tracking-[.2em] text-slate-300 md:flex">
              <a href="#about" className="hover:text-[#C2A378]">About</a>
              <a href="#services" className="hover:text-[#C2A378]">Services</a>
              <a href="#leadership" className="hover:text-[#C2A378]">Leadership</a>
            </nav>
            <button onClick={() => setLang(ar ? 'en' : 'ar')} className="rounded-lg border border-[#C2A378]/30 px-3 py-2 text-[9px] font-black uppercase text-[#C2A378]">
              {ar ? 'EN' : 'العربية'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(194,163,120,.18),transparent_32%),linear-gradient(135deg,#071827,#3a3833_55%,#06111d)]"></div>
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-28">
            <div className="flex flex-col justify-center">
              <p className="mb-5 text-[10px] font-black uppercase tracking-[.45em] text-[#C2A378]">Since 2009 · Egypt</p>
              <h1 className="max-w-4xl text-5xl font-black uppercase italic leading-[.92] tracking-[-.05em] sm:text-6xl lg:text-8xl">
                Moving cargo.<br/><span className="text-[#C2A378]">Moving business.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {ar ? 'نيل فليت لخدمات النقل واللوجستيات — حلول موثوقة لنقل البضائع والحاويات وإدارة العمليات اللوجستية في مصر.' : 'Nile Fleet for Transport and Logistics Service delivers reliable trucking, container transportation, and integrated logistics solutions across Egypt.'}
              </p>
              <div className="fleet-line mt-8 h-px w-32 origin-left bg-[#C2A378]"></div>
              <p className="mt-6 max-w-xl text-xs font-semibold leading-6 text-slate-400">
                {ar ? 'خبرة تتجاوز 17 عاماً، مع تركيز على السلامة، الالتزام بالمواعيد، الرؤية التشغيلية، ونجاح العملاء.' : 'More than 17 years of industry experience, with a focus on safety, on-time delivery, operational visibility, and customer success.'}
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="fleet-float relative w-full max-w-md rounded-[2rem] border border-[#C2A378]/20 bg-white/[.035] p-5 shadow-2xl">
                <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#0a1b2b]">
                  <video className="h-full w-full object-cover opacity-80" src="/genmark-clip-on-gc5-genset.mp4" autoPlay muted loop playsInline />
                </div>
                <div className="absolute bottom-9 left-9 rounded-xl border border-white/10 bg-[#06111d]/90 px-4 py-3 backdrop-blur">
                  <div className="text-[8px] font-black uppercase tracking-[.25em] text-[#C2A378]">NILE FLEET</div>
                  <div className="mt-1 text-xs font-bold text-white">LOGISTICS NETWORK · EGYPT</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">About Nile Fleet</p>
              <h2 className="mt-4 text-4xl font-black uppercase italic tracking-tight sm:text-5xl">Built for the road.<br/>Connected to the port.</h2>
            </div>
            <div className="text-sm leading-7 text-slate-300 sm:text-base">
              Nile Fleet for Transport and Logistics Service is one of Egypt’s leading transportation and logistics providers, offering reliable trucking, container transportation, and integrated logistics solutions since 2009. With more than 17 years of industry experience, the company supports businesses across Egypt by ensuring cargo moves safely, on time, and with full operational visibility.
              <br/><br/>
              Nile Fleet serves shipping lines, freight forwarders, importers, exporters, and industrial clients through fleet management, port logistics operations, and supply chain support. The organization is driven by a mission to deliver safe, efficient, and innovative logistics solutions while upholding high standards of quality, reliability, and professionalism.
            </div>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['2009','Founded'],
              ['17+','Years Experience'],
              ['Egypt','Nationwide Operations'],
              ['24/7','Operational Focus']
            ].map(([value,label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
                <div className="text-3xl font-black text-[#C2A378]">{value}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="services" className="border-y border-white/10 bg-[#071521]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Our Operations</p>
            <h2 className="mt-3 text-4xl font-black uppercase italic tracking-tight">Services & Systems</h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <button onClick={onGenset} className="group min-h-64 rounded-3xl border border-[#C2A378]/35 bg-gradient-to-br from-[#0d2438] to-[#06111d] p-7 text-left transition-all hover:-translate-y-1 hover:border-[#C2A378]/70 hover:shadow-[0_20px_60px_rgba(194,163,120,.12)]">
                <div className="flex items-start justify-between">
                  <span className="rounded-full border border-[#C2A378]/30 px-3 py-1 text-[8px] font-black uppercase tracking-[.2em] text-[#C2A378]">Operational</span>
                  <span className="text-2xl text-[#C2A378]">↗</span>
                </div>
                <div className="mt-12 text-3xl font-black uppercase italic">GENSET</div>
                <p className="mt-3 text-xs leading-6 text-slate-400">Genset operations, bookings, stock, history, invoicing and fleet intelligence.</p>
                <div className="mt-5 text-[9px] font-black uppercase tracking-[.25em] text-white group-hover:text-[#C2A378]">Genset User Login →</div>
              </button>

              <div className="relative min-h-64 rounded-3xl border border-white/10 bg-white/[.025] p-7">
                <span className="rounded-full border border-white/15 px-3 py-1 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">Coming Soon</span>
                <div className="mt-12 text-3xl font-black uppercase italic">TRANSPORT</div>
                <p className="mt-3 text-xs leading-6 text-slate-400">Trucking, container transportation, fleet operations and integrated transport management.</p>
                <div className="mt-5 text-[9px] font-black uppercase tracking-[.25em] text-slate-500">System under development</div>
              </div>

              <div className="relative min-h-64 rounded-3xl border border-white/10 bg-white/[.025] p-7">
                <span className="rounded-full border border-white/15 px-3 py-1 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">Coming Soon</span>
                <div className="mt-12 text-3xl font-black uppercase italic">MAINTENANCE</div>
                <p className="mt-3 text-xs leading-6 text-slate-400">Equipment maintenance, service history and technical operations.</p>
                <div className="mt-5 text-[9px] font-black uppercase tracking-[.25em] text-slate-500">System under development</div>
              </div>
            </div>
          </div>
        </section>

        <section id="leadership" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#C2A378]">Leadership</p>
          <h2 className="mt-3 text-4xl font-black uppercase italic tracking-tight">People behind the operation</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ['SHERIF HEGAZY','CEO'],
              ['SAMAR HEGAZY','HEAD OF TRANSPORT DEPARTMENT'],
              ['YASMINE HEGAZY','HEAD OF GENSET DEPARTMENT']
            ].map(([name,role]) => (
              <div key={name} className="rounded-3xl border border-white/10 bg-white/[.025] p-7">
                <div className="mb-12 h-1 w-10 bg-[#C2A378]"></div>
                <div className="text-xl font-black uppercase">{name}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">{role}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#3a3833]">
          <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="text-xl font-black">NILE <span className="text-[#C2A378]">FLEET</span></div>
                <p className="mt-2 max-w-md text-xs leading-6 text-slate-300">Safe. Reliable. Visible. Connected.</p>
              </div>
              <div className="md:text-right">
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#C2A378]">Head Office</div>
                <div className="mt-2 text-sm text-slate-300">23 July St. · Abo Elkheer Building · 2nd Floor · Port Said, Egypt</div>
                <div className="mt-2 text-xs text-slate-400">mohamedalaa@nilefleetlogistics.com · +20 114 647 5759</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CompanyHome;
