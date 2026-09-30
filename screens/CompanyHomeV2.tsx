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

  return <div dir={ar?'rtl':'ltr'} className="relative min-h-screen overflow-x-hidden bg-[#020509] text-white">
    <style>{`
      @keyframes roadMove{from{transform:translateX(0)}to{transform:translateX(-120px)}}
      @keyframes truckDrive{0%{transform:translateX(-18vw)}45%{transform:translateX(28vw)}100%{transform:translateX(120vw)}}
      @keyframes lightSweep{0%,100%{opacity:0;transform:translateX(-30%)}12%{opacity:.5}28%{opacity:0;transform:translateX(110%)}}
      @keyframes glitch{0%,91%,100%{opacity:0}92%{opacity:.7;transform:translateX(-18px)}94%{opacity:.18;transform:translateX(14px)}96%{opacity:.45;transform:translateX(-5px)}}
      @keyframes flash{0%,87%,94%,100%{opacity:0}89%{opacity:.24}91%{opacity:.03}}
      .nf-road{animation:roadMove 1.2s linear infinite}.nf-truck{animation:truckDrive 13s linear infinite}.nf-glitch{animation:glitch 5s steps(1) infinite}.nf-flash{animation:flash 7s steps(1) infinite}.nf-light{animation:lightSweep 6s ease-in-out infinite}
    `}</style>

    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#03101c]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(74,178,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(74,178,255,.07)_1px,transparent_1px)] bg-[size:42px_42px]"/>
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,rgba(52,160,255,.18),transparent_55%)]"/>
      <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_5px,rgba(100,190,255,.05)_6px)]"/>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
        <g fill="none" stroke="rgba(87,190,255,.38)" strokeWidth="1">
          <path d="M80 720H1510M110 760H1480M130 800H1460"/>
          <path d="M210 690L420 470L850 470L1080 650L1420 650"/>
          <path d="M260 690L390 540L760 540L940 690M430 470V360M850 470V330M1080 650V390"/>
          <circle cx="420" cy="470" r="92"/><circle cx="850" cy="470" r="118"/><circle cx="1080" cy="650" r="150"/>
        </g>
        <g fill="rgba(87,190,255,.65)" fontFamily="monospace" fontSize="16">
          <text x="105" y="705">NILE FLEET // ENGINEERING VIEW</text>
          <text x="430" y="335">CAB ASSEMBLY</text><text x="870" y="305">POWER UNIT</text><text x="1190" y="625">CHASSIS</text>
          <text x="120" y="850">TRANSPORT SYSTEM / 3D TECHNICAL DRAWING</text>
        </g>
      </svg>
      <div className="absolute left-[8%] top-[18%] h-28 w-28 rounded-full border border-cyan-300/30 shadow-[0_0_45px_rgba(70,180,255,.18)]"/>
      <div className="absolute right-[12%] top-[30%] h-40 w-40 rounded-full border border-cyan-300/20"/>
      <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/10"/>
      <div className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-[#01070d] via-transparent to-transparent"/>
    </div>
