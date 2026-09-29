
import React, { lazy, Suspense, useState, createContext, useContext, useEffect, useMemo, useCallback } from 'react';
const Login = lazy(() => import('./screens/Login'));
const Dashboard = lazy(() => import('./screens/Dashboard'));
const Operations = lazy(() => import('./screens/Operations'));
const StockManagement = lazy(() => import('./screens/StockManagement'));
const Reservations = lazy(() => import('./screens/Reservations'));
const Customers = lazy(() => import('./screens/Customers'));
const CustomerPrices = lazy(() => import('./screens/CustomerPrices'));
const Financials = lazy(() => import('./screens/Financials'));
const HistoryLog = lazy(() => import('./screens/HistoryLog'));
const Intelligence = lazy(() => import('./screens/Intelligence'));
const Reports = lazy(() => import('./screens/Reports'));
const CustomerPortal = lazy(() => import('./screens/CustomerPortal'));
const MasterView = lazy(() => import('./screens/MasterView'));
const Analytics = lazy(() => import('./screens/Analytics'));
const UserSettings = lazy(() => import('./screens/UserSettings'));
const PortGateControl = lazy(() => import('./screens/PortGateControl'));
const UserMgmt = lazy(() => import('./screens/UserMgmt'));
const CustomerService = lazy(() => import('./screens/CustomerService'));
const BookingInvoices = lazy(() => import('./screens/BookingInvoices'));
const Notifications = lazy(() => import('./screens/Notifications'));
import Layout from './components/Layout';
import { User, UserRole } from './types';
import { db } from './services/supabaseDb';
import { supabase } from './services/supabaseClient';
import { loginWithPassword, logout as supabaseLogout, getCurrentSessionUser } from './services/authService';
import { discoveryQueue, registerDynamicTranslations, translateUiText } from './translations';
import { translateBusinessEntities, getSafeApiKey } from './services/aiService';

