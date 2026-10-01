import React, { useState } from 'react';

export interface ScreenHubTab {
  id: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
}

interface ScreenHubProps {
  title: string;
  tabs: ScreenHubTab[];
  initialTab?: string;
}

const ScreenHub: React.FC<ScreenHubProps> = ({ title, tabs, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab && tabs.some(t => t.id === initialTab) ? initialTab : tabs[0]?.id || '');

  const active = tabs.find(t => t.id === activeTab) || tabs[0];

  if (!active) {
    return <div className="p-6 text-sm font-bold">No content available.</div>;
  }

  return (
    <section className="w-full min-w-0">
      <div className="mb-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--card-bg)]/80 p-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-1">
          <div className="px-3 py-2 mr-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            {title}
          </div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all',
                active.id === tab.id
                  ? 'bg-[#C2A378] text-[#001F3F] shadow-md'
                  : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
              ].join(' ')}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">{active.content}</div>
    </section>
  );
};

export default React.memo(ScreenHub);
