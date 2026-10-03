
import React, { lazy, Suspense, useState, createContext, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
const Login = lazy(() => import('./screens/Login'));
const CompanyHome = lazy(() => import('./screens/CompanyHomeV4'));
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
const DaliKnowledgeCenter = lazy(() => import('./screens/DaliKnowledgeCenter'));
const Organization = lazy(() => import('./screens/Organization'));
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
  if (role === UserRole.ADMIN) return ['dali-knowledge', 'dashboard', 'analytics', 'master-view', 'port-gate', 'operations', 'booking-invoices', 'financials', 'intelligence', 'reports', 'stock', 'reservations', 'customers', 'user-mgmt', 'organization', 'customer-prices', 'financials', 'support', 'notifications', 'system-log', 'user-settings'];
  if (role === UserRole.MANAGER) return ['dali-knowledge', 'dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials', 'intelligence', 'reports', 'notifications', 'system-log', 'support', 'user-settings', 'organization'];
  if (role === UserRole.VIEWER) return ['dali-knowledge', 'dashboard', 'master-view', 'reports', 'intelligence', 'notifications', 'support', 'system-log'];
  if (role === UserRole.GATE_OPERATOR) return ['port-gate', 'notifications', 'support', 'user-settings'];
  return ['cust-reservations', 'cust-invoices', 'notifications', 'support', 'user-settings'];
};
export type ThemeMode = 'day' | 'night';

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
  theme: 'day', 
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
  const [showCompanyHome, setShowCompanyHome] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [appDataReady, setAppDataReady] = useState(false);
  const loggingInRef = useRef(false);
  
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'day' || saved === 'night' ? saved : 'night';
  });

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('app_scale');
    return saved ? parseFloat(saved) : 0.85;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('app_muted') === 'true';
  });

  // Legacy custom-theme storage is intentionally ignored: the application now has exactly two modes.

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
  // Mobile performance: keep only the active screen mounted. Hidden desktop tabs can be expensive on phones.
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  // All screens read business data from the shared SupabaseDB cache. Bump this
  // version whenever that cache changes so mounted screens (including hidden
  // tabs) re-render from the same current source of truth.
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const refreshAllScreens = () => setDataVersion(v => v + 1);
    window.addEventListener('db-change', refreshAllScreens);
    window.addEventListener('db-undo-success', refreshAllScreens);
    return () => {
      window.removeEventListener('db-change', refreshAllScreens);
      window.removeEventListener('db-undo-success', refreshAllScreens);
    };
  }, []);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'en';
  });
  const languageContextValue = useMemo(() => ({ lang, setLang }), [lang]);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const isDark = theme === 'night';

  const updateCustomTheme = useCallback((_colors: {
    bg: string; text: string; textSec: string; card: string; accent: string;
    border: string; input: string; isDark: boolean; rowBg?: string; railBg?: string;
  }) => {
    // Legacy compatibility API. Custom visual themes are no longer supported.
  }, []);

  const themeContextValue = useMemo(() => ({
    theme, setTheme, scale, setScale, isMuted, setIsMuted, isDark, updateCustomTheme
  }), [theme, scale, isMuted, isDark, updateCustomTheme]);

  useEffect(() => {
    document.body.classList.remove('theme-day', 'theme-night');
    document.body.classList.add(isDark ? 'theme-night' : 'theme-day');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
  }, [theme, isDark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', String(scale));
    localStorage.setItem('app_scale', String(scale));
  }, [scale]);

  // System-wide Arabic typography: preserve shaping, RTL flow, and LTR identifiers.
  useEffect(() => {
    const arabicPattern = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH']);

    const applyArabicTypography = (element: HTMLElement) => {
      if (skipTags.has(element.tagName)) return;
      const value = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.value
        : element.textContent || '';
      const hasArabic = arabicPattern.test(value);
      element.classList.toggle('nf-arabic-text', hasArabic);
      if (hasArabic) {
        const hasLatin = /[A-Za-z]/.test(value);
        element.setAttribute('lang', 'ar');
        element.setAttribute('dir', hasLatin ? 'auto' : 'rtl');
      } else if (element.classList.contains('nf-arabic-text')) {
        element.removeAttribute('lang');
        element.removeAttribute('dir');
      }
    };

    const scan = (root: Node = document.body) => {
      if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) return;
      if (root instanceof HTMLElement && (root.matches('input, textarea') || root.childElementCount === 0)) applyArabicTypography(root);
      root.querySelectorAll?.('input, textarea, [data-arabic]').forEach(node => {
        if (node instanceof HTMLElement) applyArabicTypography(node);
      });
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName)) continue;
        if (parent.children.length === 0) applyArabicTypography(parent);
      }
    };

    scan();
    const observer = new MutationObserver(mutations => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.parentElement) applyArabicTypography(mutation.target.parentElement);
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) applyArabicTypography(node.parentElement);
        });
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const handleInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) applyArabicTypography(target);
    };
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
    };
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
        setShowCompanyHome(false);
        setUser(sessionUser);
        localStorage.setItem('user', JSON.stringify(sessionUser));

        // Load protected business data only after authentication succeeds.
        await db.loadAll().catch(err => console.error('Failed to load data from Supabase:', err));
        if (!cancelled) setAppDataReady(true);

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
      // While the login screen is verifying/celebrating, don't open the app early.
      if (loggingInRef.current && event !== 'SIGNED_OUT') return;

      window.setTimeout(async () => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT') {
          await db.resetSessionCache();
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
      'dali-knowledge', 'dashboard', 'analytics', 'master-view', 'operations', 'port-gate',
      'booking-invoices', 'intelligence', 'reports', 'stock', 'reservations',
      'customers', 'user-mgmt', 'organization', 'customer-prices', 'support',
      'notifications', 'system-log', 'user-settings', 'cust-reservations',
      'cust-invoices'
    ]);
    const role = user?.role || UserRole.CUSTOMER;
    const roleScreens = getDefaultAllowedScreens(role);
    const homeScreen = roleScreens.includes('dashboard') ? 'dashboard' : roleScreens.includes('port-gate') ? 'port-gate' : 'cust-reservations';
    const permittedScreens = user?.role === UserRole.CUSTOMER
      ? new Set(['cust-reservations', 'cust-invoices', 'notifications', 'support'])
      : new Set(
          (Array.isArray(user?.allowedScreens) ? user.allowedScreens : roleScreens)
            .filter(screen => allScreens.has(screen))
            .concat(
              user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER
                ? ['financials']
                : []
            )
        );
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

  // Returns a function that enters the app once the login screen has shown "Access Granted",
  // or null if sign-in failed. The auth listener is paused while sign-in is in progress so
  // the app doesn't open before the success screen.
  const handleLogin = async (email: string, pass: string): Promise<(() => void) | null> => {
    loggingInRef.current = true;
    try {
      const result = await loginWithPassword(email.trim(), pass);
      if (result.user) {
        const u = result.user;
        await db.loadAll().catch(err => console.error('Failed to load data after login:', err));
        return () => {
          loggingInRef.current = false;
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
          setActiveScreen(
            u.role === UserRole.GATE_OPERATOR
              ? 'port-gate'
              : u.role === UserRole.CUSTOMER
                ? 'cust-reservations'
                : 'dashboard'
          );
        };
      }
      loggingInRef.current = false;
      if (result.error === 'REVOKED') {
        alert(lang === 'ar' ? 'تم تعليق هذا الحساب من قبل الإدارة' : 'This account access has been suspended/revoked by system administrator.');
      } else {
        alert(lang === 'ar' ? (result.error || 'فشل المصادقة') : (result.error || 'Authentication failed'));
      }
      return null;
    } catch (err) {
      loggingInRef.current = false;
      console.error('Login error:', err);
      alert(lang === 'ar' ? 'فشل المصادقة' : 'Authentication failed');
      return null;
    }
  };

  const handleLogout = useCallback(async () => {
    await supabaseLogout();
    await db.resetSessionCache();
    setUser(null);
    setShowCompanyHome(true);
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

  if (!authChecked || (user && !appDataReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070a] text-white overflow-hidden">
        <div className="relative text-center">
          <div className="absolute -inset-16 rounded-full bg-[#C2A378]/5 blur-3xl pointer-events-none" />
          <div className="relative mx-auto mb-7 h-24 w-24 rounded-full border border-[#C2A378]/25 bg-[#0b0e12] flex items-center justify-center shadow-[0_0_55px_rgba(194,163,120,.08)]">
            <img src="/nile-fleet-logo.png" className="h-16 w-16 object-contain" alt="Nile Fleet" />
            <span className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#C2A378] animate-spin" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#C2A378]">NILE FLEET</p>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.28em] text-white/55">
            {lang === 'ar' ? (user ? 'جاري تحميل بيانات النظام' : 'جاري التحقق من الجلسة') : (user ? 'LOADING SYSTEM DATA' : 'VERIFYING SESSION')}
          </p>
          <div className="mx-auto mt-4 h-px w-20 overflow-hidden bg-white/10">
            <div className="h-full w-1/2 bg-[#C2A378] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LanguageContext value={languageContextValue}>
        <ThemeContext value={themeContextValue}>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
            {showCompanyHome ? (
              <CompanyHome onGenset={() => setShowCompanyHome(false)} />
            ) : (
              <Login onLogin={handleLogin} onBackToHome={() => setShowCompanyHome(true)} />
            )}
          </Suspense>
        </ThemeContext>
      </LanguageContext>
    );
  }

  const canAccessScreen = (screen: string): boolean => {
    if (screen === 'no-access') return true;
    // Customers stay isolated from all internal staff screens.
    if (user.role === UserRole.CUSTOMER) return ['cust-reservations', 'cust-invoices', 'notifications', 'support'].includes(screen);

    if (Array.isArray(user.allowedScreens)) {
      // Finance is an internal financial-control screen and must remain reachable
      // for Admin/Manager accounts even when an older allowedScreens profile is stale.
      if (screen === 'financials' && (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER)) {
        return true;
      }
      return user.allowedScreens.includes(screen);
    }

    return getDefaultAllowedScreens(user.role).includes(screen);
  };

  const renderScreen = (screen: string) => {
    if (!canAccessScreen(screen)) {
      return <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm font-bold text-amber-900">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى هذه الشاشة.' : 'You do not have access to this screen.'}</div>;
    }

    switch (screen) {
      case 'no-access': return <div role="status" className="mx-auto mt-16 max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">{lang === 'ar' ? 'لم يتم تعيين أي شاشات لهذا الحساب. تواصل مع مسؤول النظام.' : 'No screens are assigned to this account. Contact your administrator.'}</div>;
      case 'dali-knowledge': return <DaliKnowledgeCenter />;
      case 'dashboard': return <Dashboard onNavigate={navigateTo} />;
      case 'analytics': return <Analytics />;
      case 'master-view': return <MasterView />;
      case 'port-gate': return <PortGateControl />;
      case 'operations': return <Operations highlightId={highlightId} clearHighlight={() => setHighlightId(null)} />;
      case 'booking-invoices': return <BookingInvoices />;
      case 'financials': return <Financials />;
      case 'intelligence': return <Intelligence />;
      case 'reports': return <Reports />;
      case 'stock': return <StockManagement />;
      case 'reservations': return <Reservations />;
      case 'customers': return <Customers />;
      case 'user-mgmt': return <UserMgmt />;
      case 'organization': return <Organization />;
      case 'customer-prices': return <CustomerPrices />;
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
            {(isMobileViewport ? [activeScreen] : (openScreens.length ? openScreens : ['no-access'])).map(screen => (
              <div key={`${screen}-${dataVersion}`} hidden={!isMobileViewport && screen !== activeScreen} className="min-h-full min-w-0">
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