type Language = 'en' | 'ar';
const getDefaultAllowedScreens = (role: UserRole): string[] => {
  if (role === UserRole.ADMIN) return ['dashboard', 'analytics', 'master-view', 'port-gate', 'operations', 'booking-invoices', 'intelligence', 'reports', 'stock', 'reservations', 'customers', 'user-mgmt', 'customer-prices', 'financials', 'support', 'notifications', 'system-log', 'user-settings'];
  if (role === UserRole.MANAGER) return ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials', 'intelligence', 'reports', 'notifications', 'system-log', 'support', 'user-settings'];
  if (role === UserRole.VIEWER) return ['dashboard', 'master-view', 'reports', 'intelligence', 'notifications', 'support', 'system-log'];
  if (role === UserRole.GATE_OPERATOR) return ['port-gate', 'notifications', 'support', 'user-settings'];
  return ['cust-reservations', 'cust-invoices', 'notifications', 'support', 'user-settings'];
};
export type ThemeMode = 'black' | 'white' | 'yellow' | 'navy' | 'forest' | 'sahara' | 'cyber' | 'slate' | 'midnight' | 'rose' | 'emerald-vibrant' | 'ocean' | 'lava' | 'phantom' | 'mint' | 'copper' | 'arctic' | 'toxic' | 'nile' | 'carbon' | 'royal' | 'sandstorm' | 'corporate' | 'crimson' | 'custom';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
}
export const LanguageContext = createContext<LanguageContextType>({ lang: 'en', setLang: () => {} });

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  scale: number;
  setScale: (s: number) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  isDark: boolean;
  updateCustomTheme: (colors: {
    bg: string;
    text: string;
    textSec: string;
    card: string;
    accent: string;
    border: string;
    input: string;
    isDark: boolean;
    rowBg?: string;
    railBg?: string;
  }) => void;
}
export const ThemeContext = createContext<ThemeContextType>({ 
  theme: 'rose', 
  setTheme: () => {},
  scale: 0.85,
  setScale: () => {},
  isMuted: false,
  setIsMuted: () => {},
  isDark: false,
  updateCustomTheme: () => {}
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'rose';
  });

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('app_scale');
    return saved ? parseFloat(saved) : 0.85;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('app_muted') === 'true';
  });

  const [customThemeKey, setCustomThemeKey] = useState<number>(0);

  const [activeScreen, setActiveScreen] = useState<string>(() => window.location.hash.slice(1).split('?')[0] || 'dashboard');
  const [openScreens, setOpenScreens] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('openScreens') || '[]');
      const current = window.location.hash.slice(1).split('?')[0];
      return Array.from(new Set([...(Array.isArray(saved) ? saved.filter((screen): screen is string => typeof screen === 'string') : []), current || 'dashboard']));
    } catch {
      return [window.location.hash.slice(1).split('?')[0] || 'dashboard'];
    }
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'en';
  });
  const languageContextValue = useMemo(() => ({ lang, setLang }), [lang]);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  // Authentication is authoritative. localStorage is only a UI cache and is never
  // treated as proof of identity or authorization.
  useEffect(() => {
    let cancelled = false;

    const applySessionUser = async () => {
      const sessionUser = await getCurrentSessionUser().catch(err => {
        console.error('Failed to verify Supabase session:', err);
        return null;
      });
      if (cancelled) return;

      if (sessionUser) {
        setUser(sessionUser);
        localStorage.setItem('user', JSON.stringify(sessionUser));

        // Load protected business data only after authentication succeeds.
        await db.loadAll().catch(err => console.error('Failed to load data from Supabase:', err));

        if (sessionUser.revoked) {
          await supabaseLogout();
          setUser(null);
          localStorage.removeItem('user');
        } else {
          setActiveScreen(
            sessionUser.role === UserRole.GATE_OPERATOR
              ? 'port-gate'
              : sessionUser.role === UserRole.CUSTOMER
                ? 'cust-reservations'
                : 'dashboard'
          );
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }

      if (!cancelled) setAuthChecked(true);
    };

    applySessionUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;

      window.setTimeout(() => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('user');
          setAuthChecked(true);
          return;
        }

        applySessionUser();
      }, 0);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Deep links use the current screen key in the URL. All screens remain
  // behind the auth gate below, including direct navigation and refreshes.
  useEffect(() => {
    const allScreens = new Set([
      'dashboard', 'analytics', 'master-view', 'port-gate', 'operations',
      'booking-invoices', 'intelligence', 'reports', 'stock', 'reservations',
      'customers', 'user-mgmt', 'customer-prices', 'financials', 'support',
      'notifications', 'system-log', 'user-settings', 'cust-reservations',
      'cust-invoices'
    ]);
    const role = user?.role || UserRole.CUSTOMER;
    const roleScreens = getDefaultAllowedScreens(role);
    const homeScreen = roleScreens.includes('dashboard') ? 'dashboard' : roleScreens.includes('port-gate') ? 'port-gate' : 'cust-reservations';
    const permittedScreens = user?.role === UserRole.CUSTOMER
      ? new Set(['cust-reservations', 'cust-invoices', 'notifications', 'support'])
      : Array.isArray(user?.allowedScreens)
        ? new Set(user.allowedScreens.filter(screen => allScreens.has(screen)))
        : new Set(roleScreens);
    const syncFromUrl = () => {
      const screen = window.location.hash.slice(1).split('?')[0];
      if (!user) return;
      const destination = permittedScreens.has(screen)
        ? screen
        : permittedScreens.has(homeScreen)
          ? homeScreen
          : permittedScreens.values().next().value || 'no-access';
      if (destination === 'no-access') {
        if (window.location.hash) window.location.hash = '';
      } else if (screen !== destination) {
        window.location.hash = destination;
      }
      setActiveScreen(destination);
      setOpenScreens(current => {
        const permittedOpen = current.filter(openScreen => permittedScreens.has(openScreen));
        if (destination === 'no-access' || permittedOpen.includes(destination)) return permittedOpen;
        return [...permittedOpen, destination];
      });
    };
    window.addEventListener('hashchange', syncFromUrl);
    if (user) syncFromUrl();
    return () => window.removeEventListener('hashchange', syncFromUrl);
  }, [user]);

  const getIsDark = (currentTheme: ThemeMode): boolean => {
    if (currentTheme === 'custom') {
      return localStorage.getItem('custom_is_dark') === 'true';
    }
    const DARK_THEMES = ['black', 'navy', 'forest', 'sahara', 'cyber', 'slate', 'midnight', 'toxic', 'lava', 'copper', 'phantom', 'nile', 'carbon', 'royal', 'crimson'];
    return DARK_THEMES.includes(currentTheme);
  };

  const isDark = getIsDark(theme);

  const updateCustomTheme = useCallback((colors: {
    bg: string;
    text: string;
    textSec: string;
    card: string;
    accent: string;
    border: string;
    input: string;
    isDark: boolean;
    rowBg?: string;
    railBg?: string;
  }) => {
    localStorage.setItem('custom_bg_primary', colors.bg);
    localStorage.setItem('custom_text_primary', colors.text);
    localStorage.setItem('custom_text_secondary', colors.textSec);
    localStorage.setItem('custom_card_bg', colors.card);
    localStorage.setItem('custom_accent', colors.accent);
    localStorage.setItem('custom_border_primary', colors.border);
    localStorage.setItem('custom_input_bg', colors.input);
    localStorage.setItem('custom_is_dark', colors.isDark ? 'true' : 'false');
    if (colors.rowBg !== undefined) localStorage.setItem('custom_row_bg', colors.rowBg);
    if (colors.railBg !== undefined) localStorage.setItem('custom_rail_bg', colors.railBg);
    setCustomThemeKey(prev => prev + 1);
  }, []);

  const themeContextValue = useMemo(() => ({
    theme, setTheme, scale, setScale, isMuted, setIsMuted, isDark, updateCustomTheme
  }), [theme, scale, isMuted, isDark, updateCustomTheme]);

  useEffect(() => {
    localStorage.setItem('app_muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const applyCustomThemeStyles = () => {
      if (theme === 'custom') {
        const customBg = localStorage.getItem('custom_bg_primary') || '#ffffff';
        const customText = localStorage.getItem('custom_text_primary') || '#0f172a';
        const customSec = localStorage.getItem('custom_text_secondary') || '#475569';
        const customCard = localStorage.getItem('custom_card_bg') || '#ffffff';
        const customAccent = localStorage.getItem('custom_accent') || '#3b82f6';
        const customBorder = localStorage.getItem('custom_border_primary') || '#e2e8f0';
        const customInput = localStorage.getItem('custom_input_bg') || '#f8fafc';
        const customRowBg = localStorage.getItem('custom_row_bg') || customCard;
        const customRailBg = localStorage.getItem('custom_rail_bg') || (localStorage.getItem('custom_is_dark') === 'true' ? '#001224' : '#ffffff');
        const customIsDarkVal = localStorage.getItem('custom_is_dark') === 'true';

        let styleEl = document.getElementById('theme-custom-style') as HTMLStyleElement;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'theme-custom-style';
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
          body.theme-custom {
              --bg-primary: ${customBg};
              --text-primary: ${customText};
              --text-secondary: ${customSec};
              --border-primary: ${customBorder};
              --card-bg: ${customCard};
              --accent: ${customAccent};
              --input-bg: ${customInput};
              --row-bg: ${customRowBg};
              --rail-bg: ${customRailBg};
          }
          body.theme-custom .bg-white,
          body.theme-custom .bg-slate-50 { 
              background-color: var(--card-bg) !important; 
              color: var(--text-primary) !important; 
          }
          body.theme-custom .bg-slate-100 { 
              background-color: var(--input-bg) !important; 
              color: var(--text-primary) !important; 
          }
          body.theme-custom input, body.theme-custom select, body.theme-custom textarea {
              background-color: var(--input-bg) !important;
              color: var(--text-primary) !important;
              border-color: var(--border-primary) !important;
          }
        `;
      } else {
        const styleEl = document.getElementById('theme-custom-style');
        if (styleEl) {
          styleEl.remove();
        }
      }
    };

    applyCustomThemeStyles();
  }, [theme, customThemeKey]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', scale.toString());
    localStorage.setItem('app_scale', scale.toString());
  }, [scale]);

  /**
   * AI LINGUISTIC OBSERVER
   * Automatically monitors the UI for untranslated text andConsults Gemini
   */
  useEffect(() => {
    if (lang !== 'ar' || !getSafeApiKey() || user?.role === UserRole.CUSTOMER) return;

    let isProcessing = false;
    const observer = setInterval(async () => {
      if (isProcessing || discoveryQueue.size === 0) return;
      
      isProcessing = true;
      const wordsToTranslate = Array.from(discoveryQueue).slice(0, 10);
      discoveryQueue.clear(); // Clear so we don't double process

      try {
        console.debug("AI Translation Observer: Encountered new entities...", wordsToTranslate);
        const mappings = await translateBusinessEntities(wordsToTranslate);
        if (mappings && Object.keys(mappings).length > 0) {
          registerDynamicTranslations(mappings);
        }
      } catch (err) {
        console.error("Linguistic Node Failed:", err);
      } finally {
        isProcessing = false;
      }
    }, 5000);

    return () => clearInterval(observer);
  }, [lang, user?.role]);

  // GLOBAL UI TRANSLATION FALLBACK.
  // Keep hard-coded labels translated as lazy screens and dialogs are mounted.
  useEffect(() => {
    if (lang !== 'ar') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    const translationTimers = new Set<ReturnType<typeof setTimeout>>();
    const translatedTexts = new Map<Text, { original: string; translated: string }>();
    const translatedAttributes = new Map<HTMLElement, Map<string, { original: string; translated: string }>>();

    const shouldSkip = (element: HTMLElement | null) => {
      if (!element) return true;
      if (element.closest('script,style,code,pre,[data-no-translate]')) return true;
      return false;
    };

    const translateTextNode = (text: Text) => {
      const parent = text.parentElement;
      if (shouldSkip(parent) || parent?.closest('textarea,input')) return;
      const current = text.nodeValue || '';
      const previous = translatedTexts.get(text);
      if (previous?.translated === current) return;
      const original = current;
      const translated = translateUiText(original, 'ar');
      if (translated !== original) {
        translatedTexts.set(text, { original, translated });
        text.nodeValue = translated;
      } else {
        translatedTexts.delete(text);
      }
    };

    const translateAttributes = (element: HTMLElement) => {
      if (shouldSkip(element)) return;
      const attributes = translatedAttributes.get(element) || new Map<string, { original: string; translated: string }>();
      for (const name of ['placeholder', 'title', 'aria-label']) {
        const current = element.getAttribute(name);
        if (!current) continue;
        const previous = attributes.get(name);
        if (previous?.translated === current) continue;
        const translated = translateUiText(current, 'ar');
        if (translated !== current) {
          attributes.set(name, { original: current, translated });
          element.setAttribute(name, translated);
        } else {
          attributes.delete(name);
        }
      }
      if (attributes.size) translatedAttributes.set(element, attributes);
      else translatedAttributes.delete(element);
    };

    const translateRoot = (root: Node) => {
      if (root instanceof HTMLElement && root.matches('[placeholder],[title],[aria-label]')) translateAttributes(root);
      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      const translateBatch = () => {
        if (root !== document.body && root instanceof Node && !root.isConnected) return;
        let count = 0;
        while (node && count < 250) {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
          else if (node instanceof HTMLElement && node.matches('[placeholder],[title],[aria-label]')) translateAttributes(node);
          node = walker.nextNode();
          count++;
        }
        if (node) {
          const nextTimer = setTimeout(() => {
            translationTimers.delete(nextTimer);
            translateBatch();
          }, 0);
          translationTimers.add(nextTimer);
        }
      };
      translateBatch();
    };

    translateRoot(document.body);

    const observer = new MutationObserver(mutations => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (running) return;
        running = true;
        try {
          for (const mutation of mutations) {
            if (mutation.type === 'characterData') translateTextNode(mutation.target as Text);
            if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) translateAttributes(mutation.target);
            for (const added of Array.from(mutation.addedNodes)) {
              if (added.nodeType === Node.ELEMENT_NODE) translateRoot(added as Element);
              else if (added.nodeType === Node.TEXT_NODE) translateTextNode(added as Text);
            }
          }
        } finally {
          running = false;
        }
      }, 40);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    const refreshLearnedTranslations = () => translateRoot(document.body);
    window.addEventListener('lang-discovered', refreshLearnedTranslations);
    return () => {
      observer.disconnect();
      window.removeEventListener('lang-discovered', refreshLearnedTranslations);
      if (timer) clearTimeout(timer);
      translationTimers.forEach(clearTimeout);
      const textEntries = translatedTexts.entries();
      const attributeEntries = translatedAttributes.entries();
      let textDone = false;
      let attributesDone = false;
      const restoreBatch = () => {
        let count = 0;
        while (!textDone && count < 250) {
          const next = textEntries.next();
          if (next.done) { textDone = true; break; }
          const [text, { original, translated }] = next.value;
          if (text.isConnected && text.nodeValue === translated) text.nodeValue = original;
          count++;
        }
        while (!attributesDone && count < 250) {
          const next = attributeEntries.next();
          if (next.done) { attributesDone = true; break; }
          const [element, attributes] = next.value;
          if (element.isConnected) attributes.forEach(({ original, translated }, name) => {
            if (element.getAttribute(name) === translated) element.setAttribute(name, original);
          });
          count++;
        }
        if (!textDone || !attributesDone) setTimeout(restoreBatch, 0);
      };
      setTimeout(restoreBatch, 0);
    };
  }, [lang]);


  // Sync current user if modified in DB
  useEffect(() => {
    const syncUser = () => {
      if (!user?.id) return;
      const refreshed = db.getUsers().find(u => u.id === user.id);
      if (refreshed) {
        if (refreshed.revoked) {
          alert('Your access permissions have been suspended or revoked by System Administration.');
          handleLogout();
          return;
        }
        setUser({ ...refreshed });
        localStorage.setItem('user', JSON.stringify(refreshed));
      }
    };
    window.addEventListener('db-undo-success', syncUser);
    return () => window.removeEventListener('db-undo-success', syncUser);
  }, [user?.id]);

  const handleLogin = async (email: string, pass: string) => {
    const result = await loginWithPassword(email.trim(), pass);
    if (result.user) {
      const u = result.user;
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
      await db.loadAll().catch(err => console.error('Failed to load data after login:', err));
      setActiveScreen(
        u.role === UserRole.GATE_OPERATOR
          ? 'port-gate'
          : u.role === UserRole.CUSTOMER
            ? 'cust-reservations'
            : 'dashboard'
      );
    } else if (result.error === 'REVOKED') {
      alert(lang === 'ar' ? 'تم تعليق هذا الحساب من قبل الإدارة' : 'This account access has been suspended/revoked by system administrator.');
    } else {
      alert(lang === 'ar' ? (result.error || 'فشل المصادقة') : (result.error || 'Authentication failed'));
    }
  };

  const handleLogout = useCallback(async () => {
    await supabaseLogout();
    setUser(null);
    localStorage.removeItem('user');
    window.location.hash = '';
  }, []);

  const navigateTo = useCallback((screen: string, id?: string) => {
    setHighlightId(id || null);
    setActiveScreen(screen);
    setOpenScreens(current => current.includes(screen) ? current : [...current, screen]);
    window.location.hash = screen;
  }, []);

  useEffect(() => {
    sessionStorage.setItem('openScreens', JSON.stringify(openScreens));
  }, [openScreens]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary,#f8fafc)] text-[var(--text-primary,#0f172a)]">
        <div className="text-center">
          <img src="/nile-fleet-logo.png" className="h-20 w-20 object-contain mx-auto mb-4" alt="Nile Fleet" />
          <div className="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em]">NILE FLEET</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LanguageContext value={languageContextValue}>
        <ThemeContext value={themeContextValue}>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
            <Login onLogin={handleLogin} />
          </Suspense>
        </ThemeContext>
      </LanguageContext>
    );
  }

  const canAccessScreen = (screen: string): boolean => {
    if (screen === 'no-access') return true;
    // DALI/Fleet Intelligence is an internal staff capability and must never be available to customer accounts,
    // even if an administrator accidentally leaves the screen in the customer's custom allowedScreens list.
    if (user.role === UserRole.CUSTOMER) return ['cust-reservations', 'cust-invoices', 'notifications', 'support'].includes(screen);
    if (Array.isArray(user.allowedScreens)) return user.allowedScreens.includes(screen);
    return getDefaultAllowedScreens(user.role).includes(screen);
  };

  const renderScreen = (screen: string) => {
    if (!canAccessScreen(screen)) {
      return <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm font-bold text-amber-900">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى هذه الشاشة.' : 'You do not have access to this screen.'}</div>;
    }

    switch (screen) {
      case 'no-access': return <div role="status" className="mx-auto mt-16 max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">{lang === 'ar' ? 'لم يتم تعيين أي شاشات لهذا الحساب. تواصل مع مسؤول النظام.' : 'No screens are assigned to this account. Contact your administrator.'}</div>;
      case 'dashboard': return <Dashboard onNavigate={navigateTo} />;
      case 'analytics': return <Analytics />;
      case 'master-view': return <MasterView />;
      case 'port-gate': return <PortGateControl />;
      case 'operations': return <Operations highlightId={highlightId} clearHighlight={() => setHighlightId(null)} />;
      case 'booking-invoices': return <BookingInvoices />;
      case 'intelligence': return <Intelligence />;
      case 'reports': return <Reports />;
      case 'stock': return <StockManagement />;
      case 'reservations': return <Reservations />;
      case 'customers': return <Customers />;
      case 'user-mgmt': return <UserMgmt />;
      case 'customer-prices': return <CustomerPrices />;
      case 'financials': return <Financials />;
      case 'support': return <CustomerService />;
      case 'notifications': return <Notifications />;
      case 'system-log': return <HistoryLog />;
      case 'user-settings': return <UserSettings user={user} onUpdate={(updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }} />;
      case 'cust-reservations': return user.role === UserRole.CUSTOMER ? <CustomerPortal user={user} type="reservations" /> : <Reservations />;
      case 'cust-invoices': return <CustomerPortal user={user} type="invoices" />;
      default: return <Dashboard onNavigate={navigateTo} />;
    }
  };

  const setScreenFromLayout = (screen: string) => {
    setHighlightId(null);
    setActiveScreen(screen);
    setOpenScreens(current => current.includes(screen) ? current : [...current, screen]);
    window.location.hash = screen;
  };

  const closeScreenTab = (screen: string) => {
    const remaining = openScreens.filter(openScreen => openScreen !== screen);
    const homeScreen = user.role === UserRole.GATE_OPERATOR
      ? 'port-gate'
      : user.role === UserRole.CUSTOMER ? 'cust-reservations' : 'dashboard';
    const nextScreen = remaining.length
      ? remaining[remaining.length - 1]
      : canAccessScreen(homeScreen)
        ? homeScreen
        : 'no-access';
    const nextScreens = remaining.length ? remaining : nextScreen === 'no-access' ? [] : [nextScreen];
    setOpenScreens(nextScreens);
    if (activeScreen === screen) {
      setActiveScreen(nextScreen);
      window.location.hash = nextScreen === 'no-access' ? '' : nextScreen;
    }
  };

  return (
    <LanguageContext value={languageContextValue}>
      <ThemeContext value={themeContextValue}>
        <Layout 
          user={user} 
          onLogout={handleLogout} 
          activeScreen={activeScreen} 
          setActiveScreen={setScreenFromLayout}
          openScreens={openScreens}
          onCloseScreen={closeScreenTab}
        >
          <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-slate-500">Loading…</div>}>
            {(openScreens.length ? openScreens : ['no-access']).map(screen => (
              <div key={screen} hidden={screen !== activeScreen} className="min-h-full">
                {renderScreen(screen)}
              </div>
            ))}
          </Suspense>
        </Layout>
      </ThemeContext>
    </LanguageContext>
  );
};

export default App;
