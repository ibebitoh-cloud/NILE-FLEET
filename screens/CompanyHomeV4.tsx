import React, { useContext, useEffect, useRef, useState } from 'react';
import { LanguageContext, ThemeContext } from '../App';

interface Props { onGenset: () => void; }

/* ------------------------------------------------------------------ */
/*  Scene data (deterministic, so the port skyline never "jumps")      */
/* ------------------------------------------------------------------ */
const TILE = 2600;
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const FAR = (() => {
  const r = rng(7);
  const items: { x: number; w: number; h: number; win: number[] }[] = [];
  let x = 0;
  while (x < TILE) {
    const w = 30 + r() * 70;
    items.push({ x, w, h: 40 + r() * 150, win: Array.from({ length: 8 }, () => r()) });
    x += w + r() * 14;
  }
  return items;
})();
const FAR_CRANES = [420, 1500, 2300];

const MID = (() => {
  const r = rng(21);
  const stacks: { x: number; cols: number; rows: number; c: number }[] = [];
  let x = 0;
  while (x < TILE) {
    const cols = 1 + Math.floor(r() * 3);
    stacks.push({ x, cols, rows: 1 + Math.floor(r() * 4), c: Math.floor(r() * 4) });
    x += cols * 70 + 30 + r() * 40;
  }
  return stacks;
})();
const MID_CRANES = [700, 1900];

const STARS = (() => {
  const r = rng(99);
  return Array.from({ length: 120 }, () => ({ x: r(), y: r() * 0.62, s: 0.5 + r() * 1.4, p: r() * 6.28 }));
})();
const STREAKS = (() => {
  const r = rng(5);
  return Array.from({ length: 16 }, () => ({ y: 0.25 + r() * 0.7, k: 0.7 + r() * 0.8, o: r() }));
})();
const CLOUDS = (() => {
  const r = rng(13);
  return Array.from({ length: 7 }, () => ({ x: r() * 2400, y: 0.06 + r() * 0.28, w: 140 + r() * 180, a: 0.55 + r() * 0.35 }));
})();

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ */
/*  Canvas drawing helpers                                            */
/* ------------------------------------------------------------------ */
const drawCrane = (ctx: CanvasRenderingContext2D, x: number, g: number, h: number, color: string) => {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 42, g); ctx.lineTo(x - 14, g - h);
  ctx.moveTo(x + 42, g); ctx.lineTo(x + 14, g - h);
  ctx.moveTo(x - 30, g - h * 0.45); ctx.lineTo(x + 30, g - h * 0.45);
  ctx.stroke();
  ctx.fillRect(x - 150, g - h - 6, 390, 9); // boom
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, g - h - 6); ctx.lineTo(x + 150, g - h - 6 - 40); ctx.lineTo(x + 240, g - h - 6);
  ctx.moveTo(x, g - h - 6); ctx.lineTo(x - 90, g - h - 6 - 30); ctx.lineTo(x - 150, g - h - 6);
  ctx.stroke();
};

const drawWheel = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, dark: boolean) => {
  ctx.fillStyle = '#07090c'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dark ? '#1c2530' : '#2b3644'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#b8bfca'; ctx.beginPath(); ctx.arc(x, y, r * 0.46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4b5563';
  for (let i = 0; i < 5; i++) {
    const a = ang + (i * Math.PI * 2) / 5;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28, 2.6, 0, Math.PI * 2); ctx.fill();
  }
};

interface TruckOpts { s: number; tx: number; gy: number; dark: boolean; wheel: number; bob: number; tilt: number; headA: number; horn: number; }

