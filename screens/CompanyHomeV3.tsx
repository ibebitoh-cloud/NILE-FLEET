import React, { useContext, useEffect, useRef, useState } from 'react';
import { LanguageContext } from '../App';

interface Props { onGenset: () => void; }

const IVECO_IMAGE = 'https://commons.wikimedia.org/wiki/Special:FilePath/Iveco%20Stralis%20HD%20420%202009.jpg?width=1800';
const MERCEDES_IMAGE = 'https://www.bauhof-online.de/fileadmin/redakteur/material/Newsmaterial/actros_08A978_klein.jpg';

const CompanyHomeV3: React.FC<Props> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const ar = lang === 'ar';
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const lastScroll = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setPointer({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2
      });
    };

    const scroll = () => {
      const next = window.scrollY;
      const delta = next - lastScroll.current;
      lastScroll.current = next;
      setScrollY(next);
      setScrollVelocity(Math.max(-32, Math.min(32, delta)));

      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setScrollVelocity(v => v * 0.72));
    };

    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('scroll', scroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const velocityAbs = Math.min(1, Math.abs(scrollVelocity) / 18);
  const motion = scrollVelocity * 4.2;
  const direction = scrollVelocity >= 0 ? 1 : -1;
  const headlight = 0.38 + velocityAbs * 0.62;

  const nav = [
    ['ABOUT', '#about'],
    ['OPERATIONS', '#operations'],
    ['LEADERSHIP', '#leadership']
  ];

  return (
    <div className="nf3 min-h-screen overflow-x-hidden bg-[#020305] text-white selection:bg-[#c2a378] selection:text-black">
      <style>{`
        @keyframes nf3Noise { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-2%,1%)} 40%{transform:translate(1%,-1%)} 60%{transform:translate(2%,2%)} 80%{transform:translate(-1%,-2%)} }
        @keyframes nf3Scan { from{transform:translateY(-120%)} to{transform:translateY(360%)} }
        @keyframes nf3Flash { 0%,86%,90%,100%{opacity:0} 87%{opacity:.5} 88%{opacity:.04} 89%{opacity:.22} }
        @keyframes nf3Light { 0%,45%,52%,100%{opacity:.32} 48%,50%{opacity:1} }
        @keyframes nf3Blink { 0%,72%,76%,100%{opacity:.08} 74%{opacity:.85} }
        @keyframes nf3Float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes nf3Pulse { 0%,100%{box-shadow:0 0 0 rgba(194,163,120,0)} 50%{box-shadow:0 0 42px rgba(194,163,120,.22)} }
        @keyframes nf3Dash { from{background-position:0 0} to{background-position:80px 0} }
        @keyframes nf3Reveal { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .nf3-reveal{animation:nf3Reveal .9s cubic-bezier(.16,1,.3,1) both}
        .nf3-light{animation:nf3Light 4.5s steps(1) infinite}
        .nf3-blink{animation:nf3Blink 3.7s steps(1) infinite}
        .nf3-float{animation:nf3Float 6s ease-in-out infinite}
        .nf3-pulse{animation:nf3Pulse 3s ease-in-out infinite}
        .nf3-noise{animation:nf3Noise .28s steps(2) infinite}
        .nf3-scan{animation:nf3Scan 7s linear infinite}
        .nf3-dash{animation:nf3Dash 1.6s linear infinite}
        .nf3-scrollbar::-webkit-scrollbar{width:5px}
        .nf3-scrollbar::-webkit-scrollbar-thumb{background:#c2a378}
        @media (prefers-reduced-motion: reduce){
          .nf3 *,.nf3 *::before,.nf3 *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}
        }
      `}</style>

      <div className="fixed inset-0 z-0 overflow-hidden bg-[#010204] pointer-events-none">
        <div
          className="absolute inset-[-8%]"
          style={{ transform: `translate3d(${pointer.x * -18}px,${pointer.y * -10 - scrollY * .018}px,0) scale(1.08)` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.08),transparent_28%),linear-gradient(135deg,#020305_0%,#07121c_45%,#000_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:90px_90px] opacity-30" />
        </div>

        <div
          className="absolute left-[-14vw] top-[12vh] w-[78vw] min-w-[720px] opacity-[.34] mix-blend-screen grayscale contrast-125"
          style={{
            transform: `translate3d(${pointer.x * 22 + motion * .7 + scrollY * .035}px,${pointer.y * 8}px,0) rotate(-1deg)`,
            filter: `brightness(${.52 + headlight * .48}) contrast(1.22) grayscale(.9)`
          }}
        >
          <img src={IVECO_IMAGE} alt="2009 Iveco Stralis" className="w-full object-contain" />
        </div>

        <div
          className="absolute right-[-20vw] top-[30vh] w-[86vw] min-w-[760px] opacity-[.27] mix-blend-screen grayscale contrast-125"
          style={{
            transform: `translate3d(${pointer.x * -28 + motion * 1.25 - scrollY * .025}px,${pointer.y * -7}px,0) scaleX(-1) rotate(1deg)`,
            filter: `brightness(${.45 + headlight * .5}) contrast(1.28) grayscale(1)`
          }}
        >
          <img src={MERCEDES_IMAGE} alt="2009 Mercedes Actros" className="w-full object-contain" />
        </div>

        <div
          className="absolute left-[8%] top-[29%] h-24 w-72 rounded-full bg-white blur-3xl"
          style={{ opacity: .03 + headlight * .08, transform: `translate3d(${pointer.x * 35 + motion}px,0,0)` }}
        />
        <div
          className="absolute right-[7%] top-[48%] h-28 w-96 rounded-full bg-white blur-3xl"
          style={{ opacity: .02 + headlight * .06, transform: `translate3d(${pointer.x * -35 - motion}px,0,0)` }}
        />

        <div className="nf3-light absolute left-[20%] top-[42%] h-3 w-28 rounded-full bg-white blur-md" style={{ opacity: headlight * .7 }} />
        <div className="nf3-blink absolute right-[19%] top-[58%] h-3 w-24 rounded-full bg-white blur-md" style={{ opacity: headlight * .62 }} />

        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.025)_0,rgba(255,255,255,.025)_1px,transparent_1px,transparent_5px)] opacity-50" />
        <div className="nf3-scan absolute left-0 right-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-white/[.06] to-transparent" />
        <div className="nf3-noise absolute inset-[-5%] opacity-[.055] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_7px,white_8px,transparent_9px)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,.38)_70%,#000_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/95" />
        <div className="nf3-flash absolute inset-0 bg-white mix-blend-screen" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/65 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-10">
          <a href="#top" className="group flex items-center gap-3">
            <img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain transition-transform duration-500 group-hover:rotate-6" alt="Nile Fleet" />
            <div>
              <div className="text-[17px] font-black tracking-tight">NILE <span className="text-[#c2a378]">FLEET</span></div>
              <div className="text-[7px] font-black uppercase tracking-[.34em] text-slate-500">Transport · Logistics · Egypt</div>
            </div>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => <a key={href} href={href} className="text-[9px] font-black tracking-[.25em] text-slate-400 transition hover:text-white">{label}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(ar ? 'en' : 'ar')} className="rounded-full border border-white/15 px-4 py-2 text-[9px] font-black tracking-[.15em] text-[#c2a378] transition hover:border-[#c2a378]/70">{ar ? 'EN' : 'العربية'}</button>
            <button onClick={onGenset} className="hidden rounded-full bg-[#c2a378] px-5 py-2.5 text-[9px] font-black tracking-[.18em] text-black transition hover:scale-105 sm:block">GENSET ACCESS</button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="relative flex min-h-[94vh] items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-[1500px] items-end gap-12 px-5 pb-24 pt-28 lg:grid-cols-[1.2fr_.8fr] lg:px-10 lg:pb-32">
            <div className="nf3-reveal">
              <div className="mb-7 flex items-center gap-4">
                <span className="h-px w-16 bg-[#c2a378]" />
                <span className="text-[9px] font-black uppercase tracking-[.48em] text-[#c2a378]">Since 2009 · Egypt</span>
              </div>
              <h1 className="max-w-6xl text-[clamp(3.7rem,10vw,10rem)] font-black uppercase italic leading-[.78] tracking-[-.075em]">
                Cargo<br /><span className="text-[#c2a378]">in motion.</span>
              </h1>
              <p className="mt-9 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
                {ar ? 'نيل فليت لخدمات النقل واللوجستيات — نقل الشاحنات والحاويات وحلول لوجستية متكاملة مع رؤية تشغيلية كاملة.' : 'Nile Fleet for Transport and Logistics Service — trucking, container transportation and integrated logistics built around safe movement and operational visibility.'}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a href="#operations" className="nf3-pulse rounded-full border border-[#c2a378]/60 bg-[#c2a378]/10 px-7 py-3 text-[9px] font-black uppercase tracking-[.24em] text-[#c2a378]">Explore Operations</a>
                <span className="text-[8px] font-black uppercase tracking-[.25em] text-slate-500">Move fast · move safe · move visible</span>
              </div>
            </div>

            <div className="nf3-float hidden lg:block">
              <div className="border-l border-white/10 pl-8">
                <div className="text-[8px] font-black uppercase tracking-[.35em] text-slate-500">Live motion layer</div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ['2009','FOUNDED'],
                    ['17+','YEARS'],
                    ['EGYPT','COVERAGE'],
                    ['24/7','OPERATIONS']
                  ].map(([v,l]) => (
                    <div key={l} className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
                      <div className="text-2xl font-black text-white">{v}</div>
                      <div className="mt-1 text-[7px] font-black tracking-[.2em] text-[#c2a378]">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[7px] font-black uppercase tracking-[.35em] text-slate-500">Scroll to drive</div>
            <div className="mx-auto mt-2 h-10 w-px bg-gradient-to-b from-[#c2a378] to-transparent" />
          </div>
        </section>

        <section id="about" className="relative border-y border-white/10 bg-black/60 backdrop-blur-sm">
          <div className="mx-auto grid max-w-[1500px] gap-14 px-5 py-28 lg:grid-cols-[.75fr_1.25fr] lg:px-10">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">01 / Company</div>
              <h2 className="mt-5 text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">Built for<br /><span className="text-[#c2a378]">the road.</span></h2>
            </div>
            <div className="max-w-3xl">
              <p className="text-base leading-8 text-slate-300 sm:text-lg">Nile Fleet for Transport and Logistics Service is one of Egypt’s leading transportation and logistics providers, offering reliable trucking, container transportation, and integrated logistics solutions since 2009.</p>
              <p className="mt-7 text-sm leading-7 text-slate-400">With more than 17 years of industry experience, the company supports shipping lines, freight forwarders, importers, exporters, and industrial clients through fleet management, port logistics operations, and supply chain support.</p>
              <div className="mt-12 h-px w-full bg-gradient-to-r from-[#c2a378] via-white/10 to-transparent" />
              <div className="mt-7 flex flex-wrap gap-3">
                {['SAFETY','RELIABILITY','VISIBILITY','INNOVATION','CUSTOMER SUCCESS'].map(x => <span key={x} className="rounded-full border border-white/10 bg-white/[.03] px-4 py-2 text-[7px] font-black tracking-[.2em] text-slate-400">{x}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section id="operations" className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#05080b] to-[#020305]" />
          <div className="relative mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">02 / Operations</div>
                <h2 className="mt-4 text-5xl font-black uppercase italic tracking-[-.05em] sm:text-7xl">One fleet.<br /><span className="text-[#c2a378]">Many missions.</span></h2>
              </div>
              <div className="max-w-sm text-xs leading-6 text-slate-500">From road transport to port-side genset operations, Nile Fleet connects physical movement with operational control.</div>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <button onClick={onGenset} className="group relative min-h-[380px] overflow-hidden rounded-[2rem] border border-[#c2a378]/30 bg-black text-left transition duration-500 hover:-translate-y-2 hover:border-[#c2a378]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(194,163,120,.18),transparent_28%),linear-gradient(135deg,#07121a,#010203)]" />
                <div className="absolute right-[-8%] top-[12%] w-[72%] opacity-20 grayscale transition duration-700 group-hover:scale-110 group-hover:opacity-35">
                  <img src={MERCEDES_IMAGE} alt="" className="w-full" />
                </div>
                <div className="relative flex min-h-[380px] flex-col justify-between p-8 sm:p-10">
                  <div className="flex items-center justify-between"><span className="rounded-full bg-[#c2a378] px-3 py-1 text-[7px] font-black tracking-[.2em] text-black">LIVE SYSTEM</span><span className="text-[8px] font-black tracking-[.25em] text-slate-600">01</span></div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.3em] text-[#c2a378]">Authorized access</div>
                    <div className="mt-3 text-4xl font-black uppercase italic tracking-[-.04em]">GENSET<br />CONTROL</div>
                    <p className="mt-4 max-w-md text-xs leading-6 text-slate-400">Access the existing Genset operations platform for bookings, stock, movements, invoices and operational control.</p>
                    <div className="mt-7 inline-flex items-center gap-3 text-[8px] font-black uppercase tracking-[.25em] text-white">Enter system <span className="transition group-hover:translate-x-2">→</span></div>
                  </div>
                </div>
              </button>

              <div className="group relative min-h-[380px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025] p-8 sm:p-10">
                <div className="absolute right-[-20%] top-[-5%] w-[120%] opacity-[.08] grayscale transition duration-700 group-hover:scale-105">
                  <img src={IVECO_IMAGE} alt="" className="w-full" />
                </div>
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex justify-between"><span className="text-[8px] font-black tracking-[.25em] text-slate-500">02</span><span className="rounded-full border border-white/10 px-3 py-1 text-[7px] font-black tracking-[.2em] text-slate-500">COMING SOON</span></div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.3em] text-slate-500">Next operation layer</div>
                    <div className="mt-3 text-4xl font-black uppercase italic">TRANSPORT</div>
                    <p className="mt-4 text-xs leading-6 text-slate-500">Integrated trucking and container transport management is under development.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="leadership" className="border-b border-white/10 bg-black/60">
          <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
            <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">03 / Leadership</div>
            <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <h2 className="text-5xl font-black uppercase italic tracking-[-.05em] sm:text-7xl">People behind<br /><span className="text-[#c2a378]">the movement.</span></h2>
              <p className="max-w-sm text-xs leading-6 text-slate-500">Leadership across company operations, transport and genset services.</p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                ['SHERIF HEGAZY','CEO','COMPANY'],
                ['SAMAR HEGAZY','HEAD OF TRANSPORT DEPARTMENT','TRANSPORT'],
                ['YASMINE HEGAZY','HEAD OF GENSET DEPARTMENT','GENSET']
              ].map(([name, role, area], i) => (
                <div key={name} className="group relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[.025] p-7 transition duration-500 hover:-translate-y-2 hover:border-[#c2a378]/40">
                  <div className="flex items-center justify-between"><span className="text-[7px] font-black tracking-[.25em] text-[#c2a378]">{String(i + 1).padStart(2,'0')}</span><span className="text-[7px] font-black tracking-[.2em] text-slate-600">{area}</span></div>
                  <div className="mt-20 h-px w-10 bg-[#c2a378] transition-all duration-500 group-hover:w-20" />
                  <div className="mt-5 text-xl font-black uppercase">{name}</div>
                  <div className="mt-2 text-[8px] font-black uppercase tracking-[.2em] text-slate-500">{role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#00111f]">
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)]" />
          <div className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">Nile Fleet</div>
                <div className="mt-3 text-3xl font-black uppercase italic">Safe. Reliable. Visible. Connected.</div>
              </div>
              <div className="text-xs leading-6 text-slate-400 md:text-right">
                <div>23 July St. · Abo Elkheer Building · 2nd Floor</div>
                <div>Port Said, Egypt</div>
                <div className="mt-2 text-[#c2a378]">mohamedalaa@nilefleetlogistics.com · +20 114 647 5759</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CompanyHomeV3;
