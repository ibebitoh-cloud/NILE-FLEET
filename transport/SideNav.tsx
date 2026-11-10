import React, { useState } from 'react';

export interface SideItem { key: string; label: string; icon?: string; badge?: number | null }

/**
 * Fixed side menu for the screens of one section (desktop / tablet).
 * It stays in place while the page scrolls. The arrow tab on its edge hides and shows it;
 * the choice is remembered in this browser. Phones keep their own navigation.
 */
const SideNav: React.FC<{
  title: string; icon: string; items: SideItem[]; active: string; onSelect: (k: string) => void;
  dir: 'ltr' | 'rtl'; hideLabel: string; showLabel: string; footer?: React.ReactNode;
  /** Phone: a drawer that slides in from the side, opened by the same edge arrow. Starts closed. */
  mobile?: boolean;
}> = ({ title, icon, items, active, onSelect, dir, hideLabel, showLabel, footer, mobile }) => {
  const [drawer, setDrawer] = useState(false);
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem('nf_transport_sidenav') !== 'closed'; } catch { return true; } });
  const setOpen = (v: boolean) => { setOpenState(v); try { localStorage.setItem('nf_transport_sidenav', v ? 'open' : 'closed'); } catch { /* ignore */ } };
  // The arrow points the way the panel moves: towards the edge to hide, away from it to show.
  const towardEdge = dir === 'rtl' ? '▶' : '◀';
  const awayFromEdge = dir === 'rtl' ? '◀' : '▶';
  const list = (after?: () => void) => items.map(it => (
    <button key={it.key} onClick={() => { onSelect(it.key); after?.(); }} aria-current={active === it.key ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-[12px] font-bold transition ${active === it.key ? 'bg-[#c2a378] text-[#07111f]' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
      {it.icon && <span className="w-5 text-center text-base">{it.icon}</span>}
      <span className="flex-1 truncate">{it.label}</span>
      {it.badge != null && <span className={`rounded-full px-1.5 text-[10px] font-black ${active === it.key ? 'bg-[#07111f] text-white' : 'bg-white/15'}`}>{it.badge}</span>}
    </button>
  ));
  const head = (
    <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-3 pt-1">
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-black uppercase italic tracking-tight">{title}</span>
    </div>
  );
  if (mobile) {
    return (
      <>
        {drawer && <div className="fixed inset-0 z-[55] bg-[#07111f]/40" onClick={() => setDrawer(false)} />}
        <div className={`fixed bottom-0 start-0 top-0 z-[56] flex transition-transform duration-300 ${drawer ? 'translate-x-0' : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'}`} aria-label={title}>
          <div className="flex h-full w-64 flex-col bg-[#07111f] p-3 pt-5 text-white shadow-2xl">
            {head}
            <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">{list(() => setDrawer(false))}</nav>
            {footer && <div className="border-t border-white/10 pt-3">{footer}</div>}
          </div>
          <button onClick={() => setDrawer(!drawer)} aria-expanded={drawer} aria-label={drawer ? hideLabel : showLabel} style={{ minHeight: 0 }}
            className={`absolute top-1/2 -end-5 grid h-16 w-5 -translate-y-1/2 place-items-center rounded-e-lg border border-s-0 border-[#c2a378]/60 bg-[#07111f] text-[10px] text-[#c2a378] shadow-md`}>
            {drawer ? towardEdge : awayFromEdge}
          </button>
        </div>
      </>
    );
  }
  return (
    <aside className={`nf-sidenav sticky top-[84px] z-20 hidden shrink-0 self-start transition-[width] duration-300 md:block ${open ? 'w-56' : 'w-0'}`} aria-label={title}>
      <div className={`h-[calc(100vh-104px)] overflow-hidden transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="flex h-full w-56 flex-col rounded-2xl bg-[#07111f] p-3 text-white shadow-[0_12px_30px_rgba(7,17,31,.18)] ring-1 ring-[#c2a378]/25">
          {head}
          <nav className="mt-2 flex-1 space-y-1 overflow-y-auto pe-1">{list()}</nav>
          {footer && <div className="border-t border-white/10 pt-3">{footer}</div>}
        </div>
      </div>
      {/* Old-school edge tab: sticks out of the panel's edge, always reachable. */}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? hideLabel : showLabel} title={open ? hideLabel : showLabel}
        style={{ minHeight: 0 }}
        className="absolute top-6 -end-5 grid h-14 w-5 place-items-center rounded-e-lg border border-s-0 border-[#c2a378]/60 bg-[#07111f] text-[10px] text-[#c2a378] shadow-md transition hover:w-6 hover:bg-[#13263d]">
        {open ? towardEdge : awayFromEdge}
      </button>
    </aside>
  );
};

export default SideNav;