const drawTruck = (ctx: CanvasRenderingContext2D, o: TruckOpts) => {
  const { s, tx, gy, dark, wheel, bob, tilt, headA, horn } = o;
  ctx.save();
  ctx.translate(tx, gy);
  // ground shadow (stays on the road)
  ctx.fillStyle = dark ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(-120 * s, 5 * s, 300 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();

  ctx.translate(0, bob);
  ctx.rotate(tilt);
  ctx.scale(s, s);

  // realistic trailer chassis + suspension rails
  ctx.fillStyle = '#080b10'; ctx.fillRect(-390, -82, 365, 16);
  ctx.fillStyle = '#1b232d'; ctx.fillRect(-380, -68, 330, 5);
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
  for (let x = -370; x < -45; x += 38) { ctx.beginPath(); ctx.moveTo(x, -80); ctx.lineTo(x + 8, -66); ctx.stroke(); }
  // container
  const cg = ctx.createLinearGradient(0, -198, 0, -80);
  cg.addColorStop(0, '#dcc197'); cg.addColorStop(1, '#a58248');
  ctx.fillStyle = cg; ctx.fillRect(-380, -198, 340, 118);
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2;
  for (let x = -368; x < -45; x += 20) { ctx.beginPath(); ctx.moveTo(x, -192); ctx.lineTo(x, -86); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-380, -198, 340, 6); ctx.fillRect(-380, -86, 340, 6);
  ctx.fillStyle = '#0b1b2c'; ctx.textAlign = 'center';
  ctx.font = 'italic 900 38px system-ui, Arial, sans-serif'; ctx.fillText('NILE FLEET', -210, -132);
  ctx.font = '800 11px system-ui, Arial, sans-serif'; ctx.fillText('TRANSPORT · LOGISTICS · EGYPT', -210, -110);
  // tail lights
  ctx.fillStyle = '#ff2b2b'; ctx.fillRect(-384, -100, 6, 16);

  // cab — layered bodywork, grille, bumper and mirrors
  ctx.fillStyle = dark ? '#0b2743' : '#173f68';
  ctx.beginPath(); ctx.moveTo(-32, -66); ctx.lineTo(-32, -178); ctx.lineTo(52, -178); ctx.lineTo(86, -118); ctx.lineTo(132, -108); ctx.lineTo(136, -66); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c2a378'; ctx.fillRect(-32, -92, 168, 7);
  ctx.fillStyle = dark ? '#06111c' : '#a8d4f2';
  ctx.beginPath(); ctx.moveTo(-8, -168); ctx.lineTo(48, -168); ctx.lineTo(76, -122); ctx.lineTo(-8, -122); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.moveTo(6, -168); ctx.lineTo(26, -168); ctx.lineTo(4, -122); ctx.lineTo(-8, -122); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#071018'; ctx.fillRect(120, -92, 18, 28);
  ctx.fillStyle = '#101a23'; ctx.fillRect(126, -88, 11, 21);
  ctx.fillStyle = '#b8c0ca'; ctx.fillRect(127, -72, 9, 2);
  // front grille / bumper
  ctx.fillStyle = '#111820'; ctx.fillRect(118, -66, 23, 9);
  ctx.strokeStyle = '#46515d'; ctx.lineWidth = 1;
  for (let yy = -64; yy > -69; yy -= 2) { ctx.beginPath(); ctx.moveTo(120, yy); ctx.lineTo(139, yy); ctx.stroke(); }
  ctx.fillStyle = '#05080b'; ctx.fillRect(133, -55, 12, 5);
  // side mirror
  ctx.strokeStyle = '#222b35'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(73,-124); ctx.lineTo(92,-132); ctx.stroke();
  ctx.fillStyle = '#070b10'; ctx.beginPath(); ctx.ellipse(94,-134,8,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#8a94a3'; ctx.fillRect(-26, -236, 7, 62); // exhaust stack
  ctx.fillStyle = '#9aa4b2'; ctx.fillRect(28, -66, 48, 16); // fuel tank

  // headlight beam (follows the mouse height)
  const L = 1500, sp = 0.14;
  const hx = 130, hy = -100;
  const bg = ctx.createLinearGradient(hx, hy, hx + Math.cos(headA) * L, hy + Math.sin(headA) * L);
  bg.addColorStop(0, dark ? 'rgba(255,244,205,.6)' : 'rgba(255,238,170,.34)');
  bg.addColorStop(1, 'rgba(255,244,205,0)');
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(headA - sp) * L, hy + Math.sin(headA - sp) * L);
  ctx.lineTo(hx + Math.cos(headA + sp) * L, hy + Math.sin(headA + sp) * L);
  ctx.closePath(); ctx.fill();
  const lg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 70);
  lg.addColorStop(0, 'rgba(255,248,215,.95)'); lg.addColorStop(1, 'rgba(255,248,215,0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(hx, hy, 70, 0, Math.PI * 2); ctx.fill();
  if (dark) { // tail light glow
    const tg = ctx.createRadialGradient(-384, -92, 0, -384, -92, 40);
    tg.addColorStop(0, 'rgba(255,40,40,.55)'); tg.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(-384, -92, 40, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.ellipse(hx, hy, 7, 5, 0, 0, Math.PI * 2); ctx.fill();

  // wheels with visible hubs / tire sidewalls
  for (const wx of [-322, -272, -4, 92]) drawWheel(ctx, wx, -32, 32, wheel, dark);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (const wx of [-322, -272, -4, 92]) { ctx.beginPath(); ctx.arc(wx - 8, -43, 5, 0, Math.PI * 2); ctx.fill(); }

  // horn sound rings
  if (horn > 0) {
    for (let i = 0; i < 3; i++) {
      const p = 1 - horn / 0.7;
      ctx.strokeStyle = `rgba(194,163,120,${Math.max(0, horn * 0.9 - i * 0.15)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(40, -190, 30 + p * 200 + i * 34, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
    }
  }
  ctx.restore();
};


/* Front-facing truck: the cab is aimed directly at the viewer and scales with scroll,
   creating a "driving toward you" effect instead of a side-on truck. */
const drawFrontTruck = (ctx: CanvasRenderingContext2D, o: {
  s: number; tx: number; gy: number; dark: boolean; wheel: number; bob: number; tilt: number; headA: number; horn: number;
}) => {
  const { s, tx, gy, dark, wheel, bob, tilt, horn } = o;
  ctx.save();
  ctx.translate(tx, gy);
  ctx.translate(0, bob);
  ctx.rotate(tilt);
  ctx.scale(s, s);

  // Road shadow / contact
  ctx.fillStyle = dark ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 190, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rear trailer silhouette visible behind the cab
  const trailer = ctx.createLinearGradient(-125, -250, 125, -250);
  trailer.addColorStop(0, '#172331'); trailer.addColorStop(.5, '#304354'); trailer.addColorStop(1, '#111a24');
  ctx.fillStyle = trailer;
  ctx.beginPath();
  ctx.roundRect(-125, -390, 250, 180, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(194,163,120,.45)'; ctx.lineWidth = 3;
  ctx.strokeRect(-112, -375, 224, 150);
  ctx.fillStyle = '#c2a378';
  ctx.font = '900 19px system-ui,Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NILE FLEET', 0, -300);
  ctx.font = '700 8px system-ui,Arial';
  ctx.fillText('TRANSPORT · LOGISTICS · EGYPT', 0, -281);

  // Cab main shell — wide, tapered, forward-facing
  const body = ctx.createLinearGradient(-155, -250, 155, -40);
  body.addColorStop(0, dark ? '#071827' : '#173f68');
  body.addColorStop(.45, dark ? '#16446c' : '#2d6090');
  body.addColorStop(1, dark ? '#06111b' : '#102f50');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-150, -65);
  ctx.lineTo(-140, -210);
  ctx.quadraticCurveTo(-132, -255, -90, -275);
  ctx.lineTo(90, -275);
  ctx.quadraticCurveTo(132, -255, 140, -210);
  ctx.lineTo(150, -65);
  ctx.quadraticCurveTo(105, -42, 0, -38);
  ctx.quadraticCurveTo(-105, -42, -150, -65);
  ctx.closePath();
  ctx.fill();

  // Roof highlight and windshield surround
  ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-88,-268); ctx.quadraticCurveTo(0,-292,88,-268); ctx.stroke();
  ctx.fillStyle = dark ? '#06101a' : '#a8d4f2';
  ctx.beginPath();
  ctx.moveTo(-105, -245); ctx.quadraticCurveTo(0, -264, 105, -245);
  ctx.lineTo(94, -145); ctx.quadraticCurveTo(0, -158, -94, -145);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dark ? '#31495d' : '#6f8ca5'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0,-260); ctx.lineTo(0,-153); ctx.stroke();

  // Windshield reflections
  const rg = ctx.createLinearGradient(-95,-245,75,-160);
  rg.addColorStop(0,'rgba(255,255,255,.24)'); rg.addColorStop(.35,'rgba(255,255,255,.04)'); rg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(-96,-240); ctx.lineTo(-12,-255); ctx.lineTo(-12,-155); ctx.lineTo(-90,-147); ctx.closePath(); ctx.fill();

  // Side mirrors
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#1c2732'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(side * 112, -178); ctx.lineTo(side * 155, -195); ctx.stroke();
    ctx.fillStyle = '#050a0f';
    ctx.beginPath(); ctx.roundRect(side * 165 - (side > 0 ? 0 : 18), -213, 20, 32, 5); ctx.fill();
    ctx.fillStyle = '#657383';
    ctx.fillRect(side * 164 - (side > 0 ? 0 : 14), -207, 12, 17);
  }

  // Front fascia / grille
  ctx.fillStyle = dark ? '#080d12' : '#17212b';
  ctx.beginPath();
  ctx.roundRect(-116, -135, 232, 95, 18);
  ctx.fill();
  ctx.fillStyle = '#0b1219';
  ctx.beginPath();
  ctx.roundRect(-88, -116, 176, 62, 12);
  ctx.fill();

  // Grille slats
  ctx.strokeStyle = dark ? '#465463' : '#68737f'; ctx.lineWidth = 2;
  for (let y = -108; y <= -60; y += 9) {
    ctx.beginPath(); ctx.moveTo(-74, y); ctx.lineTo(74, y); ctx.stroke();
  }
  for (let x = -70; x <= 70; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, -110); ctx.lineTo(x, -58); ctx.stroke();
  }

  // Headlamp housings + animated beams
  const beam = ctx.createRadialGradient(-88, -145, 2, -88, -145, 65);
  beam.addColorStop(0, 'rgba(255,249,214,.95)'); beam.addColorStop(1, 'rgba(255,249,214,0)');
  ctx.fillStyle = beam; ctx.beginPath(); ctx.arc(-88,-145,65,0,Math.PI*2); ctx.fill();
  const beam2 = ctx.createRadialGradient(88, -145, 2, 88, -145, 65);
  beam2.addColorStop(0, 'rgba(255,249,214,.95)'); beam2.addColorStop(1, 'rgba(255,249,214,0)');
  ctx.fillStyle = beam2; ctx.beginPath(); ctx.arc(88,-145,65,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff9d6';
  ctx.beginPath(); ctx.roundRect(-105,-159,34,24,8); ctx.fill();
  ctx.beginPath(); ctx.roundRect(71,-159,34,24,8); ctx.fill();
  ctx.fillStyle = '#c2a378';
  ctx.fillRect(-106,-129,36,4); ctx.fillRect(70,-129,36,4);

  // Bumper + tow plate
  ctx.fillStyle = '#080d12'; ctx.beginPath(); ctx.roundRect(-142,-52,284,24,8); ctx.fill();
  ctx.fillStyle = '#9ca6b2'; ctx.fillRect(-48,-48,96,10);
  ctx.fillStyle = '#0a1118'; ctx.fillRect(-34,-46,68,7);
  ctx.fillStyle = '#c2a378'; ctx.fillRect(-6,-45,12,5);

  // Front tires, hubs and mudguards
  for (const side of [-1, 1]) {
    const wx = side * 132, wy = -38, wr = 43;
    ctx.fillStyle = '#05070a';
    ctx.beginPath(); ctx.ellipse(wx, wy, wr, wr * 1.15, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2c3743'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#aeb7c1'; ctx.beginPath(); ctx.arc(wx,wy,18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#596575'; ctx.beginPath(); ctx.arc(wx,wy,7,0,Math.PI*2); ctx.fill();
    for (let i=0;i<6;i++) {
      const a = wheel + i*Math.PI/3;
      ctx.strokeStyle = '#66717e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(a)*8, wy + Math.sin(a)*8); ctx.lineTo(wx + Math.cos(a)*15, wy + Math.sin(a)*15); ctx.stroke();
    }
    ctx.fillStyle = dark ? '#102338' : '#315a7e';
    ctx.beginPath(); ctx.arc(wx, -63, 48, Math.PI, 0); ctx.fill();
  }

  // Lower body details / steps
  ctx.fillStyle = dark ? '#10202d' : '#244e73';
  ctx.fillRect(-118,-28,236,9);
  ctx.fillStyle = '#c2a378'; ctx.fillRect(-108,-24,216,3);
  ctx.fillStyle = '#111a22';
  ctx.fillRect(-151,-20,42,14); ctx.fillRect(109,-20,42,14);

  if (horn > 0) {
    const p = 1 - horn / 0.7;
    for (let i=0;i<3;i++) {
      ctx.strokeStyle = `rgba(194,163,120,${Math.max(0, horn * .9 - i * .15)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,-205,55 + p*130 + i*25, -Math.PI*.9, -Math.PI*.1); ctx.stroke();
    }
  }
  ctx.restore();
};

/* ------------------------------------------------------------------ */
/*  Small scroll-reveal helper                                        */
/* ------------------------------------------------------------------ */
const Reveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-1000 ease-out ${on ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} ${className}`}>{children}</div>;
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
const PARTNER_LOGOS = [
  { name: 'Egytrans', type: 'TRANSPORT & LOGISTICS', url: 'https://egytrans.com/', logo: 'https://www.google.com/s2/favicons?domain=egytrans.com&sz=128' },
  { name: 'NOSCO', type: 'TRANSPORT & LOGISTICS', url: 'http://www.noscoegypt.com/', logo: 'https://www.google.com/s2/favicons?domain=noscoegypt.com&sz=128' },
  { name: 'Nautic Logistics', type: 'LOGISTICS & TRANSPORT', url: 'http://www.nauticlog.com/', logo: 'https://www.google.com/s2/favicons?domain=nauticlog.com&sz=128' },
  { name: 'Egyptian United / Egytride', type: 'LOGISTICS SERVICES', url: 'http://www.egytridealex.com/', logo: 'https://www.google.com/s2/favicons?domain=egytridealex.com&sz=128' },
  { name: 'El Bedaya Logistics', type: 'INTERNATIONAL TRANSPORT', url: 'https://elbedayalogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=elbedayalogistics.com&sz=128' },
  { name: 'National Freight', type: 'FREIGHT & LOGISTICS', url: 'http://www.nfreight.net/', logo: 'https://www.google.com/s2/favicons?domain=nfreight.net&sz=128' },
  { name: '2BS Cargo Egypt', type: 'CARGO & LOGISTICS', url: 'http://www.2bscargoegypt.com/', logo: 'https://www.google.com/s2/favicons?domain=2bscargoegypt.com&sz=128' },
  { name: 'Commander Cargo', type: 'CARGO & LOGISTICS', url: 'http://www.commandercargo.com/', logo: 'https://www.google.com/s2/favicons?domain=commandercargo.com&sz=128' },
  { name: 'Compact Logistics', type: 'LOGISTICS', url: 'http://www.compactlogisticseg.com/', logo: 'https://www.google.com/s2/favicons?domain=compactlogisticseg.com&sz=128' },
  { name: 'CFS Egypt', type: 'FREIGHT SERVICES', url: 'http://www.cfsegypt.com/', logo: 'https://www.google.com/s2/favicons?domain=cfsegypt.com&sz=128' },
  { name: 'COPAM Logistics', type: 'LOGISTICS INTERNATIONAL', url: 'http://www.cli-logistics.com/', logo: 'https://www.google.com/s2/favicons?domain=cli-logistics.com&sz=128' },
  { name: 'Nano Logistics Egypt', type: 'LOGISTICS', url: 'https://nlegypt.com/', logo: 'https://www.google.com/s2/favicons?domain=nlegypt.com&sz=128' },
  { name: 'LATT', type: 'SHIPPING & LOGISTICS', url: 'https://www.latt.com.eg/', logo: 'https://www.google.com/s2/favicons?domain=www.latt.com.eg&sz=128' },
  { name: 'GSS Shipping', type: 'SHIPPING AGENCY', url: 'https://gssshipping-eg.com/', logo: 'https://www.google.com/s2/favicons?domain=gssshipping-eg.com&sz=128' },
  { name: 'Maersk', type: 'SHIPPING LINE', url: 'https://www.maersk.com/', logo: 'https://www.google.com/s2/favicons?domain=maersk.com&sz=128' },
  { name: 'CMA CGM', type: 'SHIPPING & LOGISTICS', url: 'https://www.cma-cgm.com/', logo: 'https://www.google.com/s2/favicons?domain=cma-cgm.com&sz=128' },
  { name: 'Hapag-Lloyd', type: 'SHIPPING LINE', url: 'https://www.hapag-lloyd.com/', logo: 'https://www.google.com/s2/favicons?domain=hapag-lloyd.com&sz=128' },
  { name: 'COSCO Shipping', type: 'SHIPPING LINE', url: 'https://lines.coscoshipping.com/', logo: 'https://www.google.com/s2/favicons?domain=coscoshipping.com&sz=128' },
  { name: 'ONE', type: 'SHIPPING LINE', url: 'https://www.one-line.com/', logo: 'https://www.google.com/s2/favicons?domain=one-line.com&sz=128' },
  { name: 'MSC', type: 'SHIPPING LINE', url: 'https://www.msc.com/', logo: 'https://www.google.com/s2/favicons?domain=msc.com&sz=128' },
  { name: 'GAC', type: 'SHIPPING & LOGISTICS', url: 'https://www.gac.com/', logo: 'https://www.google.com/s2/favicons?domain=gac.com&sz=128' },
  { name: 'Inchcape Shipping', type: 'SHIPPING SERVICES', url: 'https://www.iss-shipping.com/', logo: 'https://www.google.com/s2/favicons?domain=iss-shipping.com&sz=128' },
  { name: 'Fairtrans Marine', type: 'FREIGHT FORWARDING', url: 'https://www.fairtransmarine.com/', logo: 'https://www.google.com/s2/favicons?domain=fairtransmarine.com&sz=128' },
  { name: 'Kadmar Shipping', type: 'SHIPPING AGENCY', url: 'https://www.kadmar.com/', logo: 'https://www.google.com/s2/favicons?domain=www.kadmar.com&sz=128' },
  { name: 'CEVA Logistics Egypt', type: 'LOGISTICS', url: 'https://www.cevalogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=cevalogistics.com&sz=128' },
  { name: 'Agility Logistics Egypt', type: 'LOGISTICS & FREIGHT', url: 'https://www.agility.com/', logo: 'https://www.google.com/s2/favicons?domain=agility.com&sz=128' },
  { name: 'DHL Express Egypt', type: 'EXPRESS & LOGISTICS', url: 'https://www.dhl.com/eg-en/home.html', logo: 'https://www.google.com/s2/favicons?domain=dhl.com&sz=128' },
  { name: 'Aramex Egypt', type: 'EXPRESS & LOGISTICS', url: 'https://www.aramex.com/', logo: 'https://www.google.com/s2/favicons?domain=aramex.com&sz=128' },
  { name: 'Raya Logistics', type: 'LOGISTICS', url: 'https://www.rayalogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=rayalogistics.com&sz=128' },
  { name: 'EgyMar', type: 'SHIPPING & LOGISTICS', url: 'https://egymar.com/', logo: 'https://www.google.com/s2/favicons?domain=egymar.com&sz=128' },
  { name: 'Transmar', type: 'CONTAINER SHIPPING', url: 'https://www.transmar.com/', logo: 'https://www.google.com/s2/favicons?domain=transmar.com&sz=128' },
  { name: 'Blue Sky Logistics', type: 'LOGISTICS', url: 'https://www.blueskylogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=blueskylogistics.com&sz=128' },
  { name: 'Egyptian Global Logistics', type: 'LOGISTICS', url: 'https://www.egl-eg.com/', logo: 'https://www.google.com/s2/favicons?domain=egl-eg.com&sz=128' },
  { name: 'AIM Logistics', type: 'LOGISTICS', url: 'https://www.aimlogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=aimlogistics.com&sz=128' },
  { name: 'First Global Logistics', type: 'LOGISTICS', url: 'https://www.firstgloballogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=firstgloballogistics.com&sz=128' },
  { name: 'INEX Logistics', type: 'LOGISTICS', url: 'https://www.inexlogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=inexlogistics.com&sz=128' },
  { name: 'Sphinx Logistics', type: 'FREIGHT FORWARDING', url: 'https://www.sphinxlogistics.com/', logo: 'https://www.google.com/s2/favicons?domain=sphinxlogistics.com&sz=128' },
  { name: 'Martico Egypt', type: 'ROAD FREIGHT', url: 'https://marticogroup.com/contact/egypt/', logo: 'https://www.google.com/s2/favicons?domain=marticogroup.com&sz=128' },
  { name: 'Freight Link Egypt', type: 'TRUCKING & FREIGHT', url: 'https://freightlinkegypt.com/', logo: 'https://www.google.com/s2/favicons?domain=freightlinkegypt.com&sz=128' },
  { name: 'USCO Log', type: 'TRUCK TRANSPORTATION', url: 'https://www.usco-log.com/', logo: 'https://www.google.com/s2/favicons?domain=usco-log.com&sz=128' },
  { name: 'TransGlobe', type: 'TRANSPORT & LOGISTICS', url: 'https://www.transglobe.com/', logo: 'https://www.google.com/s2/favicons?domain=transglobe.com&sz=128' },
  { name: 'Link Cargo', type: 'TRUCK TRANSPORTATION', url: 'https://linkcargo.com/', logo: 'https://www.google.com/s2/favicons?domain=linkcargo.com&sz=128' },
  { name: 'HVO Logistics', type: 'TRUCK TRANSPORTATION', url: 'https://hvo-logistics.com/', logo: 'https://www.google.com/s2/favicons?domain=hvo-logistics.com&sz=128' },
  { name: 'Rady Trans', type: 'TRUCK TRANSPORTATION', url: 'https://radytrans.com/', logo: 'https://www.google.com/s2/favicons?domain=radytrans.com&sz=128' },
  { name: '2M Transportation', type: 'TRANSPORT SERVICES', url: 'https://www.2mtransportation.com/', logo: 'https://www.google.com/s2/favicons?domain=2mtransportation.com&sz=128' },
  { name: 'Freight & Logistics Egypt', type: 'FREIGHT TRANSPORT', url: 'https://www.fle.com.eg/', logo: 'https://www.google.com/s2/favicons?domain=fle.com.eg&sz=128' },
];

const CompanyHomeV4: React.FC<Props> = ({ onGenset }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const { isDark, setTheme } = useContext(ThemeContext);
  const ar = lang === 'ar';

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef(isDark);
  darkRef.current = isDark;

  const [soundOn, setSoundOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const soundOnRef = useRef(false);
  const [hud, setHud] = useState({ kmh: 25, km: 0 });

  // ---- audio -------------------------------------------------------
  type Audio = { ctx: AudioContext; master: GainNode; o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; eg: GainNode; wf: BiquadFilterNode; wg: GainNode; noise: AudioBuffer };
  const audioRef = useRef<Audio | null>(null);

  const startAudio = () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = audioRef.current?.ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    if (audioRef.current) { audioRef.current.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.1); return; }
    const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.2);
    // engine: two detuned saws through a low-pass
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 2;
    const eg = ctx.createGain(); eg.gain.value = 0.06;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 40;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 20.5;
    o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master); o1.start(); o2.start();
    // wind: looped noise through a band-pass
    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0;
    src.connect(wf); wf.connect(wg); wg.connect(master); src.start();
    audioRef.current = { ctx, master, o1, o2, lp, eg, wf, wg, noise };
  };

  const stopAudio = () => {
    const a = audioRef.current;
    if (a) a.master.gain.setTargetAtTime(0.0001, a.ctx.currentTime, 0.08);
  };

  const playHorn = () => {
    const a = audioRef.current;
    if (!a) return;
    const { ctx, master } = a;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
    g.gain.setValueAtTime(0.32, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    [349, 440].forEach(fr => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
      o.connect(f); o.start(t); o.stop(t + 0.75);
    });
    f.connect(g); g.connect(master);
  };

  const playWhoosh = () => {
    const a = audioRef.current;
    if (!a) return;
    const { ctx, master, noise } = a;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.6);
  };

  const toggleSound = () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    if (next) { startAudio(); setTimeout(playHorn, 120); } else stopAudio();
  };

  useEffect(() => () => {
    const a = audioRef.current;
    if (a) { try { a.o1.stop(); a.o2.stop(); void a.ctx.close(); } catch { /* already closed */ } audioRef.current = null; }
  }, []);

  // ---- simulation + render loop -----------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const sim = {
      worldX: 0, speed: 160, impulse: 0, wheel: 0, mx: 0.5, my: 0.5, smx: 0.5, smy: 0.5,
      approach: 0, approachTarget: 0, horn: 0, lastWhoosh: 0, km: 0, hudT: 0, t: 0, lastScroll: window.scrollY,
      smoke: [] as { x: number; y: number; r: number; life: number }[],
      box: { x0: 0, y0: 0, x1: 0, y1: 0 },
    };

    const onMove = (e: MouseEvent) => {
      sim.mx = e.clientX / W; sim.my = e.clientY / H;
      const b = sim.box;
      const inside = e.clientX > b.x0 && e.clientX < b.x1 && e.clientY > b.y0 && e.clientY < b.y1;
      if (wrapRef.current) wrapRef.current.style.cursor = inside ? 'pointer' : '';
    };
    const onScroll = () => {
      const y = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      sim.approachTarget = clamp(y / maxScroll, 0, 1);
      sim.impulse += Math.abs(y - sim.lastScroll);
      sim.lastScroll = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (barRef.current) barRef.current.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button,a,input')) return;
      const b = sim.box;
      if (e.clientX > b.x0 && e.clientX < b.x1 && e.clientY > b.y0 && e.clientY < b.y1) {
        sim.horn = 0.7;
        if (soundOnRef.current) playHorn();
      }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointerdown', onDown);
    onScroll();

    const render = () => {
      const dark = darkRef.current;
      const sN = clamp((sim.speed - 160) / 1340, 0, 1);
      const t = sim.t;
      const ox = (sim.smx - 0.5);
      ctx.save();
      if (sN > 0.35) ctx.translate((Math.random() - 0.5) * sN * 3, (Math.random() - 0.5) * sN * 3);

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
      if (dark) { sky.addColorStop(0, '#01030a'); sky.addColorStop(0.55, '#07121f'); sky.addColorStop(1, '#14304a'); }
      else { sky.addColorStop(0, '#5aaef7'); sky.addColorStop(0.6, '#bfe3ff'); sky.addColorStop(1, '#fff3da'); }
      ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, H + 20);

      if (dark) {
        for (const s of STARS) {
          const a = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + s.p));
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(s.x * W - ox * 14 * s.s, s.y * H, s.s, s.s);
        }
        const mg = ctx.createRadialGradient(W * 0.78 - ox * 24, H * 0.2, 0, W * 0.78 - ox * 24, H * 0.2, 120);
        mg.addColorStop(0, 'rgba(255,244,214,.9)'); mg.addColorStop(0.3, 'rgba(255,244,214,.25)'); mg.addColorStop(1, 'rgba(255,244,214,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(W * 0.78 - ox * 24, H * 0.2, 120, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f6efd9'; ctx.beginPath(); ctx.arc(W * 0.78 - ox * 24, H * 0.2, 30, 0, Math.PI * 2); ctx.fill();
      } else {
        const sx = W * 0.78 - ox * 24, sy = H * 0.2;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 200);
        sg.addColorStop(0, 'rgba(255,240,170,.95)'); sg.addColorStop(0.25, 'rgba(255,230,140,.4)'); sg.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 200, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.arc(sx, sy, 38, 0, Math.PI * 2); ctx.fill();
        for (const c of CLOUDS) {
          const cx = ((c.x - sim.worldX * 0.03 - ox * 30) % (W + 500) + (W + 500)) % (W + 500) - 250;
          ctx.fillStyle = `rgba(255,255,255,${c.a})`;
          ctx.beginPath(); ctx.ellipse(cx, c.y * H, c.w, c.w * 0.18, 0, 0, Math.PI * 2); ctx.ellipse(cx + c.w * 0.4, c.y * H - 10, c.w * 0.6, c.w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        }
      }

      const layerBase = (p: number, k: number) => -((sim.worldX * p) % TILE) - ox * p * 90 + k * TILE;
      const tiles = Math.ceil(W / TILE) + 1;

      // far port skyline
      const gFar = H * 0.7;
      for (let k = 0; k < tiles; k++) {
        const base = layerBase(0.06, k);
        ctx.fillStyle = dark ? '#0a1826' : '#aebfd1';
        for (const b of FAR) {
          const x = base + b.x;
          if (x < -160 || x > W + 60) continue;
          ctx.fillRect(x, gFar - b.h, b.w, b.h);
          if (dark) {
            ctx.fillStyle = 'rgba(255,214,140,.55)';
            b.win.forEach((v, i) => { if (v > 0.55) ctx.fillRect(x + 5 + (i % 4) * (b.w / 4.5), gFar - b.h + 10 + Math.floor(i / 4) * 18, 3, 4); });
            ctx.fillStyle = '#0a1826';
          }
        }
        for (const cx of FAR_CRANES) { const x = base + cx; if (x > -320 && x < W + 320) drawCrane(ctx, x, gFar, 230, dark ? '#0d2033' : '#93a8bd'); }
      }
      ctx.fillStyle = dark ? '#0a1826' : '#aebfd1'; ctx.fillRect(-10, gFar, W + 20, H);

      // mid container yard
      const gMid = H * 0.755;
      const palD = ['#1b2b3c', '#3a2f22', '#22352b', '#3b2226'];
      const palL = ['#7f9bb8', '#d0a96b', '#86b096', '#cc8686'];
      for (let k = 0; k < tiles; k++) {
        const base = layerBase(0.22, k);
        for (const s of MID) {
          const x = base + s.x;
          if (x < -320 || x > W + 60) continue;
          ctx.fillStyle = (dark ? palD : palL)[s.c];
          for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
            ctx.fillRect(x + c * 70, gMid - (r + 1) * 36, 66, 33);
          }
        }
        for (const cx of MID_CRANES) { const x = base + cx; if (x > -320 && x < W + 320) drawCrane(ctx, x, gMid, 300, dark ? '#132a40' : '#6f8aa5'); }
      }

      // Road follows the truck's lane/position so the vehicle never looks detached
      // from the roadway when scrolling between sections.
      const baseScale = clamp(Math.min(W / 1500, H / 900), 0.5, 1.15);
      const roadApproach = sim.approach;
      const truckGy = H * (0.84 + roadApproach * 0.045);
      const gRoad = clamp(truckGy + 38 * baseScale, H * 0.72, H * 0.88);
      const road = ctx.createLinearGradient(0, gRoad, 0, H);
      if (dark) { road.addColorStop(0, '#0c1218'); road.addColorStop(1, '#04060a'); } else { road.addColorStop(0, '#5b6472'); road.addColorStop(1, '#3a4250'); }
      ctx.fillStyle = road; ctx.fillRect(-10, gRoad, W + 20, H - gRoad + 10);
      ctx.fillStyle = dark ? 'rgba(194,163,120,.55)' : 'rgba(255,255,255,.85)'; ctx.fillRect(-10, gRoad + 4, W + 20, 3);
      ctx.fillRect(-10, H - 26, W + 20, 3);
      const dashY = H * 0.93;
      const off = -((sim.worldX) % 130);
      ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.95)';
      for (let x = off - 130; x < W + 130; x += 130) ctx.fillRect(x - ox * 40, dashY, 74, 6);

      // roadside lamp posts
      const spacing = 520;
      const pOff = -((sim.worldX * 0.6 + ox * 60) % spacing);
      for (let x = pOff - spacing; x < W + spacing; x += spacing) {
        ctx.fillStyle = dark ? '#111a24' : '#4b5563';
        ctx.fillRect(x, gRoad - 210, 6, 214);
        ctx.fillRect(x, gRoad - 210, 44, 5);
        if (dark) {
          ctx.globalCompositeOperation = 'lighter';
          const lg = ctx.createRadialGradient(x + 44, gRoad - 200, 0, x + 44, gRoad - 200, 130);
          lg.addColorStop(0, 'rgba(255,214,140,.55)'); lg.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x + 44, gRoad - 200, 130, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Truck: side profile, visibly travelling from left -> right.
      // Scroll changes speed/position, while the road uses the exact same lane Y.
      const s = clamp(Math.min(W / 1500, H / 900), 0.5, 1.15);
      const approach = sim.approach;
      const tx = ((sim.worldX * 0.9 + W * 0.18) % (W + 760)) - 430;
      const gy = truckGy;
      const accel = clamp((sim.impulse * 18 + 160) - sim.speed, -400, 900);
      const bob = Math.sin(t * 22) * sN * 1.8 + Math.sin(t * 6) * 0.7 + (sim.horn > 0 ? Math.sin(t * 60) * 1.2 : 0);
      const tilt = -accel * 0.000022;
      const lightScreenY = gy - 100 * s;
      const headA = 0.05 + clamp((sim.smy * H - lightScreenY) / (H * 0.9), -0.28, 0.28);
      drawTruck(ctx, { s, tx, gy, dark, wheel: sim.wheel, bob, tilt, headA, horn: sim.horn });
      sim.box = { x0: tx - 405 * s, y0: gy - 245 * s, x1: tx + 155 * s, y1: gy + 10 * s };

      // exhaust smoke
      for (const p of sim.smoke) {
        ctx.fillStyle = dark ? `rgba(160,175,195,${p.life * 0.22})` : `rgba(90,100,115,${p.life * 0.25})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }

      // speed streaks
      if (sN > 0.2) {
        ctx.strokeStyle = dark ? `rgba(255,255,255,${0.3 * sN})` : `rgba(255,255,255,${0.7 * sN})`;
        ctx.lineWidth = 1.5;
        for (const st of STREAKS) {
          const x = (((st.o * W) + t * sim.speed * st.k) % (W + 400)) - 200;
          const len = 60 + sN * 240;
          ctx.beginPath(); ctx.moveTo(W - x, st.y * H); ctx.lineTo(W - x + len, st.y * H); ctx.stroke();
        }
      }

      // cursor light
      const mxp = sim.smx * W, myp = sim.smy * H;
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const cg = ctx.createRadialGradient(mxp, myp, 0, mxp, myp, 260);
      cg.addColorStop(0, dark ? 'rgba(194,163,120,.20)' : 'rgba(255,214,120,.30)'); cg.addColorStop(1, 'rgba(194,163,120,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(mxp, myp, 260, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark ? 'rgba(0,0,0,.55)' : 'rgba(20,40,70,.16)');
      ctx.fillStyle = vg; ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.restore();

      return { s, tx, gy };
    };

    let raf = 0;
    let last = performance.now();
    const step = (dt: number) => {
      sim.t += dt;
      sim.smx += (sim.mx - sim.smx) * Math.min(1, dt * 6);
      sim.smy += (sim.my - sim.smy) * Math.min(1, dt * 6);
      sim.approach += (sim.approachTarget - sim.approach) * Math.min(1, dt * 3.5);
      const target = 160 + Math.min(1340, sim.impulse * 18);
      // scroll bursts trigger a whoosh
      if (sim.impulse > 90 && sim.t - sim.lastWhoosh > 0.9) { sim.lastWhoosh = sim.t; if (soundOnRef.current) playWhoosh(); }
      sim.speed += (target - sim.speed) * Math.min(1, dt * 3);
      sim.impulse *= Math.pow(0.9, dt * 60);
      sim.worldX += sim.speed * dt;
      sim.wheel += (sim.speed * dt) / 32;
      if (sim.horn > 0) sim.horn = Math.max(0, sim.horn - dt);

      const sN = clamp((sim.speed - 160) / 1340, 0, 1);
      // smoke
      if (Math.random() < dt * (18 + sN * 50)) {
        const s = clamp(Math.min(W / 1500, H / 900), 0.5, 1.15);
        const approach = sim.approach;
        const tx = ((sim.worldX * 0.9 + W * 0.18) % (W + 760)) - 430;
        sim.smoke.push({ x: tx - 385 * s, y: H * (0.84 + approach * 0.045) - 92 * s, r: 4 + Math.random() * 4, life: 1 });
      }
      for (const p of sim.smoke) { p.x -= (sim.speed * 0.18 + 30) * dt; p.y -= (34 + sN * 30) * dt; p.r += dt * 16; p.life -= dt * 0.55; }
      sim.smoke = sim.smoke.filter(p => p.life > 0);

      // audio follows speed
      const a = audioRef.current;
      if (a && soundOnRef.current) {
        const now = a.ctx.currentTime;
        a.o1.frequency.setTargetAtTime(40 + sN * 78, now, 0.08);
        a.o2.frequency.setTargetAtTime(20.5 + sN * 39, now, 0.08);
        a.lp.frequency.setTargetAtTime(200 + sN * 900, now, 0.1);
        a.eg.gain.setTargetAtTime(0.06 + sN * 0.11, now, 0.1);
        a.wf.frequency.setTargetAtTime(420 + sN * 1900, now, 0.1);
        a.wg.gain.setTargetAtTime(sN * 0.16, now, 0.12);
      }

      // HUD (throttled)
      sim.km += (25 + sN * 95) / 3600 * dt;
      sim.hudT += dt;
      if (sim.hudT > 0.12) { sim.hudT = 0; setHud({ kmh: Math.round(25 + sN * 95), km: sim.km }); }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) { step(dt); render(); }
      raf = requestAnimationFrame(frame);
    };
    if (reduce) { render(); } else { raf = requestAnimationFrame(frame); }
    const redrawOnResize = () => { resize(); if (reduce) render(); };
    window.addEventListener('resize', redrawOnResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', redrawOnResize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  // ---- theme-dependent classes ------------------------------------
  const K = isDark
    ? { root: 'bg-[#020305] text-white', head: 'border-white/10 bg-black/55', text: 'text-white', muted: 'text-slate-400', soft: 'text-slate-300', faint: 'text-slate-500', card: 'border-white/10 bg-black/45', band: 'border-white/10 bg-black/60', line: 'border-white/15', foot: 'bg-[#00111f]/85', chip: 'border-white/10 bg-white/[.04] text-slate-300' }
    : { root: 'bg-[#dbeafe] text-[#0b1a2b]', head: 'border-black/10 bg-white/60', text: 'text-[#0b1a2b]', muted: 'text-slate-600', soft: 'text-slate-700', faint: 'text-slate-500', card: 'border-black/10 bg-white/60', band: 'border-black/10 bg-white/70', line: 'border-black/15', foot: 'bg-[#0b2a4a]/90 text-white', chip: 'border-black/10 bg-white/60 text-slate-600' };
  const gold = isDark ? 'text-[#c2a378]' : 'text-[#8a6a35]';

  const tx = {
    brandSub: ar ? 'النقل · اللوجستيات · مصر' : 'Transport · Logistics · Egypt',
    about: ar ? 'عن الشركة' : 'ABOUT',
    operations: ar ? 'العمليات' : 'OPERATIONS',
    leadership: ar ? 'القيادة' : 'LEADERSHIP',
    full: ar ? '⛶ ملء الشاشة' : '⛶ FULL',
    exit: ar ? '⛶ خروج' : '⛶ EXIT',
    soundOn: ar ? '🔊 الصوت مفعل' : '🔊 SOUND ON',
    soundOff: ar ? '🔇 الصوت متوقف' : '🔇 SOUND OFF',
    white: ar ? '☀ فاتح' : '☀ WHITE',
    dark: ar ? '🌙 داكن' : '🌙 DARK',
    gensetAccess: ar ? 'دخول الجينسيت' : 'GENSET ACCESS',
    since: ar ? 'منذ 2009 · مصر' : 'Since 2009 · Egypt',
    heroTitle: ar ? <>الشحن<br /><span className={gold}>في حركة.</span></> : <>Cargo<br /><span className={gold}>in motion.</span></>,
    explore: ar ? 'استكشف العمليات' : 'Explore Operations',
    scrollHint: ar ? 'مرر لتحريك المشهد · اضغط على الشاحنة للبوق' : 'Scroll to drive · Click the truck for the horn',
    founded: ar ? 'التأسيس' : 'FOUNDED',
    years: ar ? 'سنوات' : 'YEARS',
    coverage: ar ? 'التغطية' : 'COVERAGE',
    ops24: ar ? 'العمليات' : 'OPERATIONS',
    company: ar ? 'الشركة' : 'Company',
    built: ar ? <>مصمم من أجل<br /><span className={gold}>الطريق.</span></> : <>Built for<br /><span className={gold}>the road.</span></>,
    about1: ar ? 'نيل فليت لخدمات النقل واللوجستيات هي إحدى شركات النقل واللوجستيات الرائدة في مصر، وتقدم خدمات نقل الشاحنات والحاويات وحلولاً لوجستية متكاملة منذ عام 2009.' : 'Nile Fleet for Transport and Logistics Service is one of Egypt’s leading transportation and logistics providers, offering reliable trucking, container transportation, and integrated logistics solutions since 2009.',
    about2: ar ? 'بخبرة تتجاوز 17 عاماً في المجال، تخدم الشركة خطوط الملاحة ووكلاء الشحن والمستوردين والمصدرين والعملاء الصناعيين من خلال إدارة الأسطول وعمليات الخدمات اللوجستية بالموانئ ودعم سلاسل الإمداد.' : 'With more than 17 years of industry experience, the company supports shipping lines, freight forwarders, importers, exporters, and industrial clients through fleet management, port logistics operations, and supply chain support.',
    values: ar ? ['السلامة', 'الموثوقية', 'الرؤية التشغيلية', 'الابتكار', 'نجاح العملاء'] : ['SAFETY', 'RELIABILITY', 'VISIBILITY', 'INNOVATION', 'CUSTOMER SUCCESS'],
    oneFleet: ar ? <>أسطول واحد.<br /><span className={gold}>مهام متعددة.</span></> : <>One fleet.<br /><span className={gold}>Many missions.</span></>,
    opsDesc: ar ? 'من النقل البري إلى عمليات الجينسيت داخل الموانئ، تربط نيل فليت بين الحركة الفعلية والتحكم التشغيلي.' : 'From road transport to port-side genset operations, Nile Fleet connects physical movement with operational control.',
    authorized: ar ? 'دخول مصرح' : 'Authorized access',
    gensetControl: ar ? <>تحكم<br />الجينسيت</> : <>GENSET<br />CONTROL</>,
    liveSystem: ar ? 'نظام مباشر' : 'LIVE SYSTEM',
    gensetDesc: ar ? 'الوصول إلى منصة عمليات الجينسيت للحجوزات والمخزون والحركات والفواتير والتحكم التشغيلي.' : 'Access the existing Genset operations platform for bookings, stock, movements, invoices and operational control.',
    enterSystem: ar ? 'دخول إلى النظام' : 'Enter system',
    nextLayer: ar ? 'طبقة العمليات التالية' : 'Next operation layer',
    coming: ar ? 'قريباً' : 'COMING SOON',
    transport: ar ? 'النقل' : 'TRANSPORT',
    transportDesc: ar ? 'نظام متكامل لإدارة نقل الشاحنات والحاويات قيد التطوير.' : 'Integrated trucking and container transport management is under development.',
    leadLabel: ar ? 'القيادة' : 'Leadership',
    people: ar ? <>القيادة التي تحرّك<br /><span className={gold}>أعمالنا.</span></> : <>People who move<br /><span className={gold}>our business.</span></>,
    leadDesc: ar ? 'القيادة عبر عمليات الشركة وقطاع النقل وخدمات الجينسيت.' : 'Leadership across company operations, transport and genset services.',
    roles: ar ? ['الرئيس التنفيذي', 'رئيس قطاع النقل', 'رئيس قطاع الجينسيت'] : ['CEO', 'HEAD OF TRANSPORT DEPARTMENT', 'HEAD OF GENSET DEPARTMENT'],
    areas: ar ? ['الشركة', 'النقل', 'الجينسيت'] : ['COMPANY', 'TRANSPORT', 'GENSET'],
    safe: ar ? 'آمن. موثوق. واضح. متصل.' : 'Safe. Reliable. Visible. Connected.',
    whyTitle: ar ? <>لماذا <span className={gold}>نيل فليت؟</span></> : <>Why <span className={gold}>Nile Fleet?</span></>,
    whyDesc: ar ? 'خبرة تشغيلية، استجابة سريعة، إدارة أسطول ورؤية واضحة للحركة — مصممة لخدمة الأعمال التي لا تتوقف.' : 'Operational experience, fast response, fleet control and clear visibility — built for businesses that cannot afford to stop.',
    standards: ar ? ['الجودة أولاً', 'التسليم في الموعد', 'السلامة في كل رحلة', 'رؤية تشغيلية كاملة', 'استجابة سريعة', 'فريق تشغيل متخصص'] : ['QUALITY FIRST', 'ON-TIME DELIVERY', 'SAFETY ON EVERY MOVE', 'FULL OPERATIONAL VISIBILITY', 'FAST RESPONSE', 'SPECIALIZED OPERATIONS'],
    footprint: ar ? <>حركة <span className={gold}>تمتد عبر مصر.</span></> : <>A footprint that <span className={gold}>moves across Egypt.</span></>,
    footprintDesc: ar ? 'من الموانئ والمناطق الصناعية إلى وجهة العميل، نربط عمليات النقل بالحركة الفعلية على الأرض.' : 'From ports and industrial zones to the customer destination, we connect transport planning with movement on the ground.',
    serviceTitle: ar ? <>حلول نقل <span className={gold}>مصممة للعمل.</span></> : <>Transport solutions <span className={gold}>built for business.</span></>,
    serviceItems: ar ? ['نقل الحاويات', 'نقل الحاويات المبردة', 'النقل الداخلي', 'إدارة الأسطول', 'عمليات الموانئ', 'دعم سلاسل الإمداد'] : ['CONTAINER TRANSPORT', 'REEFER TRANSPORT', 'INLAND TRUCKING', 'FLEET MANAGEMENT', 'PORT OPERATIONS', 'SUPPLY CHAIN SUPPORT'],
    proofTitle: ar ? <>ما نقدمه لعملائنا <span className={gold}>كل يوم.</span></> : <>What we deliver to customers <span className={gold}>every day.</span></>,
    proofDesc: ar ? 'لا نعرض تقييمات أو شعارات عملاء إلا عندما تكون معتمدة وقابلة للنشر. الجودة تُقاس بما يحدث على أرض الواقع.' : 'We only publish customer reviews and partner logos when they are approved and verifiable. Quality is measured by what happens on the ground.',
    reviewPending: ar ? 'آراء العملاء المعتمدة ستظهر هنا قريباً.' : 'Verified customer feedback will appear here.',
    partnersTitle: ar ? <>شركاء <span className={gold}>النجاح.</span></> : <>Partners in <span className={gold}>success.</span></>,
    partnersDesc: ar ? 'قسم مخصص للشركاء والعملاء المعتمدين — مع شعارات رسمية بعد الحصول على الموافقة.' : 'A dedicated space for approved customers and partners — with official logos added only after authorization.',
    globalTitle: ar ? 'منظومة لوجستية عالمية' : 'GLOBAL LOGISTICS ECOSYSTEM',
    globalDesc: ar ? 'نخدم عمليات تتصل بخطوط الملاحة ووكلاء الشحن والمستوردين والمصدرين والعملاء الصناعيين.' : 'We support operations connected to shipping lines, freight forwarders, importers, exporters and industrial clients.',
  };

  const nav = [[tx.about, '#about'], [tx.operations, '#operations'], [ar ? 'لماذا نحن' : 'WHY US', '#why-us'], [tx.leadership, '#leadership']];

  return (
    <div ref={wrapRef} className={`nf4 min-h-screen overflow-x-hidden selection:bg-[#c2a378] selection:text-black ${K.root}`}>
      <style>{`
        @keyframes nf4Reveal { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nf4Pulse { 0%,100%{box-shadow:0 0 0 rgba(194,163,120,0)} 50%{box-shadow:0 0 42px rgba(194,163,120,.28)} }
        @keyframes nf4Partners { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .nf4-logo-viewport{position:relative}
        .nf4-logo-track{animation:nf4Partners 34s linear infinite}
        .nf4-logo-track:hover{animation-play-state:paused}
        .nf4-logo-viewport:before,.nf4-logo-viewport:after{content:"";position:absolute;top:0;bottom:0;width:90px;z-index:2;pointer-events:none}
        .nf4-logo-viewport:before{left:0;background:linear-gradient(90deg,#050b12,transparent)}
        .nf4-logo-viewport:after{right:0;background:linear-gradient(-90deg,#050b12,transparent)}
        .nf4-reveal{animation:nf4Reveal .9s cubic-bezier(.16,1,.3,1) both}
        .nf4-pulse{animation:nf4Pulse 3s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){ .nf4 *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important} }
      `}</style>

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

      {/* route progress (scroll) */}
      <div className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-black/10"><div ref={barRef} className="h-full w-0 bg-[#c2a378] shadow-[0_0_12px_#c2a378]" /></div>

      <header className={`sticky top-0 z-40 border-b backdrop-blur-2xl ${K.head}`}>
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-10">
          <a href="#top" className="group flex items-center gap-3">
            <img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain transition-transform duration-500 group-hover:rotate-6" alt="Nile Fleet" />
            <div>
              <div className="flex items-baseline gap-2 text-[17px] font-black tracking-tight">NILE <span className={gold}>FLEET</span><span className="text-[7px] font-black uppercase tracking-[.18em] text-[#c2a378] whitespace-nowrap">POWERED BY <span className="text-white">BEBITO</span></span></div>
              <div className={`text-[7px] font-black uppercase tracking-[.34em] ${K.faint}`}>{tx.brandSub}</div>
            </div>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href]) => <a key={href} href={href} className={`text-[9px] font-black tracking-[.25em] transition hover:text-[#c2a378] ${K.muted}`}>{label}</a>)}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} className={`rounded-full border px-3 py-2 text-[9px] font-black tracking-[.15em] transition hover:border-[#c2a378]/70 ${K.line} ${gold}`}>{isFullscreen ? tx.exit : tx.full}</button>
            <button onClick={toggleSound} aria-pressed={soundOn} className={`rounded-full border px-3 py-2 text-[9px] font-black tracking-[.15em] transition hover:border-[#c2a378]/70 ${K.line} ${gold}`}>{soundOn ? tx.soundOn : tx.soundOff}</button>
            <button onClick={() => setTheme(isDark ? 'white' : 'phantom')} className={`rounded-full border px-3 py-2 text-[9px] font-black tracking-[.15em] transition hover:border-[#c2a378]/70 ${K.line} ${gold}`}>{isDark ? tx.white : tx.dark}</button>
            <button onClick={() => setLang(ar ? 'en' : 'ar')} className={`rounded-full border px-4 py-2 text-[9px] font-black tracking-[.15em] transition hover:border-[#c2a378]/70 ${K.line} ${gold}`}>{ar ? 'EN' : 'العربية'}</button>
            <button onClick={onGenset} className="hidden rounded-full bg-[#c2a378] px-5 py-2.5 text-[9px] font-black tracking-[.18em] text-black transition hover:scale-105 sm:block">{tx.gensetAccess}</button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="relative flex min-h-[100vh] items-start overflow-hidden">
          <div className="mx-auto grid w-full max-w-[1500px] items-start gap-12 px-5 pt-24 lg:grid-cols-[1.25fr_.75fr] lg:px-10 lg:pt-28">
            <div className="nf4-reveal">
              <div className="mb-5 flex items-center gap-4">
                <span className="h-px w-16 bg-[#c2a378]" />
                <span className={`text-[9px] font-black uppercase tracking-[.48em] ${gold}`}>{tx.since}</span>
              </div>
              <h1 className="max-w-6xl text-[clamp(2.6rem,6.4vw,6.4rem)] font-black uppercase italic leading-[.85] tracking-[-.06em]">
                {tx.heroTitle}
              </h1>
              <p className={`mt-6 max-w-2xl text-sm font-medium leading-7 sm:text-base ${K.soft}`}>
                {ar ? 'نيل فليت لخدمات النقل واللوجستيات — نقل الشاحنات والحاويات وحلول لوجستية متكاملة مع رؤية تشغيلية كاملة.' : 'Nile Fleet for Transport and Logistics Service — trucking, container transportation and integrated logistics built around safe movement and operational visibility.'}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a href="#operations" className={`nf4-pulse rounded-full border border-[#c2a378]/60 bg-[#c2a378]/10 px-7 py-3 text-[9px] font-black uppercase tracking-[.24em] ${gold}`}>{tx.explore}</a>
                <span className={`text-[8px] font-black uppercase tracking-[.25em] ${K.faint}`}>{tx.scrollHint}</span>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-3">
                {[['2009', tx.founded], ['17+', tx.years], ['EGYPT', tx.coverage], ['24/7', tx.ops24]].map(([v, l]) => (
                  <div key={l} className={`rounded-2xl border p-4 backdrop-blur-md ${K.card}`}>
                    <div className="text-2xl font-black">{v}</div>
                    <div className={`mt-1 text-[7px] font-black tracking-[.2em] ${gold}`}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className={`relative border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto grid max-w-[1500px] gap-14 px-5 py-28 lg:grid-cols-[.75fr_1.25fr] lg:px-10">
              <div>
                <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>01 / {tx.company}</div>
                <h2 className="mt-5 text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">{tx.built}</h2>
              </div>
              <div className="max-w-3xl">
                <p className={`text-base leading-8 sm:text-lg ${K.soft}`}>{tx.about1}</p>
                <p className={`mt-7 text-sm leading-7 ${K.muted}`}>{tx.about2}</p>
                <div className="mt-12 h-px w-full bg-gradient-to-r from-[#c2a378] via-[#c2a378]/20 to-transparent" />
                <div className="mt-7 flex flex-wrap gap-3">
                  {tx.values.map(x => <span key={x} className={`rounded-full border px-4 py-2 text-[7px] font-black tracking-[.2em] ${K.chip}`}>{x}</span>)}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="operations" className={`relative overflow-hidden border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="relative mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>02 / {tx.operations}</div>
                  <h2 className="mt-4 text-5xl font-black uppercase italic tracking-[-.05em] sm:text-7xl">{tx.oneFleet}</h2>
                </div>
                <div className={`max-w-sm text-xs leading-6 ${K.muted}`}>{tx.opsDesc}</div>
              </div>

              <div className="mt-14 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
                <button onClick={onGenset} className="group relative min-h-[380px] overflow-hidden rounded-[2rem] border border-[#c2a378]/40 bg-[#050b12]/85 text-left text-white backdrop-blur-md transition duration-500 hover:-translate-y-2 hover:border-[#c2a378]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(194,163,120,.22),transparent_30%),linear-gradient(135deg,#07121a,#010203)]" />
                  <div className="relative flex min-h-[380px] flex-col justify-between p-8 sm:p-10">
                    <div className="flex items-center justify-between"><span className="rounded-full bg-[#c2a378] px-3 py-1 text-[7px] font-black tracking-[.2em] text-black">{tx.liveSystem}</span><span className="text-[8px] font-black tracking-[.25em] text-slate-500">01</span></div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[.3em] text-[#c2a378]">{tx.authorized}</div>
                      <div className="mt-3 text-4xl font-black uppercase italic tracking-[-.04em]">{tx.gensetControl}</div>
                      <p className="mt-4 max-w-md text-xs leading-6 text-slate-400">{tx.gensetDesc}</p>
                      <div className="mt-7 inline-flex items-center gap-3 text-[8px] font-black uppercase tracking-[.25em] text-white">{tx.enterSystem} <span className="transition group-hover:translate-x-2">→</span></div>
                    </div>
                  </div>
                </button>

                <div className={`group relative min-h-[380px] overflow-hidden rounded-[2rem] border p-8 backdrop-blur-md sm:p-10 ${K.card}`}>
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex justify-between"><span className={`text-[8px] font-black tracking-[.25em] ${K.faint}`}>02</span><span className={`rounded-full border px-3 py-1 text-[7px] font-black tracking-[.2em] ${K.line} ${K.faint}`}>{tx.coming}</span></div>
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-[.3em] ${K.faint}`}>{tx.nextLayer}</div>
                      <div className="mt-3 text-4xl font-black uppercase italic">{tx.transport}</div>
                      <p className={`mt-4 text-xs leading-6 ${K.muted}`}>{tx.transportDesc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>


        <section id="why-us" className={`relative overflow-hidden border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>03 / {ar ? 'لماذا نحن' : 'WHY US'}</div>
              <div className="mt-5 grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
                <div>
                  <h2 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">{tx.whyTitle}</h2>
                  <p className={`mt-7 max-w-xl text-sm leading-7 ${K.muted}`}>{tx.whyDesc}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tx.standards.map((x, i) => (
                    <div key={x} className={`group rounded-[1.5rem] border p-6 backdrop-blur-md transition duration-500 hover:-translate-y-1 hover:border-[#c2a378]/60 ${K.card}`}>
                      <div className={`text-[8px] font-black tracking-[.22em] ${gold}`}>{String(i + 1).padStart(2, '0')}</div>
                      <div className="mt-10 text-sm font-black uppercase leading-5">{x}</div>
                      <div className="mt-5 h-px w-8 bg-[#c2a378] transition-all duration-500 group-hover:w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="network" className={`relative overflow-hidden border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>04 / {ar ? 'شبكة الحركة' : 'NETWORK'}</div>
              <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <h2 className="text-5xl font-black uppercase italic tracking-[-.05em] sm:text-7xl">{tx.footprint}</h2>
                <p className={`max-w-sm text-xs leading-6 ${K.muted}`}>{tx.footprintDesc}</p>
              </div>
              <div className="mt-14 grid gap-4 md:grid-cols-3">
                {[
                  ['PORTS', ar ? 'الإسكندرية · دمياط · بورسعيد · الدخيلة · السخنة' : 'Alexandria · Damietta · Port Said · Dekheila · Sokhna'],
                  ['CARGO', ar ? 'حاويات · حاويات مبردة · استيراد · تصدير' : 'Containers · Reefers · Import · Export'],
                  ['CONTROL', ar ? 'تشغيل · أسطول · موانئ · رؤية تشغيلية' : 'Operations · Fleet · Ports · Visibility'],
                ].map(([title, body], i) => (
                  <div key={title} className={`relative overflow-hidden rounded-[1.7rem] border p-8 ${K.card}`}>
                    <div className={`text-[8px] font-black tracking-[.25em] ${gold}`}>0{i + 1}</div>
                    <div className="mt-14 text-xl font-black italic">{title}</div>
                    <div className={`mt-4 text-xs leading-6 ${K.muted}`}>{body}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section id="services" className={`relative overflow-hidden border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>05 / {ar ? 'الخدمات' : 'SERVICES'}</div>
              <h2 className="mt-5 max-w-5xl text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">{tx.serviceTitle}</h2>
              <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tx.serviceItems.map((x, i) => (
                  <div key={x} className={`group relative min-h-[170px] overflow-hidden rounded-[1.5rem] border p-7 transition duration-500 hover:-translate-y-1 hover:border-[#c2a378]/60 ${K.card}`}>
                    <div className={`text-[8px] font-black tracking-[.25em] ${gold}`}>0{i + 1}</div>
                    <div className="absolute right-7 top-7 text-5xl font-black opacity-10">{String(i + 1).padStart(2, '0')}</div>
                    <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#c2a378] transition-all duration-700 group-hover:w-full" />
                    <div className="mt-14 max-w-[220px] text-sm font-black uppercase leading-5">{x}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section id="proof" className={`relative overflow-hidden border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>06 / {ar ? 'الثقة والجودة' : 'QUALITY & TRUST'}</div>
              <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_.8fr]">
                <div>
                  <h2 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">{tx.proofTitle}</h2>
                  <p className={`mt-7 max-w-2xl text-sm leading-7 ${K.muted}`}>{tx.proofDesc}</p>
                  <div className="mt-10 flex flex-wrap gap-2">
                    {['★★★★★', ar ? 'تقييمات معتمدة' : 'VERIFIED FEEDBACK', ar ? 'جودة' : 'QUALITY', ar ? 'سرعة الاستجابة' : 'FAST RESPONSE'].map(x => (
                      <span key={x} className={`rounded-full border px-4 py-2 text-[8px] font-black tracking-[.18em] ${K.chip}`}>{x}</span>
                    ))}
                  </div>
                </div>
                <div className={`relative overflow-hidden rounded-[2rem] border p-8 ${K.card}`}>
                  <div className="absolute -right-12 -top-12 text-[9rem] font-black opacity-5">★★★★★</div>
                  <div className={`text-4xl tracking-[.12em] ${gold}`}>★★★★★</div>
                  <div className="mt-8 text-lg font-black">{tx.reviewPending}</div>
                  <div className={`mt-4 text-xs leading-6 ${K.muted}`}>{ar ? 'أرسل لنا تقييمات العملاء المعتمدة لإضافتها هنا بأسمائهم وشعاراتهم.' : 'Provide approved customer testimonials and we can place them here with names and company logos.'}</div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="partners" className="relative overflow-hidden border-y bg-[#050b12] text-white">
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">07 / {ar ? 'شبكة الشحن والنقل' : 'SHIPPING & TRUCKING NETWORK'}</div>
              <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <h2 className="text-5xl font-black uppercase italic leading-[.9] tracking-[-.05em] sm:text-7xl">{tx.partnersTitle}</h2>
                <p className="max-w-sm text-xs leading-6 text-slate-400">{tx.partnersDesc}</p>
              </div>
              <div className="nf4-logo-viewport mt-14 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 py-8">
                <div className="nf4-logo-track flex w-max items-center gap-4 px-4">
                  {[...PARTNER_LOGOS, ...PARTNER_LOGOS].map((p, i) => (
                    <a key={`${p.name}-${i}`} href={p.url} target="_blank" rel="noreferrer" className="group flex h-28 min-w-[230px] items-center justify-center rounded-2xl border border-white/10 bg-white/[.035] px-7 text-center transition duration-500 hover:-translate-y-1 hover:border-[#c2a378]/60 hover:bg-white/[.06]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-[0_0_30px_rgba(255,255,255,.08)]">
                          <img src={p.logo} alt={`${p.name} logo`} className="h-full w-full object-contain" loading="lazy" />
                        </div>
                        <div className="text-left">
                          <div className="text-[9px] font-black tracking-[.12em] text-white">{p.name}</div>
                          <div className="mt-1 text-[7px] font-bold tracking-[.16em] text-[#c2a378]">{p.type}</div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[8px] font-black uppercase tracking-[.18em] text-slate-600">{ar ? 'خطوط ملاحية · وكلاء شحن · لوجستيات · نقل بري · شركات شاحنات' : 'Shipping lines · freight forwarders · logistics operators · road transport · trucking'}</div>
                <div className="text-[8px] font-black uppercase tracking-[.18em] text-slate-600">{ar ? 'اضغط على أي شركة لزيارة موقعها.' : 'Click any company to visit its website.'}</div>
              </div>
              <div className="mt-6 text-[8px] font-black uppercase tracking-[.2em] text-slate-600">{tx.globalTitle} · {tx.globalDesc}</div>
            </div>
          </Reveal>
        </section>

        <section id="leadership" className={`border-y backdrop-blur-[2px] ${K.band}`}>
          <Reveal>
            <div className="mx-auto max-w-[1500px] px-5 py-28 lg:px-10">
              <div className={`text-[9px] font-black uppercase tracking-[.42em] ${gold}`}>03 / {tx.leadLabel}</div>
              <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <h2 className="text-5xl font-black uppercase italic tracking-[-.05em] sm:text-7xl">{tx.people}</h2>
                <p className={`max-w-sm text-xs leading-6 ${K.muted}`}>{tx.leadDesc}</p>
              </div>
              <div className="mt-14 grid gap-5 md:grid-cols-3" dir={ar ? 'rtl' : 'ltr'}>
                {[
                  ['SHERIF HEGAZY', tx.roles[0], tx.areas[0]],
                  ['SAMAR HEGAZY', tx.roles[1], tx.areas[1]],
                  ['YASMINE HEGAZY', tx.roles[2], tx.areas[2]],
                ].map(([name, role, area], i) => (
                  <div
                    key={name}
                    className={`group relative min-h-[280px] overflow-hidden rounded-[2rem] border p-7 sm:p-8 backdrop-blur-md transition duration-500 hover:-translate-y-2 hover:border-[#c2a378]/70 ${K.card}`}
                  >
                    <div className={`flex items-center ${ar ? 'flex-row-reverse' : 'flex-row'} justify-between gap-3`}>
                      <span className={`text-[8px] font-black tracking-[.25em] ${gold}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={`max-w-[65%] text-[8px] font-black leading-4 tracking-[.12em] ${K.faint} ${ar ? 'text-left' : 'text-right'}`}>{area}</span>
                    </div>
                    <div className="mt-20 h-px w-12 bg-[#c2a378] transition-all duration-500 group-hover:w-24" />
                    <div className={`mt-6 text-2xl font-black uppercase leading-tight ${ar ? 'text-right' : 'text-left'}`}>{name}</div>
                    <div className={`mt-3 text-[9px] font-black leading-5 tracking-[.12em] ${K.faint} ${ar ? 'text-right' : 'text-left'}`}>{role}</div>
                    <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#c2a378] transition-all duration-700 group-hover:w-full" />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section className={`relative overflow-hidden backdrop-blur-md ${K.foot}`}>
          <div className="mx-auto max-w-[1500px] px-5 pb-32 pt-20 lg:px-10">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.42em] text-[#c2a378]">Nile Fleet</div>
                <div className="mt-3 text-3xl font-black uppercase italic">{tx.safe}</div>
                <div className="mt-5 text-[9px] font-black uppercase tracking-[.34em] text-[#c2a378]">POWERED BY <span className="text-white">BEBITO</span></div>
              </div>
              <div className="text-xs leading-6 text-slate-300 md:text-right">
                <div>23 July St. · Abo Elkheer Building · 2nd Floor</div>
                <div>Port Said, Egypt</div>
                <div className="mt-2 text-[#c2a378]">nilefleet@nilefleetlogistics.com · Transport 01000992858 · Genset 01212229077</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* speedometer */}
      <div className={`pointer-events-none fixed bottom-4 right-4 z-30 rounded-2xl border px-4 py-3 backdrop-blur-md ${K.card}`} aria-hidden="true">
        <div className="flex items-end gap-2"><span className="text-3xl font-black tabular-nums leading-none">{String(hud.kmh).padStart(3, '0')}</span><span className={`pb-0.5 text-[8px] font-black tracking-[.25em] ${gold}`}>KM/H</span></div>
        <div className={`mt-1 text-[7px] font-black tracking-[.25em] ${K.faint}`}>ODO {hud.km.toFixed(2)} KM</div>
      </div>
    </div>
  );
};

export default CompanyHomeV4;
