
import React, { useContext, useState, useEffect, useRef } from 'react';
import { User, UserRole, SystemNotification, GensetStatus } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity, dynamicTranslations } from '../translations';
import { db } from '../services/supabaseDb';
import { runThinkingAudit } from '../services/aiService';
import { getDaliRecentMemory, getDaliConversationMemory, saveDaliConversationMessage, getDaliChatSessions, archiveDaliConversation } from '../services/daliMemory';
import { searchDaliKnowledge } from '../services/daliKnowledge';
import { getTerminology } from '../services/daliTerminology';
import { getDaliCustomerAliases } from '../services/daliCustomerAliases';
import type { DaliCustomerAlias } from '../services/daliCustomerAliases';
import { buildDaliOrganizationContext, isDaliAllowedRole } from '../services/daliOrganization';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  openScreens: string[];
  onCloseScreen: (screen: string) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, activeScreen, setActiveScreen, openScreens, onCloseScreen, children }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const { theme, setTheme, isMuted, setIsMuted, isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  const isCreator = user.isCreator === true || String(user.email || '').trim().toLowerCase() === 'bebito@nilefleet.com';
  // The system creator must always be able to open DALI, even if the cached user profile has a stale role.
  // Organization-based role checks still protect DALI for all other users.
  const canUseDali = isCreator || isDaliAllowedRole(user);

  // DALI's age is calculated from its anniversary instead of being hard-coded.
  const DALI_BIRTH_DATE = '2025-10-03';
  const getDaliAge = () => {
    const today = new Date();
    const birth = new Date(`${DALI_BIRTH_DATE}T00:00:00`);
    let age = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return Math.max(0, age);
  };
  const getDaliAgeText = (arabic: boolean) => {
    const age = getDaliAge();
    if (!arabic) return `${age} ${age === 1 ? 'year' : 'years'} old`;
    if (age === 0) return 'لسه ما كملتش سنة';
    if (age === 1) return 'سنة واحدة';
    if (age === 2) return 'سنتين';
    if (age >= 3 && age <= 10) return `${age} سنين`;
    return `${age} سنة`;
  };
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(db.getActiveNotifications(user));
  const mainContentRef = useRef<HTMLElement>(null);
  const screenScrollPositions = useRef(new Map<string, number>());
  const [activePortGateTab, setActivePortGateTab] = useState<'GATE' | 'TRANSIT' | 'UPCOMING'>(() => (sessionStorage.getItem('portGateTab') as any) || 'GATE');
  const [isPortGateSubmenuCollapsed, setIsPortGateSubmenuCollapsed] = useState<boolean>(() => sessionStorage.getItem('portGateSubmenuCollapsed') === 'true');
  const [activeInvoicesTab, setActiveInvoicesTab] = useState<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>(() => (sessionStorage.getItem('invoicesTab') as any) || 'ALL');
  const [isInvoicesSubmenuCollapsed, setIsInvoicesSubmenuCollapsed] = useState<boolean>(() => sessionStorage.getItem('invoicesSubmenuCollapsed') === 'true');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [daliFirstMessageAnimation, setDaliFirstMessageAnimation] = useState(false);
  const [daliThinkingPhase, setDaliThinkingPhase] = useState(0);
  const [daliSuggestedSet, setDaliSuggestedSet] = useState(0);
  const [daliIntroCompleted, setDaliIntroCompleted] = useState(() => { try { return localStorage.getItem('nile-dali-intro-completed-' + (user.id || user.email || 'user')) === 'true'; } catch { return false; } });
  const [daliPostIntroSuggestion, setDaliPostIntroSuggestion] = useState(false);
  const [daliArchiveOpen, setDaliArchiveOpen] = useState(false);
  const [daliArchivedChats, setDaliArchivedChats] = useState<any[]>([]);
  const [daliHistoryLoading, setDaliHistoryLoading] = useState(false);
  const daliSessionIdRef = useRef<string>(crypto.randomUUID());
  const [daliMemory, setDaliMemory] = useState<{ role: 'user' | 'assistant'; message: string; entities?: any; created_at?: string }[]>([]);
  const [daliButtonPosition, setDaliButtonPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nile-dali-button-position-v2') || '{"right":24,"bottom":72}'); }
    catch { return { right: 24, bottom: 72 }; }
  });
  const [daliViewport, setDaliViewport] = useState(() => ({
    height: typeof window !== 'undefined' ? window.visualViewport?.height || window.innerHeight : 800,
    keyboardInset: 0
  }));
  const daliDraggingRef = useRef(false);
  const daliDraggedRef = useRef(false);
  const daliDragStartRef = useRef({ x: 0, y: 0, right: 24, bottom: 24 });
  const [themeIslandOpen, setThemeIslandOpen] = useState(false);
  const themeIslandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      const isCurrentlyFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(isCurrentlyFs);
      if (isCurrentlyFs) {
        setIsPseudoFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    
    const updateNotifs = () => setNotifications(db.getActiveNotifications(user));
    window.addEventListener('db-undo-success', updateNotifs);
    window.addEventListener('db-change', updateNotifs);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      window.removeEventListener('db-undo-success', updateNotifs);
      window.removeEventListener('db-change', updateNotifs);
    };
  }, [user]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<'GATE' | 'TRANSIT' | 'UPCOMING'>;
      if (customEvent.detail) {
        setActivePortGateTab(customEvent.detail);
      }
    };
    window.addEventListener('port-gate-tab-change', handleTabChange);
    return () => {
      window.removeEventListener('port-gate-tab-change', handleTabChange);
    };
  }, []);

  useEffect(() => {
    const handleInvoicesTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>;
      if (customEvent.detail) {
        setActiveInvoicesTab(customEvent.detail);
      }
    };
    window.addEventListener('invoices-tab-change', handleInvoicesTabChange);
    return () => {
      window.removeEventListener('invoices-tab-change', handleInvoicesTabChange);
    };
  }, []);

  useEffect(() => {
    if (!aiChatLoading) {
      setDaliThinkingPhase(0);
      return;
    }
    // DALI thinking is intentionally simple: one sentence at a time.
    // The phase changes every 1.6s so long searches feel alive without stacking messages.
    const timer = window.setInterval(() => {
      setDaliThinkingPhase(prev => (prev + 1) % 4);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [aiChatLoading]);

  // Suggested questions rotate gently so DALI feels alive instead of presenting
  // the same fixed menu on every visit. The first set introduces DALI itself.
  useEffect(() => {
    if (aiChatMessages.length > 0 || daliArchiveOpen) return;
    const timer = window.setInterval(() => {
      setDaliSuggestedSet(prev => (prev + 1) % 2);
    }, 24000);
    return () => window.clearInterval(timer);
  }, [aiChatMessages.length, daliArchiveOpen]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    // Keyboard detection only needs viewport resize events. Listening to
    // visualViewport scroll fires continuously while the page is being scrolled
    // on iOS and forces a React state update for every scroll frame.
    const updateDaliViewport = () => {
      const keyboardInset = Math.max(0, window.innerHeight - (visualViewport.height + visualViewport.offsetTop));
      const next = {
        height: visualViewport.height,
        keyboardInset: window.innerWidth < 640 ? keyboardInset : 0
      };
      setDaliViewport(prev =>
        prev.height === next.height && prev.keyboardInset === next.keyboardInset ? prev : next
      );
    };
    updateDaliViewport();
    visualViewport.addEventListener('resize', updateDaliViewport);
    window.addEventListener('resize', updateDaliViewport);
    return () => {
      visualViewport.removeEventListener('resize', updateDaliViewport);
      window.removeEventListener('resize', updateDaliViewport);
    };
  }, []);

  useEffect(() => {
    const handleDaliAsk = (event: Event) => {
      const question = String((event as CustomEvent).detail || '').trim();
      if (!question) return;
      setIsAiChatOpen(true);
      setAiChatInput(question);
      window.setTimeout(() => {
        const button = document.querySelector('[data-dali-send]') as HTMLButtonElement | null;
        button?.click();
      }, 0);
    };
    window.addEventListener('dali-ask', handleDaliAsk);
    return () => window.removeEventListener('dali-ask', handleDaliAsk);
  }, []);

  const saveDaliButtonPosition = (next: { right: number; bottom: number }) => {
    setDaliButtonPosition(next);
    localStorage.setItem('nile-dali-button-position-v2', JSON.stringify(next));
  };

  const handleDaliPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    daliDraggingRef.current = true;
    daliDraggedRef.current = false;
    daliDragStartRef.current = { x: e.clientX, y: e.clientY, right: daliButtonPosition.right, bottom: daliButtonPosition.bottom };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleDaliPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!daliDraggingRef.current) return;
    const start = daliDragStartRef.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) daliDraggedRef.current = true;
    const next = {
      right: Math.max(8, Math.min(window.innerWidth - 70, start.right - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - 70, start.bottom - dy))
    };
    setDaliButtonPosition(next);
  };

  const handleDaliPointerUp = (e?: React.PointerEvent<HTMLButtonElement>) => {
    if (!daliDraggingRef.current) return;
    const start = daliDragStartRef.current;
    const dx = e ? e.clientX - start.x : 0;
    const dy = e ? e.clientY - start.y : 0;
    const next = {
      right: Math.max(8, Math.min(window.innerWidth - 70, start.right - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - 70, start.bottom - dy))
    };
    daliDraggingRef.current = false;
    setDaliButtonPosition(next);
    if (daliDraggedRef.current) localStorage.setItem('nile-dali-button-position', JSON.stringify(next));
  };

  // Every new DALI chat opens blank. Older chats are persistent, but are only
  // brought back deliberately from Archive so the assistant never silently
  // mixes an old conversation into a new question.
  const completeDaliIntro = () => { setDaliIntroCompleted(true); setDaliPostIntroSuggestion(true); try { localStorage.setItem('nile-dali-intro-completed-' + (user.id || user.email || 'user'), 'true'); } catch {} };

  const clearDaliChat = async () => {
    if (aiChatLoading) return;
    // Starting a new chat archives the current session first. This keeps the
    // visible conversation blank AND prevents old context from leaking into
    // the next DALI question.
    if (daliMemory.length) {
      try { await archiveDaliConversation(daliSessionIdRef.current, true); }
      catch (archiveError) { console.warn('DALI auto-archive failed:', archiveError); }
    }
    setAiChatMessages([]);
    setAiChatInput('');
    setDaliMemory([]);
    setDaliArchiveOpen(false);
    setDaliPostIntroSuggestion(false);
    daliSessionIdRef.current = crypto.randomUUID();
  };

  const loadDaliArchive = async () => {
    if (daliHistoryLoading) return;
    setDaliHistoryLoading(true);
    try {
      const sessions = await getDaliChatSessions(true);
      setDaliArchivedChats(sessions.filter((s: any) => s.archived));
      setDaliArchiveOpen(true);
    } catch (historyError) {
      console.warn('DALI archive load failed:', historyError);
    } finally {
      setDaliHistoryLoading(false);
    }
  };

  const restoreDaliArchivedChat = async (sessionId: string) => {
    if (aiChatLoading) return;
    try {
      const stored = await getDaliConversationMemory(sessionId, 100);
      const visible = stored
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({ role: m.role === 'assistant' ? 'ai' : 'user', text: String(m.message || '') }))
        .filter(m => m.text.trim());
      if (!visible.length) return;
      setAiChatMessages(visible as { role: 'user' | 'ai'; text: string }[]);
      setDaliMemory(stored.map((m: any) => ({ role: m.role, message: m.message, entities: m.entities, created_at: m.created_at })).slice(-30));
      daliSessionIdRef.current = sessionId;
      setDaliArchiveOpen(false);
    } catch (historyError) {
      console.warn('DALI archived chat restore failed:', historyError);
    }
  };

  const archiveCurrentDaliChat = async () => {
    if (aiChatLoading || !daliMemory.length) return;
    try {
      await archiveDaliConversation(daliSessionIdRef.current, true);
      setAiChatMessages([]);
      setAiChatInput('');
      setDaliMemory([]);
      setDaliArchiveOpen(false);
      daliSessionIdRef.current = crypto.randomUUID();
    } catch (archiveError) {
      console.warn('DALI archive save failed:', archiveError);
    }
  };

  const saveDaliMemory = async (role: 'user' | 'assistant', message: string, entities: any = {}) => {
    try {
      await saveDaliConversationMessage({
        sessionId: daliSessionIdRef.current,
        role,
        message,
        entities,
      });
    } catch (memoryError) {
      console.warn('DALI memory save failed:', memoryError);
    }
  };

  // Each mounted app starts a fresh visible chat. Persistent DALI memory remains in Supabase
  // and is loaded by askNileAi when the user asks a new question, so continuity is preserved
  // without replaying the previous chat into the new session's UI.
  const askNileAi = async () => {
    const question = aiChatInput.trim();
    if (!question || aiChatLoading) return;
    const identityQuestion = /^(?:مين\s+دالي|من\s+هو\s+دالي|ما\s+هو\s+دالي|مين\s+انت|من\s+انت|who\s+is\s+dali|what\s+is\s+dali|who\s+are\s+you|tell\s+me\s+about\s+yourself)$/i.test(question.trim().replace(/[؟?!.,،]+$/g, ''));
    // DALI replies in the language the user is actually using. This is independent
    // from the application's UI language, so an Arabic question gets an Arabic answer.
    const questionHasArabic = /[\u0600-\u06FF]/.test(question);
    const responseIsAr = questionHasArabic || isAr;
    setAiChatInput('');
    setAiChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setDaliMemory(prev => [...prev, { role: 'user', message: question }].slice(-30));
    await saveDaliMemory('user', question);
    setAiChatLoading(true);
    if (aiChatMessages.length === 0) {
      setDaliFirstMessageAnimation(true);
      window.setTimeout(() => setDaliFirstMessageAnimation(false), 1200);
    }

    // HARD DATA-FIRST ROUTES: never send simple operational counts to the AI model.
    // This guarantees questions such as "Gensets in maintenance?" always use live stock data.
    const normalizedEarlyQuestion = question
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ةه]/g, 'ه')
      .replace(/[ى]/g, 'ي')
      .replace(/[^\\p{L}\\p{N}]+/gu, ' ')
      .trim()
      .replace(/\\s+/g, ' ');
    const asksMaintenanceEarly = /\\b(?:which|what|list|show)?\\s*(?:the\\s*)?(?:gensets?|generators?|units?)\\s*(?:are\\s+|in\\s+|under\\s+)?maintenance\\b|\\bmaintenance\\b.*\\b(?:gensets?|generators?|units?)\\b|في\\s*الصيانة|بالصيانة|صيانة.*المولدات|المولدات.*صيانة|مولدات.*صيانة|مين.*محتاج.*صيانة|محتاج.*صيانة/.test(normalizedEarlyQuestion);
    if (asksMaintenanceEarly) {
      const maintenanceUnits = db.getStock()
        .filter((g: any) => String(g.status || '').toUpperCase() === 'MAINTENANCE')
        .map((g: any) => String(g.unitNumber || g.gensetNumber || '').trim())
        .filter(Boolean);
      const directAnswer = responseIsAr
        ? 'المولدات الموجودة في الصيانة: ' + maintenanceUnits.length + '\\n' + (maintenanceUnits.length ? maintenanceUnits.join('، ') : 'لا يوجد')
        : 'Gensets in maintenance: ' + maintenanceUnits.length + '\\n' + (maintenanceUnits.length ? maintenanceUnits.join(', ') : 'None');
      setAiChatMessages(prev => [...prev, { role: 'ai', text: directAnswer }]);
      setDaliMemory(prev => [...prev, { role: 'assistant', message: directAnswer }].slice(-30));
      void saveDaliMemory('assistant', directAnswer);
      setAiChatLoading(false);
      return;
    }

    try {
      const operations = db.getOperations();
      const gensets = db.getStock();
      const invoices = db.getInvoices();
      const maintenance = db.getMaintenanceLogs();
      const reservations = db.getReservations();
      const localDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const currentDateKey = localDateKey(new Date());
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowDateKey = localDateKey(tomorrowDate);
      const reservationOperationIds = new Set(operations.map(o => o.reservationId).filter(Boolean));
      const pendingWork = reservations
        .filter(r => (r.status === 'PENDING' || r.status === 'APPROVED') && !reservationOperationIds.has(r.id))
        .map(r => ({
          customer: r.customerName || 'UNKNOWN',
          booking: r.bookingNumber || '',
          requested: Number(r.gensetsNeeded) || 0,
          date: r.reservationDate || '',
          portIn: r.portIn || '',
          portOut: r.portOut || '',
          status: r.status,
          shipper: r.shipper || '',
          beneficiary: r.beneficiaryName || ''
        }));

      let recentMemory = daliMemory.slice(-16);
      try {
        // Use cross-session memory first so DALI can continue a conversation after
        // a reload, logout/login, or a new browser session.
        const storedMemory = await getDaliRecentMemory(24);
        if (storedMemory.length) recentMemory = storedMemory;
        else {
          const sessionMemory = await getDaliConversationMemory(daliSessionIdRef.current, 16);
          if (sessionMemory.length) recentMemory = sessionMemory;
        }
      } catch (memoryError) {
        console.warn('DALI memory load failed; using local conversation memory:', memoryError);
      }
      const memoryContext = recentMemory.length
        ? recentMemory.map((m: any) => `[${m.role}] ${m.message}`).join('\\n')
        : 'No previous conversation in this session.';
      let daliKnowledgeContext = 'No company knowledge matched this question.';
      try {
        const lessons = await searchDaliKnowledge(question, 10);
        if (lessons.length) daliKnowledgeContext = lessons.map((x: any) => `[${x.category}] ${x.title}: ${x.content}`).join('\\n');
      } catch (knowledgeError) { console.warn('DALI knowledge lookup failed:', knowledgeError); }
      let daliLearnedRegistry: Array<{ canonical_value: string; alias: string; canonical_type: string }> = [];
      try {
        const terms = await getTerminology(2000);
        daliLearnedRegistry = terms
          .filter((x: any) => String(x.source || '').toLowerCase().includes('learned intelligence registry') || String(x.alias_type || '').toLowerCase() === 'manual')
          .map((x: any) => ({ canonical_value: String(x.canonical_value || ''), alias: String(x.alias || ''), canonical_type: String(x.canonical_type || '') }))
          .filter(x => x.canonical_value && x.alias);
      } catch (terminologyError) { console.warn('DALI learned registry lookup failed:', terminologyError); }
      let daliCustomerAliases: DaliCustomerAlias[] = [];
      try {
        daliCustomerAliases = await getDaliCustomerAliases();
      } catch (aliasError) {
        console.warn('DALI customer dictionary lookup failed:', aliasError);
      }

      const learnedRegistryContext = daliLearnedRegistry.length
        ? daliLearnedRegistry.map(x => x.canonical_value + ' → ' + x.alias).join(' | ')
        : 'No learned intelligence registry entries loaded.';

      const creatorContext = isCreator
        ? 'CURRENT USER: Bebito (bebito@nilefleet.com), creator and system owner of NILE FLEET. Treat this user as the creator/owner when relevant. Do not confuse the creator with an ordinary employee or customer. Never reveal passwords, API keys, tokens, or other secrets.'
        : `CURRENT USER: ${user.name || 'Unknown User'} | ROLE: ${user.role || 'Unknown'} | EMAIL: ${user.email || ''}`;
      const organizationContext = await buildDaliOrganizationContext(user, responseIsAr);
      const q = question.toUpperCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
      // Normalized query used by the deterministic fallback.
      // Keep this independent from the customer/entity helpers declared later in this function.
      // Calling a later const initializer here causes a Temporal Dead Zone runtime error.
      const normalizedQuestion = question
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[ى]/g, 'ي')
        .replace(/[^\\p{L}\\p{N}]+/gu, ' ')
        .trim()
        .replace(/\\s+/g, ' ');

      // FAST PATH: factual operational questions never go through the LLM.
      const idMatch = q.match(/(?:GENSETS?|مولد(?:ات)?|وحدة)(?:\s+(?:NO\.?|NUMBER|ID|رقم))?\s*#?\s*([A-Z0-9][A-Z0-9-]*)/i);
      const bookingMatch = q.match(/(?:BOOKING(?:\s+(?:NO\.?|NUMBER|ID))?|حجز(?:\s*رقم)?)\s*#?\s*([A-Z0-9][A-Z0-9-]*)/i);
      const containerMatch = q.match(/(?:CONTAINER|CONT|حاويه|حاوية)(?:\s+(?:NO\.?|NUMBER|ID|رقم))?\s*#?\s*([A-Z0-9]{4,12})/i);
      const searchMatch = q.match(/(?:SEARCH|FIND|WHERE IS|LOCATE|LOOK FOR|ابحث|فين|اين|أين)\s*#?\s*([A-Z0-9-]+)/i);
      const countWords = /HOW MANY|HOW MUCH|NUMBER OF|كام|عدد|كم/.test(q);
      const isIdentifier = (value?: string) => Boolean(value && /\d/.test(value));

      const normalizeId = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const numericId = (value: unknown) => normalizeId(value).replace(/\D/g, '');
      const gensetAliases = (value: unknown) => {
        const raw = normalizeId(value);
        const digits = numericId(value);
        const aliases = new Set<string>();
        if (raw) aliases.add(raw);
        if (digits) {
          aliases.add(digits);
          aliases.add(digits.slice(-4).padStart(4, '0'));
          aliases.add(digits.slice(-4));
        }
        return aliases;
      };
      const gensetMatches = (value: string, g: any) => {
        const queryAliases = gensetAliases(value);
        const normalizedQuery = normalizeId(value);
        const isNumericSuffix = /^\d{3,6}$/.test(normalizedQuery);
        const suffixPattern = isNumericSuffix ? new RegExp(`(?:^|[^A-Z0-9])${normalizedQuery}$`, 'i') : null;
        // Match only actual genset identifiers. Database UUIDs are not serial
        // numbers and can coincidentally end in the digits a user is searching for.
        const recordValues = [g?.gensetNumber, g?.unitNumber];
        return recordValues.some(v => {
          const raw = String(v ?? '').trim().toUpperCase();
          const aliases = gensetAliases(v);
          return [...queryAliases].some(a => aliases.has(a)) || Boolean(suffixPattern?.test(raw));
        });
      };
      const operationGensetMatches = (value: string, o: any) => gensetMatches(value, o);
      const dateValue = (x: any) => String(x?.clipOnDate || x?.operationDate || x?.dateReceived || '');
      const fmtOp = (op: any) => {
        const port = op.clipOnPort || op.clipOffPort || '—';
        return isAr
          ? `الحالة: ${op.status || 'غير محدد'}\nالميناء: ${port}\nالحجز: ${op.bookingNumber || '—'}\nالحاوية: ${op.containerNumber || '—'}`
          : `Status: ${op.status || '—'}\nPort: ${port}\nBooking: ${op.bookingNumber || '—'}\nContainer: ${op.containerNumber || '—'}`;
      };

      // Genset lookup searches BOTH the fleet table's unitNumber and operation history.
      // The original genset number is never changed; the last 4 digits are only an alias.
      const lookupGenset = (id: string) => {
        const stockHits = gensets.filter(g => gensetMatches(id, g));
        const opHits = operations
          .filter(o => operationGensetMatches(id, o))
          .sort((a, b) => dateValue(b).localeCompare(dateValue(a)));
        const maintenanceHits = maintenance
          .filter(m => gensetMatches(id, m))
          .sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
        return { stockHits, opHits, maintenanceHits };
      };

      const answerGenset = async (id: string, questionText = '') => {
        let { stockHits, opHits, maintenanceHits } = lookupGenset(id);
        // If the local cache missed it, query Supabase directly before saying it does not exist.
        if (!stockHits.length && !opHits.length && !maintenanceHits.length) {
          const fresh = await db.searchGensetRecords(id);
          stockHits = fresh.stock;
          opHits = fresh.operations.sort((a, b) => dateValue(b).localeCompare(dateValue(a)));
          maintenanceHits = fresh.maintenance.sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
        }
        if (stockHits.length > 1) {
          const matches = stockHits.map(g => g.unitNumber).join(', ');
          return responseIsAr
            ? `وجدت أكثر من مولد يطابق ${id}: ${matches}. أرسل الرقم التسلسلي الكامل لأحدد الموقع الصحيح.`
            : `More than one genset matches ${id}: ${matches}. Please provide the full serial number to identify the correct unit.`;
        }
        const stock = stockHits[0];
        const latestOp = opHits[0];
        const activeOp = opHits.find(o => String(o.status || '').toUpperCase() === 'IN PROGRESS');
        const latestCompletedOp = opHits.find(o => String(o.status || '').toUpperCase() === 'DONE');
        const latestMaintenance = maintenanceHits[0];
        if (!stock && !latestOp && !latestMaintenance) {
          return responseIsAr ? `المولد ${id} غير موجود في بيانات الأسطول أو السجل التشغيلي.` : `GENSET ${id} was not found in fleet, operations, or maintenance records.`;
        }

        // Every persisted operation matched to this genset is part of its lifetime log.
        // Cancelled records are excluded from the trip count.
        const completedTrips = opHits.filter(o => String(o.status || '').toUpperCase() === 'DONE').length;
        const qText = String(questionText).toUpperCase();
        const wantsTripCount = /HOW MANY|HOW MUCH|NUMBER OF|TRIPS?|OPERATIONS?|رحل|رحلة|رحلات|كام|عدد|كم|عملية|عمليه|عمليات|اشتغل|شغل/.test(qText);
        const wantsHistory = /HISTORY|LOG|PREVIOUS|PAST|HISTOR|سجل|سجلات|تاريخ|سابق|العمليات|رحلات/.test(qText);

        const stockNumber = stock?.unitNumber || id;
        const location = activeOp?.clipOnPort || stock?.location || latestCompletedOp?.clipOffPort || latestOp?.clipOnPort || latestMaintenance?.location || '—';
        const status = stock?.status || latestOp?.status || latestMaintenance?.status || '—';

        if (wantsHistory) {
          const history = opHits.slice(0, 12).map((op, index) => {
            const route = [op.clipOnPort, op.clipOffPort].filter(Boolean).join(' → ') || '—';
            return responseIsAr
              ? `${index + 1}. ${dateValue(op) || '—'} | حجز ${op.bookingNumber || '—'} | حاوية ${op.containerNumber || '—'} | ${route} | ${op.status || '—'}`
              : `${index + 1}. ${dateValue(op) || '—'} | Booking ${op.bookingNumber || '—'} | Container ${op.containerNumber || '—'} | ${route} | ${op.status || '—'}`;
          }).join('\n');
          return responseIsAr
              ? `المولد ${stockNumber} — سجل التشغيل\nعدد الرحلات: ${completedTrips}\nالموقع الحالي: ${location}\nالحالة: ${status}${history ? `\n\n${history}` : '\nلا توجد عمليات سابقة مسجلة.'}`
              : `GENSET ${stockNumber} — Operation Log\nTrips: ${completedTrips}\nCurrent location: ${location}\nStatus: ${status}${history ? `\n\n${history}` : '\nNo previous operations recorded.'}`;
        }

        if (wantsTripCount) {
          return responseIsAr
            ? `المولد ${stockNumber}\nعدد الرحلات: ${completedTrips}\nالموقع الحالي: ${location}\nالحالة: ${status}${latestOp ? `\nآخر حجز: ${latestOp.bookingNumber || '—'} | ${dateValue(latestOp) || '—'}` : ''}`
            : `GENSET ${stockNumber}\nTrips: ${completedTrips}\nCurrent location: ${location}\nStatus: ${status}${latestOp ? `\nLast booking: ${latestOp.bookingNumber || '—'} | ${dateValue(latestOp) || '—'}` : ''}`;
        }

        if (responseIsAr) {
          return `المولد ${stockNumber}\nالحالة: ${status}\nالموقع: ${location}${latestOp ? `\nالحجز: ${latestOp.bookingNumber || '—'}\nالحاوية: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nآخر صيانة: ${latestMaintenance.serviceDate || '—'}` : ''}`;
        }
        return `GENSET ${stockNumber}\nStatus: ${status}\nLocation: ${location}${latestOp ? `\nBooking: ${latestOp.bookingNumber || '—'}\nContainer: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nLast maintenance: ${latestMaintenance.serviceDate || '—'}` : ''}`;
      };

      const matchedGensetId = idMatch?.[1];
      if (matchedGensetId && isIdentifier(matchedGensetId)) {
        const answer = await answerGenset(matchedGensetId, question);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
        return;
      }

      // A short standalone number is also a genset search. This prevents
      // questions such as "464" from unnecessarily going through the LLM.
      if (/^\d{1,6}$/.test(q.trim())) {
        const answer = await answerGenset(q.trim(), question);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
        return;
      }

      // "SEARCH 422", "FIND 422", and "WHERE IS 422" are treated as genset IDs
      // when the identifier is short/numeric, so they never fall through to the LLM.
      if (searchMatch) {
        const value = searchMatch[1];
        if (/^\d{1,6}$/.test(value)) {
          const answer = await answerGenset(value, question);
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
      }

      const matchedBookingId = bookingMatch?.[1];
      const matchedContainerId = containerMatch?.[1];
      if (isIdentifier(matchedBookingId) || isIdentifier(matchedContainerId)) {
        const value = (matchedBookingId || matchedContainerId || '').toUpperCase();        let hits = operations.filter(o =>
          String(o.bookingNumber || '').toUpperCase() === value ||
          String(o.containerNumber || '').toUpperCase() === value
        );
        // The in-memory cache is fast, but DALI must not report "not found"
        // just because the current session cache is stale. Use the same
        // controlled, read-only Supabase fallback used by genset search.
        if (!hits.length) {
          try {
            hits = await db.searchOperationRecords(value);
          } catch (searchError) {
            console.error('DALI live operation search failed:', searchError);
          }
        }
        const answer = hits.length
          ? hits.slice(0, 5).map(fmtOp).join('\n\n')
          : (isAr ? `لم أجد ${value} في العمليات المسجلة.` : `No recorded operation was found for ${value}.`);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
        return;
      }

      // Fast count/status questions.
      const hasRelativePeriod = /TODAY|YESTERDAY|THIS WEEK|LAST WEEK|THIS MONTH|LAST MONTH|THIS YEAR|LAST YEAR|امبارح|النهارده|هذا الشهر|الشهر الماضي|هذا العام|السنه الماضيه|الأسبوع|الاسبوع/.test(q);
      if (countWords && !hasRelativePeriod && /GENSET|مولد|STOCK|مخزون|MAINTENANCE|صيانة|PREORDER|UNDER OPERATE|تحت التشغيل/.test(q)) {
        const portMatch = q.match(/DAM|ALEX|GOUDA|SOKHNA|SCCT|PSD|MAL/);
        let list = gensets;
        if (portMatch) list = list.filter(g => String(g.location || '').toUpperCase() === portMatch[0]);
        const maintenanceCount = list.filter(g => g.status === 'MAINTENANCE').length;
        const stockCount = list.filter(g => g.status === 'IN_STOCK').length;
        const wantsMaintenance = /MAINTENANCE|صيانة/.test(q);
        const wantsStock = /IN STOCK|AVAILABLE|STOCK|مخزون|متاح/.test(q);
        const wantsAssigned = /CLIPPED ON|CLIPPED_ON|ASSIGNED|DEPLOYED|مركب|تعيين/.test(q);
        const assignedCount = list.filter(g => g.status === GensetStatus.CLIPPED_ON).length;
        const requestedCount = wantsMaintenance ? maintenanceCount : wantsStock ? stockCount : wantsAssigned ? assignedCount : list.length;
        const labelEn = wantsMaintenance ? 'Gensets in maintenance' : wantsStock ? 'Gensets in stock' : wantsAssigned ? 'Assigned gensets' : 'Total gensets';
        const labelAr = wantsMaintenance ? 'المولدات في الصيانة' : wantsStock ? 'المولدات في المخزون' : wantsAssigned ? 'المولدات المخصصة' : 'إجمالي المولدات';
        const answer = isAr
          ? `${labelAr}: ${requestedCount}${portMatch ? `\nالميناء: ${portMatch[0]}` : ''}`
          : `${labelEn}: ${requestedCount}${portMatch ? `\nPort: ${portMatch[0]}` : ''}`;
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
        return;
      }

      // FAST CUSTOMER STATEMENT OF ACCOUNT (SOA): factual financial questions stay local.
      const customerProfiles = db.getUsers().filter(u => String(u.role || '').toUpperCase() === String(UserRole.CUSTOMER).toUpperCase());
      // Include customer names already present in live transactions. This is critical for older data that has no customer_id/profile match.
      const transactionCustomerNames = Array.from(new Set([
        ...operations.map(o => o.customerName),
        ...invoices.map(i => i.customerName),
        ...db.getPayments().map(p => p.customerName)
      ].filter(Boolean).map(String)));
      // Customer/entity understanding works in BOTH Arabic and English.
      // DALI matches the user's wording against the real customer record, its
      // Arabic company name, the system translation dictionary, and learned translations.
      const normalizeArabic = (value: unknown) => String(value ?? '')
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[ى]/g, 'ي')
        .replace(/[ؤ]/g, 'و')
        .replace(/[ئ]/g, 'ي')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');

      // Arabic/English customer names are resolved against the live profile
      // AND every known translation/learned translation. This lets DALI
      // understand "كشف حساب شركة..." even when the user types the customer
      // using Arabic, English, a translated name, or only a distinctive word.
      const normalizeEntityText = (value: unknown) => normalizeArabic(value)
        .replace(/\b(?:el|al|the|company|co|ltd|llc|شركه|شركة|مؤسسه|مؤسسة)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const compactEntityText = (value: unknown) => normalizeEntityText(value).replace(/\s+/g, '');

      // Loose phonetic key for mixed Arabic/English customer names.
      // Matching only: original customer names are never changed.
      const phoneticEntityText = (value: unknown) => {
        const arabicToLatin: Record<string, string> = {
          'ا':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'dh',
          'ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a',
          'غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
          'ي':'y','ء':'a','ؤ':'w','ئ':'y'
        };
        return normalizeEntityText(value).split('').map(ch => arabicToLatin[ch] || ch).join('').replace(/[^a-z0-9]/g, '');
      };

      const phoneticDistance = (a: string, b: string) => {
        if (!a || !b) return 999;
        const prev = Array.from({length: b.length + 1}, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
          const cur = [i];
          for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          }
          for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
        }
        return prev[b.length];
      };

      const getCustomerAliases = (customer: User) => {
        const aliases = new Set<string>();
        const add = (v: unknown) => {
          const n = normalizeEntityText(v);
          if (n && n.length >= 2) aliases.add(n);
          const compact = compactEntityText(v);
          if (compact && compact.length >= 3) aliases.add(compact);
        };

        [customer.companyName, customer.companyNameAr, customer.name].forEach(add);
        // Structured DALI customer aliases are authoritative entity mappings.
        daliCustomerAliases
          .filter(alias => alias.customer_id === customer.id && alias.active)
          .forEach(alias => add(alias.alias));
        [customer.companyName, customer.companyNameAr, customer.name].filter(Boolean).forEach(v => {
          add(translateEntity(String(v), 'ar'));
          add(translateEntity(String(v), 'en'));
        });

        for (const [english, arabic] of Object.entries(dynamicTranslations)) {
          const en = normalizeEntityText(english);
          const ar = normalizeEntityText(arabic);
          const current = [customer.companyName, customer.companyNameAr, customer.name]
            .filter(Boolean).map(normalizeEntityText);
          if (current.some(n => n === en || n === ar || (n.length >= 4 && (n.includes(en) || en.includes(n))))) {
            add(english);
            add(arabic);
          }
        }
        return Array.from(aliases);
      };

      const intentWords = new Set([
        'soa','statement','account','customer','client','company','كشف','كشفحساب','حساب','الحساب',
        'العميل','للعميل','عميل','شركة','شركه','مؤسسة','مؤسسه','من','عن','اعرض','اعرضلي',
        'عايز','اريد','محتاج','هات','اعطني','اعرض','قولي','قوللي','وريني','رصيد','الرصيد',
        'مستحق','المستحق','مديونية','تحصيل','تحصيلات','المحصل','المقبوض','دفع','مدفوع',
        'فاتورة','فواتير','عملية','عمليه','عمليات','حجز','حجوزات','بيان',
        'for','of','the','a','an','any','all','every','general','overall','companywide'
      ]);

      const findCustomerFromQuestion = (rawQuestion: string) => {
        const normalizedQuestion = normalizeEntityText(rawQuestion);
        const compactQuestion = compactEntityText(rawQuestion);
        const tokens = normalizedQuestion.split(' ').filter(Boolean);
        const meaningfulTokens = tokens.filter(t => !intentWords.has(t) && t.length >= 2);
        if (!meaningfulTokens.length) return null;

        // IMPORTANT: SOA/customer questions must never pick a customer merely
        // because one generic word happens to match. First look for the longest
        // exact customer name/alias contained in the user's question.
        const exactCandidates: Array<{ customer: User; alias: string; score: number }> = [];
        for (const customer of customerProfiles) {
          for (const alias of getCustomerAliases(customer)) {
            if (!alias || alias.length < 3) continue;
            const compactAlias = alias.replace(/\s/g, '');
            if (normalizedQuestion === alias || compactQuestion === compactAlias) {
              exactCandidates.push({ customer, alias, score: 200000 + alias.length });
            } else if (normalizedQuestion.includes(alias) || compactQuestion.includes(compactAlias)) {
              exactCandidates.push({ customer, alias, score: 150000 + alias.length });
            }
          }
        }
        if (exactCandidates.length) {
          exactCandidates.sort((a,b) => b.score - a.score || b.alias.length - a.alias.length);
          const top = exactCandidates[0];
          // If two different customers have the same exact alias, do not guess.
          const tied = exactCandidates.filter(x => x.customer.id !== top.customer.id && x.score === top.score);
          if (!tied.length) return top.customer;
        }

        // Fuzzy matching is deliberately conservative. Require at least two
        // meaningful name tokens, or a unique distinctive token across ALL live
        // customer names. This prevents "كشف حساب X" from returning another X.
        const scored = customerProfiles.map(customer => {
          const aliases = getCustomerAliases(customer);
          let best = 0;
          let bestAlias = '';
          for (const alias of aliases) {
            const aliasTokens = alias.split(' ').filter(Boolean);
            const aliasSet = new Set(aliasTokens);
            const hits = meaningfulTokens.filter(t =>
              aliasSet.has(t) || (t.length >= 3 && alias.includes(t))
            ).length;
            const meaningfulAliasTokens = aliasTokens.filter(t => !intentWords.has(t));
            const coverage = meaningfulAliasTokens.length ? hits / meaningfulAliasTokens.length : 0;
            const score = hits >= 2
              ? 10000 + hits * 3000 + Math.round(coverage * 2000) + Math.min(alias.length, 300)
              : 0;
            if (score > best) { best = score; bestAlias = alias; }
          }
          return { customer, score: best, alias: bestAlias };
        }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

        if (scored.length) {
          const top = scored[0];
          const second = scored[1];
          if (top.score >= 10000 && (!second || top.score - second.score >= 5000)) return top.customer;
        }

        // Arabic spelling fallback when the exact translation is not in the dictionary.
        const questionPhonetic = phoneticEntityText(meaningfulTokens.join(' '));
        if (questionPhonetic.length >= 4) {
          const candidates = customerProfiles.map(customer => {
            let distance = 999;
            for (const alias of getCustomerAliases(customer)) {
              distance = Math.min(distance, phoneticDistance(questionPhonetic, phoneticEntityText(alias)));
            }
            return { customer, distance };
          }).sort((a,b) => a.distance - b.distance);
          const top = candidates[0];
          const second = candidates[1];
          const threshold = Math.max(2, Math.floor(questionPhonetic.length * 0.30));
          if (top && top.distance <= threshold && (!second || second.distance - top.distance >= 2)) return top.customer;
        }

        // Last fallback: exact/contained match against customer names already
        // stored in operations, invoices and payments. Again, longest match wins.
        const tx = transactionCustomerNames.map(name => {
          const alias = normalizeEntityText(name);
          const compact = alias.replace(/\s/g, '');
          const exact = normalizedQuestion === alias || compactQuestion === compact;
          const contains = normalizedQuestion.includes(alias) || compactQuestion.includes(compact);
          return { name, alias, score: exact ? 200000 + alias.length : contains ? 150000 + alias.length : 0 };
        }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

        if (tx.length) {
          const top = tx[0];
          const sameName = tx.filter(x => normalizeEntityText(x.name) === normalizeEntityText(top.name));
          if (sameName.length) {
            const matched = customerProfiles.find(c =>
              normalizeEntityText(c.companyName || c.name) === normalizeEntityText(top.name)
            );
            return matched || null;
          }
        }
        return null;
      };

      const findCustomerNameFromQuestion = (rawQuestion: string) => {
        const nq = normalizeEntityText(rawQuestion);
        const compactQ = compactEntityText(rawQuestion);
        const tokens = nq.split(' ').filter(Boolean).filter(t => !intentWords.has(t) && t.length >= 2);

        // Search every customer name present in live operations, invoices, or
        // payments. This works even when no Customer profile exists.
        // Also compare translated forms of the real name for Arabic questions.
        const ranked = transactionCustomerNames.map(name => {
          const rawName = String(name || '').trim();
          const aliases = new Set<string>();
          const addAlias = (value: unknown) => {
            const alias = normalizeEntityText(value);
            if (!alias || alias.length < 2) return;
            aliases.add(alias);
            aliases.add(alias.replace(/\s/g, ''));
          };
          addAlias(rawName);
          addAlias(translateEntity(rawName, 'ar'));
          addAlias(translateEntity(rawName, 'en'));

          let best = 0;
          for (const alias of aliases) {
            const compactAlias = alias.replace(/\s/g, '');
            const exact = nq === alias || compactQ === compactAlias;
            const contains = nq.includes(alias) || alias.includes(nq);
            const aliasTokens = alias.split(' ').filter(Boolean);
            const hits = tokens.filter(t =>
              alias.includes(t) ||
              aliasTokens.includes(t) ||
              (t.length >= 3 && aliasTokens.some(x => x.startsWith(t.slice(0, Math.max(2, t.length - 1)))))
            ).length;
            const coverage = aliasTokens.length ? hits / aliasTokens.length : 0;
            const score = exact
              ? 100000 + alias.length
              : contains
                ? 60000 + alias.length
                : hits >= 2
                  ? 10000 + hits * 3000 + Math.round(coverage * 1500)
                  : (hits === 1 && tokens.length === 1 && tokens[0].length >= 4 && aliasTokens.length === 1 ? 7000 : 0);
            if (score > best) best = score;
          }
          return { name: rawName, score: best };
        }).filter(x => x.score > 0).sort((x,y) => y.score - x.score);

        // Accept a distinctive single customer token only when it uniquely identifies
        // one live customer. This handles natural Arabic such as "كشف حساب البيباسوني"
        // without guessing between similarly named customers.
        if (ranked[0]?.score >= 50000) return ranked[0].name;
        const distinctive = tokens
          .filter(t => t.length >= 4)
          .map(token => {
            const hits = transactionCustomerNames.filter(name => {
              const aliases = [
                normalizeEntityText(name),
                normalizeEntityText(translateEntity(String(name), 'ar')),
                normalizeEntityText(translateEntity(String(name), 'en'))
              ].filter(Boolean);
              return aliases.some(a => a.includes(token));
            });
            return { token, hits };
          })
          .filter(x => x.hits.length === 1);
        if (distinctive.length === 1) return distinctive[0].hits[0];
        // Same fallback for transaction-only customer names.
        const questionPhonetic = phoneticEntityText(tokens.join(' '));
        if (questionPhonetic.length >= 4) {
          const candidates = transactionCustomerNames.map(name => ({
            name,
            distance: phoneticDistance(questionPhonetic, phoneticEntityText(translateEntity(String(name), 'ar') || name))
          })).sort((a,b) => a.distance - b.distance);
          const top = candidates[0];
          const second = candidates[1];
          const threshold = Math.max(2, Math.floor(questionPhonetic.length * 0.30));
          if (top && top.distance <= threshold && (!second || second.distance - top.distance >= 2)) return top.name;
        }

        return null;
      };

      // Resolve customer references appearing in operations too. Existing
      // operations may predate customer_id, so names are matched by the same
      // normalized multilingual rules.
      const customerMatchesOperation = (customer: User, op: any) => {
        if (op.customerId) return String(op.customerId) === String(customer.id);
        const opName = normalizeEntityText(op.customerName);
        return getCustomerAliases(customer).some(alias => opName === alias);
      };
      const customerMatchesNamedRecord = (customer: User | null, customerName: unknown, customerId: unknown) => {
        if (customerId) return Boolean(customer && String(customerId) === String(customer.id));
        const recordName = normalizeEntityText(customerName);
        if (!recordName) return false;
        if (customer) return getCustomerAliases(customer).some(alias => recordName === alias);
        return false;
      };
      // Financial statements use registered names and IDs only. Fuzzy/phonetic
      // translations can point two different customer names at the same account.
      const getSoaCustomerAliases = (customer: User) => Array.from(new Set(
        [customer.companyName, customer.companyNameAr, customer.name]
          .map(normalizeEntityText)
          .filter(alias => alias.length >= 3)
      ));
      const resolveSoaCustomer = (rawQuestion: string) => {
        const normalizedQuestion = normalizeEntityText(rawQuestion);
        const candidates: Array<{ owner: string; customer: User | null; name: string; alias: string }> = [];
        for (const customer of customerProfiles) {
          for (const alias of getSoaCustomerAliases(customer)) {
            candidates.push({ owner: String(customer.id), customer, name: customer.companyName || customer.name, alias });
          }
        }
        for (const name of transactionCustomerNames) {
          const normalizedName = normalizeEntityText(name);
          if (normalizedName.length < 3) continue;
          // A profile already represents this transaction name; don't make a
          // second candidate for the same customer.
          if (customerProfiles.some(customer => getSoaCustomerAliases(customer).includes(normalizedName))) continue;
          candidates.push({ owner: `name:${normalizedName}`, customer: null, name, alias: normalizedName });
        }
        const matches = candidates.filter(({ alias }) => (` ${normalizedQuestion} `).includes(` ${alias} `))
          .sort((a, b) => b.alias.length - a.alias.length);
        if (!matches.length) return { customer: null, customerName: null, ambiguous: false };
        const longest = matches[0].alias.length;
        const bestMatches = matches.filter(match => match.alias.length === longest);
        const owners = Array.from(new Set(bestMatches.map(match => match.owner)));
        if (owners.length > 1) return { customer: null, customerName: null, ambiguous: true };
        const selected = bestMatches[0];
        return { customer: selected.customer, customerName: selected.name, ambiguous: false };
      };

      const customerAliasesForAi = customerProfiles.slice(0, 150).map(customer => ({
        english: customer.companyName || customer.name,
        arabic: customer.companyNameAr || translateEntity(customer.companyName || customer.name, 'ar'),
        aliases: getCustomerAliases(customer)
      }));
      const soaIntent = /(?:SOA|STATEMENT\s*(?:OF)?\s*ACCOUNT|ACCOUNT\s*STATEMENT|CUSTOMER\s*ACCOUNT|ACCOUNT\s*OF|كشف\s*حساب|كشف\s*الحساب|كشف\s*حساب\s*العميل|حساب\s*العميل|كشف|بيان\s*حساب)/i.test(question);
      const collectedIntent = /(?:COLLECTED|RECEIVED|PAYMENTS?|PAID|COLLECTION|MONEY\s*RECEIVED|تحصيل|التحصيل|تحصيلات|المحصل|المقبوض|المقبوضات|مدفوعات|الدفع|دفعات|فلوس)/i.test(question);
      const customerFinancialIntent = /(?:BALANCE|DUE|OUTSTANDING|DEBT|INVOICED|UNPAID|رصيد|مستحق|مستحقات|مديونية|فواتير|فاتورة|غير\s*مسدد|غير\s*محصل)/i.test(question);
      if (soaIntent || collectedIntent || customerFinancialIntent) {
        const soaMatch = soaIntent ? resolveSoaCustomer(question) : null;
        if (soaMatch?.ambiguous) {
          const clarification = responseIsAr
            ? 'وجدت أكثر من عميل بهذا الاسم. اكتب الاسم الكامل المسجل للعميل لعرض كشف الحساب الصحيح.'
            : 'More than one customer matches that name. Please use the full registered customer name so I can show the correct statement.';
          setAiChatMessages(prev => [...prev, { role: 'ai', text: clarification }]);
          return;
        }
        const customer = soaMatch?.customer || null;
        const resolvedCustomerName = soaMatch?.customerName || (soaIntent ? null : findCustomerFromQuestion(question)?.companyName || findCustomerFromQuestion(question)?.name || findCustomerNameFromQuestion(question));
        if (resolvedCustomerName) {
          const customerName = resolvedCustomerName;
          const customerNameAliases = customer ? getSoaCustomerAliases(customer) : [normalizeEntityText(customerName)];
          const matchesSoaCustomer = (recordName: unknown, recordId: unknown) => {
            if (recordId) return Boolean(customer && String(recordId) === String(customer.id));
            return customerNameAliases.includes(normalizeEntityText(recordName));
          };
          const customerOps = operations.filter(o => matchesSoaCustomer(o.customerName, o.customerId));
          const customerInvoices = invoices.filter(i => matchesSoaCustomer(i.customerName, i.customerId));
          const customerPayments = db.getPayments().filter(p => matchesSoaCustomer(p.customerName, p.customerId));
          const unbilled = customerOps.filter(o => !o.invoiced).reduce((s, o) => s + (parseFloat(String(o.rate || '0').replace(/,/g,'')) || 0) + (parseFloat(String(o.vat || '0').replace(/,/g,'')) || 0), 0);
          const invoiced = customerInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const unpaid = customerInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + Math.max(0, (Number(i.amount) || 0) - db.getInvoicePaidAmount(i.id)), 0);          const paidInvoices = customerInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const collected = customerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const historical = Number(customer?.pastOutstandingAmount) || 0;
          // SOA definition: the customer balance is the amount still due after all
          // recorded customer payments. Do not treat "pass ship" / shipper text as
          // the customer identity; the resolved customer record is the authority.
          const grossDue = historical + unpaid + unbilled;
          // Payments already reduce invoice balances/status and historical balance in addPayment.
          const netDue = grossDue;
          const recentPayments = [...customerPayments].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
          const lastPayment = recentPayments.length ? ((responseIsAr ? '\nآخر تحصيل: ' : '\nLast payment: ') + recentPayments[0].date + ' — ' + Number(recentPayments[0].amount || 0).toLocaleString() + ' EGP') : '';
          const recentOps = [...customerOps]
            .sort((a,b) => String(b.operationDate || '').localeCompare(String(a.operationDate || '')))
            .slice(0, 10)
            .map(o => responseIsAr
              ? `\n• حجز ${o.bookingNumber || '—'} | حاوية ${o.containerNumber || '—'} | ${o.clipOnPort || '—'} → ${o.clipOffPort || '—'} | سعر ${Number(String(o.rate || '0').replace(/,/g,'')) || 0} EGP | شاحن: ${o.beneficiaryName || '—'} | ناقل: ${o.trucker || '—'}`
              : `\n• Booking ${o.bookingNumber || '—'} | Container ${o.containerNumber || '—'} | ${o.clipOnPort || '—'} → ${o.clipOffPort || '—'} | Rate ${Number(String(o.rate || '0').replace(/,/g,'')) || 0} EGP | Shipper: ${o.beneficiaryName || '—'} | Trucker: ${o.trucker || '—'}`
            ).join('');
          const answer = responseIsAr
            ? 'كشف حساب: ' + customerName + '\nالمستحق: ' + grossDue.toLocaleString() + ' جنيه | المدفوع: ' + collected.toLocaleString() + ' جنيه\nالرصيد المتبقي: ' + netDue.toLocaleString() + ' جنيه\nالفواتير: ' + invoiced.toLocaleString() + ' جنيه | غير مسدد: ' + unpaid.toLocaleString() + ' جنيه | غير مفوتر: ' + unbilled.toLocaleString() + ' جنيه' + (recentPayments.length ? '\nآخر تحصيل: ' + recentPayments[0].date + ' — ' + Number(recentPayments[0].amount || 0).toLocaleString() + ' جنيه' : '') + (recentOps ? '\nالعمليات الأخيرة:' + recentOps : '')
            : 'SOA: ' + customerName + '\nDue: ' + grossDue.toLocaleString() + ' EGP | Paid: ' + collected.toLocaleString() + ' EGP\nRemaining balance: ' + netDue.toLocaleString() + ' EGP\nInvoiced: ' + invoiced.toLocaleString() + ' EGP | Unpaid: ' + unpaid.toLocaleString() + ' EGP | Unbilled: ' + unbilled.toLocaleString() + ' EGP' + lastPayment + (recentOps ? '\nRecent operations:' + recentOps : '');
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
        if (soaIntent) {
          const explicitAllCustomers = /\b(?:all|every|general|overall|companywide|any)\b|كل\s*(?:العملاء|عميل)|جميع\s*العملاء|اجمالي\s*العملاء|كشف\s*الحساب\s*العام/i.test(question);
          const unresolvedCustomerTokens = normalizeEntityText(question)
            .split(' ')
            .filter(token => token.length >= 2 && !intentWords.has(token));
          if (unresolvedCustomerTokens.length > 0 && !explicitAllCustomers) {
            const clarification = responseIsAr
              ? 'لم أتمكن من مطابقة اسم العميل بثقة. أرسل الاسم المسجل للعميل كما يظهر في النظام لأعرض كشف حسابه.'
              : 'I could not confidently match that customer. Please use the customer name as it appears in the system so I can show the correct statement.';
            setAiChatMessages(prev => [...prev, { role: 'ai', text: clarification }]);
            return;
          }
          // A bare "كشف حساب / SOA" should still return useful live data.
          // Show a company-wide receivables/collections summary instead of
          // handing the question to the LLM or returning an empty answer.
          const allPayments = db.getPayments();
          const grouped = new Map<string, { name: string; customer: User | null; ops: typeof operations; invoices: typeof invoices; payments: typeof allPayments }>();
          customerProfiles.forEach(customer => {
            grouped.set(`customer:${customer.id}`, {
              name: customer.companyName || customer.name,
              customer,
              ops: [], invoices: [], payments: []
            });
          });
          const groupForRecord = (recordName: unknown, recordId: unknown) => {
            const id = String(recordId || '');
            const name = String(recordName || '').trim();
            const nameKey = normalizeEntityText(name);
            let customer = id ? customerProfiles.find(profile => String(profile.id) === id) : undefined;
            if (!id && nameKey) {
              const matchingProfiles = customerProfiles.filter(profile => getSoaCustomerAliases(profile).includes(nameKey));
              if (matchingProfiles.length === 1) customer = matchingProfiles[0];
            }
            const key = customer ? `customer:${customer.id}` : id ? `external:${id}` : `name:${nameKey}`;
            if (!grouped.has(key)) grouped.set(key, { name: name || 'Unknown customer', customer: null, ops: [], invoices: [], payments: [] });
            return grouped.get(key)!;
          };
          operations.forEach(op => groupForRecord(op.customerName, op.customerId).ops.push(op));
          invoices.forEach(invoice => groupForRecord(invoice.customerName, invoice.customerId).invoices.push(invoice));
          allPayments.forEach(payment => groupForRecord(payment.customerName, payment.customerId).payments.push(payment));
          const rows = Array.from(grouped.values()).map(group => {
            const billed = group.invoices.reduce((s,i) => s + (Number(i.amount)||0), 0);
            const collected = group.payments.reduce((s,p) => s + (Number(p.amount)||0), 0);
            const unpaid = group.invoices.filter(i => i.status === 'UNPAID').reduce((s,i) => s + Math.max(0, (Number(i.amount)||0) - db.getInvoicePaidAmount(i.id)), 0);
            const unbilled = group.ops.filter(o => !o.invoiced).reduce((s,o) => s + (parseFloat(String(o.rate||'0').replace(/,/g,''))||0) + (parseFloat(String(o.vat||'0').replace(/,/g,''))||0), 0);
            const historical = Number(group.customer?.pastOutstandingAmount) || 0;
            return { name: group.name, ops: group.ops.length, billed, collected, unpaid, unbilled, due: historical + unpaid + unbilled };
          }).sort((a,b) => b.due - a.due);

          const totalCollected = rows.reduce((s,r) => s + r.collected, 0);
          const totalBilled = rows.reduce((s,r) => s + r.billed, 0);
          const totalDue = rows.reduce((s,r) => s + r.due, 0);
          const visible = rows.slice(0, 30);

          const answer = responseIsAr
            ? 'كشف الحساب العام\n' +
              'العملاء: ' + rows.length + '\n' +
              'إجمالي الفواتير: ' + totalBilled.toLocaleString() + ' جنيه\n' +
              'إجمالي التحصيل: ' + totalCollected.toLocaleString() + ' جنيه\n' +
              'إجمالي المستحق: ' + totalDue.toLocaleString() + ' جنيه\n\n' +
              'تفصيل العملاء:\n' +
              visible.map(r => '• ' + r.name + ' | عمليات: ' + r.ops + ' | فواتير: ' + r.billed.toLocaleString() + ' | تحصيل: ' + r.collected.toLocaleString() + ' | غير مسدد: ' + r.unpaid.toLocaleString() + ' | غير مفوتر: ' + r.unbilled.toLocaleString()).join('\n') +
              (rows.length > visible.length ? '\n\nعرض أول ' + visible.length + ' عميل. اكتب "كشف حساب [اسم العميل]" للتفاصيل الكاملة.' : '')
            : 'GENERAL STATEMENT OF ACCOUNT\n' +
              'Customers: ' + rows.length + '\n' +
              'Total invoiced: ' + totalBilled.toLocaleString() + ' EGP\n' +
              'Total collected: ' + totalCollected.toLocaleString() + ' EGP\n' +
              'Total due: ' + totalDue.toLocaleString() + ' EGP\n\n' +
              'Customer breakdown:\n' +
              visible.map(r => '• ' + r.name + ' | Ops: ' + r.ops + ' | Invoiced: ' + r.billed.toLocaleString() + ' | Collected: ' + r.collected.toLocaleString() + ' | Unpaid: ' + r.unpaid.toLocaleString() + ' | Unbilled: ' + r.unbilled.toLocaleString()).join('\n') +
              (rows.length > visible.length ? '\n\nShowing first ' + visible.length + ' customers. Ask "SOA [customer name]" for full details.' : '');

          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
      }

      // CUSTOMER-ONLY LOOKUP: when the user names a specific customer, DALI must
      // answer ONLY about that customer. Never return the company-wide customer list
      // or unrelated customers. This runs before the general AI reasoning path.
      const customerLookupIntent = /(?:CUSTOMER|CLIENT|COMPANY|CUSTOMER INFO|ABOUT|WHO IS|معلومات|بيانات|العميل|العميله|شركة|شركه|عميل|عن)/i.test(question);
      if (customerLookupIntent && !soaIntent && !collectedIntent && !customerFinancialIntent) {
        const customer = findCustomerFromQuestion(question);
        const resolvedName = customer?.companyName || customer?.name || findCustomerNameFromQuestion(question);
        if (resolvedName) {
          const customerOps = customer
            ? operations.filter(o => customerMatchesOperation(customer, o))
            : operations.filter(o => normalizeEntityText(o.customerName) === normalizeEntityText(resolvedName));
          const customerInvoices = invoices.filter(i => customer
            ? customerMatchesNamedRecord(customer, i.customerName, i.customerId)
            : normalizeEntityText(i.customerName) === normalizeEntityText(resolvedName));
          const customerPayments = db.getPayments().filter(p => customer
            ? customerMatchesNamedRecord(customer, p.customerName, p.customerId)
            : normalizeEntityText(p.customerName) === normalizeEntityText(resolvedName));
          const displayName = responseIsAr ? (customer?.companyNameAr || translateEntity(resolvedName, 'ar')) : resolvedName;
          const collected = customerPayments.reduce((s,p) => s + (Number(p.amount) || 0), 0);
          const invoiced = customerInvoices.reduce((s,i) => s + (Number(i.amount) || 0), 0);
          const unpaid = customerInvoices.filter(i => i.status === 'UNPAID').reduce((s,i) => s + Math.max(0, (Number(i.amount) || 0) - db.getInvoicePaidAmount(i.id)), 0);
          const answer = responseIsAr
            ? `العميل: ${displayName}\nعدد العمليات: ${customerOps.length}\nإجمالي الفواتير: ${invoiced.toLocaleString()} جنيه\nإجمالي التحصيل: ${collected.toLocaleString()} جنيه\nغير مسدد: ${unpaid.toLocaleString()} جنيه`
            : `Customer: ${displayName}\nOperations: ${customerOps.length}\nTotal invoiced: ${invoiced.toLocaleString()} EGP\nTotal collected: ${collected.toLocaleString()} EGP\nUnpaid: ${unpaid.toLocaleString()} EGP`;
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
      }

      // Fast customer/operation lookup: factual questions stay local and never wait for AI.
      const customerQuery = q.match(/(?:HOW MANY|COUNT|NUMBER OF|كام|عدد|كم).*?(?:OPERATIONS?|JOBS?|عمليه|عمليات)/i);
      if (customerQuery) {
        const customer = findCustomerFromQuestion(question);
        if (customer) {
          const customerName = customer.companyName || customer.name;
          const hits = operations.filter(o =>
            String(o.customerId || '') === String(customer.id) ||
            normalizeEntityText(o.customerName) === normalizeEntityText(customerName)
          );
          const displayName = isAr ? (customer.companyNameAr || translateEntity(customerName, 'ar')) : customerName;
          const answer = isAr ? `عدد العمليات لـ ${displayName}: ${hits.length}` : `Operations for ${customerName}: ${hits.length}`;
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
      }

      // Natural-language genset location: "فين المولد 452",
      // "المولد 452 فين", "where is genset 452", etc.
      const gensetLocationIntent = /(?:فين|اين|أين|مكان|موقع|موجود|عايز\s*اعرف|عايز\s*مكان|وريني|دلني|location|where|locate|find|position).*(?:مولد|مولدات|وحدة|genset|gense?t)|(?:مولد|مولدات|وحدة|genset|gense?t).*?(?:فين|اين|أين|مكان|موقع|موجود|where|location|position)|(?:فين|اين|أين|مكان|موقع|location|where|locate|find|position).*?\b\d{1,6}\b/i.test(q);
      if (gensetLocationIntent) {
        const id = q.match(/(?:مولد(?:ات)?|وحدة|GENSET(?:S)?|GENSETS?\s*ID)\s*(?:#|رقم|رقم\s*)?\s*(?:بتاع|رقم)?\s*([A-Z0-9-]+)/i)?.[1]
          || q.match(/(?:WHERE|LOCATION|LOCATE|FIND|فين|اين|أين|مكان|موقع|موجود|عايز\s*مكان|عايز\s*اعرف|وريني|دلني).*?#?([0-9]{1,6})/i)?.[1];
        if (id) {
          const answer = await answerGenset(id, question);
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        await saveDaliMemory('assistant', answer);
          return;
        }
      }

      // Only genuine analysis/reasoning reaches DALI. Keep the model payload tiny.
      const statusCounts = operations.reduce((m: Record<string, number>, o) => { m[o.status] = (m[o.status] || 0) + 1; return m; }, {});
      const portCounts = operations.reduce((m: Record<string, number>, o) => { const p = o.clipOnPort || '—'; m[p] = (m[p] || 0) + 1; return m; }, {});
      // Build a question-aware evidence set instead of giving DALI only the last
      // 40 operations. New questions often refer to older records, ports, customers,
      // gensets, or date ranges, so first retrieve records whose fields actually match
      // the user's words. This stays read-only and keeps the model context bounded.
      const stopWords = new Set(['what','which','where','when','who','show','find','give','tell','how','many','much','about','with','from','for','the','and','this','that','are','was','were','have','has','current','currently','today','month','week','year','all','each','any','our','me','please','can','you','does','do','is','in','of','to','a','an','on','by','or','vs','compare','how','many','كم','كام','ايه','اي','فين','اين','أين','امتى','متى','من','عن','في','الى','إلى','و','هل','عايز','محتاج','هات','وريني','اعرض','كل','جميع','هذا','هذه','ال','مولد','مولدات','جهاز','وحدة','عملية','عمليات','حجز','حجوزات','حاوية','حاويات','كشف','حساب','عميل','العميل','شركة','شركه']);
      const queryTokens = normalizeEntityText(question).split(' ').filter(t => t.length >= 2 && !stopWords.has(t));

      // FOLLOW-UP MEMORY BRIDGE: if the new question uses a reference such as
      // "it", "that genset", "what about its maintenance", or the Arabic
      // equivalents, carry identifiers from the user's previous DALI turns
      // into live-data retrieval. This is what makes cross-session memory
      // useful for factual answers instead of merely showing old text.
      const isMemoryFollowUp = /\b(?:it|its|that|those|this|previous|above|same|what about|and what about|also)\b|\b(?:هو|هي|ده|دي|ذلك|تلك|السابق|اللي فات|نفسه|نفسها|وماذا عن|طيب و|كمان)\b/i.test(question);
      const memoryReferenceIds = isMemoryFollowUp
        ? Array.from(new Set(
            recentMemory
              .flatMap((m: any) => [String(m.message || ''), JSON.stringify(m.entities || {})])
              .flatMap(text => {
                const ids = new Set<string>();
                const patterns = [
                  /(?:GENSET|GENSETS|مولد(?:ات)?|وحدة)\s*(?:NO\\.?|NUMBER|ID|رقم|#)?\s*([A-Z0-9-]{2,})/gi,
                  /(?:BOOKING|حجز)\s*(?:NO\\.?|NUMBER|ID|رقم|#)?\s*([A-Z0-9-]{2,})/gi,
                  /(?:CONTAINER|CONT|حاوي(?:ة|ه))\s*(?:NO\\.?|NUMBER|ID|رقم|#)?\s*([A-Z0-9-]{4,})/gi
                ];
                for (const pattern of patterns) {
                  for (const match of text.matchAll(pattern)) {
                    if (match[1] && /\d/.test(match[1])) ids.add(match[1]);
                  }
                }
                return [...ids];
              })
          ))
        : [];
      const effectiveQueryTokens = Array.from(new Set([...queryTokens, ...memoryReferenceIds.map(normalizeEntityText).filter(Boolean)]));
      const recordText = (record: any) => normalizeEntityText([
        record?.bookingNumber, record?.containerNumber, record?.gensetNumber, record?.unitNumber,
        record?.customerName, record?.beneficiaryName, record?.trucker, record?.clipOnPort,
        record?.clipOffPort, record?.location, record?.status, record?.operationDate,
        record?.dateReceived, record?.serviceDate, record?.serviceType, record?.maintenanceType
      ].filter(Boolean).join(' '));
      const relevance = (record: any) => {
        const haystack = recordText(record);
        if (!haystack || !effectiveQueryTokens.length) return 0;
        return effectiveQueryTokens.reduce((score, token) => score + (haystack.includes(token) ? (token.length >= 5 ? 3 : 1) : 0), 0);
      };
      const matchedOperations = operations.map(o => ({ row:o, score:relevance(o) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 80).map(x => x.row);
      const matchedGensets = gensets.map(g => ({ row:g, score:relevance(g) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 60).map(x => x.row);
      const matchedMaintenance = maintenance.map(m => ({ row:m, score:relevance(m) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 60).map(x => x.row);
      const matchedInvoices = invoices.map(i => ({ row:i, score:relevance(i) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 50).map(x => x.row);
      const allPorts = Array.from(new Set(gensets.map(g => String(g.location || '').trim()).filter(Boolean)));
      const stockByPort = allPorts.map(port => ({
        port,
        total: gensets.filter(g => String(g.location || '').trim().toUpperCase() === port.toUpperCase()).length,
        inStock: gensets.filter(g => String(g.location || '').trim().toUpperCase() === port.toUpperCase() && String(g.status || '').toUpperCase() === 'IN_STOCK').length,
        clippedOn: gensets.filter(g => String(g.location || '').trim().toUpperCase() === port.toUpperCase() && String(g.status || '').toUpperCase() === 'CLIPPED_ON').length,
        maintenance: gensets.filter(g => String(g.location || '').trim().toUpperCase() === port.toUpperCase() && String(g.status || '').toUpperCase() === 'MAINTENANCE').length,
      }));
      const context = {
        question,
        recentConversation: aiChatMessages.slice(-6).map(message => ({ role: message.role === 'ai' ? 'assistant' : 'user', text: message.text.slice(0, 1200) })),
        totals: { operations: operations.length, invoices: invoices.length, gensets: gensets.length, maintenance: maintenance.length },
        statusCounts,
        portCounts,
        stockByPort,
        relevantOperations: (matchedOperations.length ? matchedOperations : operations.slice(0, 20)).map(o => ({ bookingNumber:o.bookingNumber, containerNumber:o.containerNumber, gensetNumber:o.gensetNumber, customerName:o.customerName, status:o.status, clipOnPort:o.clipOnPort, clipOffPort:o.clipOffPort, operationDate:o.operationDate, rate:o.rate, vat:o.vat })),
        relevantGensets: (matchedGensets.length ? matchedGensets : gensets.slice(0, 30)).map(g => ({ unitNumber:g.unitNumber, gensetNumber:g.gensetNumber, location:g.location, status:g.status, model:g.model })),
        relevantMaintenance: matchedMaintenance.map(m => ({ gensetNumber:m.gensetNumber || m.unitNumber, location:m.location, status:m.status, serviceDate:m.serviceDate, serviceType:m.serviceType, maintenanceType:m.maintenanceType, completedDate:m.completedDate })),
        relevantInvoices: matchedInvoices.map(i => ({ invoiceNumber:i.invoiceNumber, customerName:i.customerName, amount:i.amount, status:i.status, date:i.date })),
        invoiceTotals: invoices.reduce((m: any, i: any) => { const amount=Number(i.amount)||0; m.billed+=amount; if(i.status==='PAID') m.paid+=amount; return m; }, { billed:0, paid:0 }),
        gensetStatusCounts: gensets.reduce((m: Record<string, number>, g) => { m[g.status] = (m[g.status] || 0) + 1; return m; }, {}),
        maintenanceCount: maintenance.length,
        customers: customerAliasesForAi.slice(0, 100),
        recentPayments: db.getPayments().slice(-50).map(p => ({ customerName:p.customerName, amount:p.amount, date:p.date, reference:p.reference })),
        currentDate: currentDateKey,
        tomorrowDate: tomorrowDateKey,
        reservations: {
          total: reservations.length,
          pendingNotLoaded: pendingWork.length,
          today: pendingWork.filter(r => r.date === currentDateKey),
          tomorrow: pendingWork.filter(r => r.date === tomorrowDateKey),
          allPending: pendingWork.slice(0, 200)
        }
      };
      const prompt = `DALI ORGANIZATION CONTEXT:\n${organizationContext}\n\nDALI CONVERSATION MEMORY (recent turns):\n${memoryContext}\n\n${organizationContext}\n\nLATEST USER QUESTION:\n${question}\n\nYou are DALI, the natural in-system colleague for NILE FLEET. Talk like a helpful human coworker who knows the ongoing conversation—not like a database report, search engine, or robot. Understand Egyptian Arabic, Modern Standard Arabic, English, Arabizi/transliterated names, and mixed language naturally.

CONVERSATION BEHAVIOR:
- Remember what this user was just talking about and carry the subject forward naturally.
- If the user says "it", "that one", "its", "the previous one", "طيب", "طب", "هو", "هي", "ده", "دي", "نفسه", or similar, resolve the reference from conversation memory before answering.
- Do not ask the user to repeat information that is already in memory.
- Do not restart the conversation or introduce yourself again on every question.
- Do not repeat the user's question unless clarification is genuinely needed.
- React naturally: brief acknowledgements such as "Yes", "Right", "Got it", "Sure", "أيوه", "تمام", or "بالضبط" are appropriate when they fit the conversation.
- For a follow-up, answer the follow-up first and use earlier context silently.
- Keep the tone warm, friendly, direct, professional, and conversational. DALI should feel like a helpful Nile Fleet coworker, not a machine.
- DALI may use light, harmless humor or a short playful remark when the situation is appropriate. Never joke about accidents, safety incidents, money problems, customer disputes, missing equipment, delays, or other sensitive operational issues.
- Humor should be occasional and subtle: one small joke or playful phrase is enough. Never force a joke into every answer.
- Use natural Egyptian Arabic when the user speaks Arabic. Friendly expressions such as "تمام", "أيوه", "ولا يهمك", "خلينا نشوف" are welcome when they fit.
- Match the user's language and level of formality. If the user mixes Arabic and English, you may mix them naturally too.
- Do not use canned phrases such as "According to the provided data", "I am an AI", "DALI 1.0", or "I can still..." unless the user specifically asks.
- Do not turn every answer into a bullet list. Use normal short sentences for simple questions and structured lists only when they genuinely help.
- Do not say "please provide the full serial number" when memory already identifies the unit; ask only when there is real ambiguity.
- If you need clarification, ask one short, specific question and explain what is ambiguous.
- Never pretend to remember something that is not in memory.

DATA BEHAVIOR:
- Conversation memory resolves references; live Nile Fleet data is the source of truth for current facts.
- Use only supplied live data for fleet facts and say plainly when the needed fact is not present.
- For counts, totals, dates, status and location, calculate from live data.
- Never invent operational facts.
- Reply in the latest question's language and preserve IDs/dates/numbers exactly.
- Keep simple answers concise, but give enough context to feel like a real conversation.
- Use the currentDate and tomorrowDate values in LIVE CONTEXT for phrases such as today, tomorrow, yesterday, this week and next week.
- For requested customer work, use reservations.pendingNotLoaded and its today/tomorrow lists. PENDING or APPROVED without a linked operation means the work is still requested and not loaded into Operations.\n\nNILE FLEET SYSTEM FLOW: Reservations are customer requests for one or more gensets; approving a reservation creates operations. Each operation links booking, container, genset, customer, beneficiary/shipper, trucker/driver, dates, clip-on port, clip-off port, status, rate and VAT. The gensets master is the source for current unit number, location and status: IN_STOCK, CLIPPED_ON, MAINTENANCE or RETIRED. Maintenance logs belong to gensets and contain service date/type, technician, location, status, completion date, cost, parts and next service. A genset question may therefore require combining its master record with its operation history and maintenance history. Port stock means the current gensets grouped by their current location/status, not historical operations. Invoices are financial records associated with customers/bookings/operations; payments represent collections and reduce outstanding balances. Customer questions can require joining customer profiles with operations, invoices and payments. Use these relationships to understand new questions, not just exact keywords. For counts, totals, dates, status and location, calculate from the supplied live data. If the live data does not contain the requested fact, say what is missing instead of inventing it.\n${creatorContext}\nLEARNED INTELLIGENCE REGISTRY (shared across desktop and mobile): ${learnedRegistryContext}\nUse these mappings as authoritative Nile Fleet terminology and Arabic logic. Do not invent alternative translations when a registry mapping exists.\nLATEST QUESTION: ${question}\nLIVE CONTEXT: ${JSON.stringify(context)}`
      let answer = '';
      try {
        answer = await runThinkingAudit(prompt, 650);
      } catch (aiError) {
        console.error('DALI general AI route failed; using deterministic fallback', aiError);

        // DETERMINISTIC OPERATIONAL ANSWERS
        // These questions must never depend on the LLM. The database/cache is the source of truth.
        const asksMaintenanceList = /\\b(?:which|what|list|show)?\\s*(?:the\\s*)?(?:gensets?|generators?|units?)\\s*(?:are\\s+|in\\s+|under\\s+)?maintenance\\b|\\bmaintenance\\b.*\\b(?:gensets?|generators?|units?)\\b|في\\s*الصيانة|بالصيانة|صيانة\\s*المولدات|المولدات.*صيانة|مولدات.*صيانة|مين.*محتاج.*صيانة|محتاج.*صيانة/.test(normalizedQuestion);
        const asksPortStock = /stock in each port|stock.*each port|each port.*stock|stock by port|port stock|المخزون.*كل.*ميناء|كل.*ميناء.*المخزون|رصيد.*ميناء|مخزون.*ميناء/.test(normalizedQuestion);
        const asksPortSaid = /how many gensets.*port said|gensets.*port said|port said.*gensets|مولدات.*بورسعيد|مولدات.*بورسعيد|كم.*مولد.*بورسعيد/.test(normalizedQuestion);

        if (asksMaintenanceList) {
          const maintenanceUnits = gensets
            .filter(g => String(g.status || '').toUpperCase() === 'MAINTENANCE')
            .map(g => String(g.unitNumber || g.gensetNumber || '').trim())
            .filter(Boolean);
          answer = responseIsAr
            ? 'المولدات الموجودة في الصيانة: ' + maintenanceUnits.length + '\n' + (maintenanceUnits.length ? maintenanceUnits.join('، ') : 'لا يوجد')
            : 'Gensets in maintenance: ' + maintenanceUnits.length + '\n' + (maintenanceUnits.length ? maintenanceUnits.join(', ') : 'None');
        } else if (asksPortSaid) {
          // SCCT is the Suez Canal Container Terminal in East Port Said.
          // Keep the raw database location code in the answer so DALI never silently
          // invents a location mapping for another yard such as GOUDA.
          const portSaid = stockByPort.find(x => x.port.toUpperCase() === 'SCCT');
          answer = responseIsAr
            ? 'Port Said (SCCT): ' + (portSaid?.total || 0) + ' gensets\nفي المخزون: ' + (portSaid?.inStock || 0) + '\nمركبة: ' + (portSaid?.clippedOn || 0)
            : 'Port Said (SCCT): ' + (portSaid?.total || 0) + ' gensets\nIn stock: ' + (portSaid?.inStock || 0) + '\nClipped on: ' + (portSaid?.clippedOn || 0);
        } else if (asksPortStock) {
          const portRows = stockByPort
            .filter(x => x.port.toUpperCase() !== 'WORKSHOP')
            .map(x => x.port + ': ' + x.total + ' total (' + x.inStock + ' in stock, ' + x.clippedOn + ' clipped on)')
            .join('\n');
          const workshop = stockByPort.find(x => x.port.toUpperCase() === 'WORKSHOP');
          answer = responseIsAr
            ? 'المخزون حسب الموقع:\n' + portRows + (workshop ? '\n\nالورشة: ' + workshop.total + ' إجمالي (مخزون ' + workshop.inStock + '، مركبة ' + workshop.clippedOn + '، صيانة ' + workshop.maintenance + '، متقاعد ' + ((workshop as any).retired != null ? (workshop as any).retired : 'غير محدد') + ')' : '')
            : 'Stock by port/location:\n' + portRows + (workshop ? '\n\nWORKSHOP: ' + workshop.total + ' total (in stock ' + workshop.inStock + ', clipped on ' + workshop.clippedOn + ', maintenance ' + workshop.maintenance + ', retired ' + ((workshop as any).retired != null ? (workshop as any).retired : 'unspecified') + ')' : '');
        } else if (/maintenance|maintain|service|repair|صيانة/.test(normalizedQuestion)) {
          const maintenanceUnits = gensets
            .filter(g => String(g.status || '').toUpperCase() === 'MAINTENANCE')
            .map(g => String(g.unitNumber || g.gensetNumber || '').trim())
            .filter(Boolean);
          answer = responseIsAr
            ? 'المولدات الموجودة في الصيانة: ' + maintenanceUnits.length + '\\n' + (maintenanceUnits.length ? maintenanceUnits.join('، ') : 'لا يوجد')
            : 'Gensets in maintenance: ' + maintenanceUnits.length + '\\n' + (maintenanceUnits.length ? maintenanceUnits.join(', ') : 'None');
        } else if (/stock|genset|generator|مولد|مولدات|مخزون|ميناء|port/.test(normalizedQuestion)) {
          const total = gensets.length;
          const maintenanceCount = gensets.filter(g => String(g.status || '').toUpperCase() === 'MAINTENANCE').length;
          const inStock = gensets.filter(g => String(g.status || '').toUpperCase() === 'IN_STOCK').length;
          const clipped = gensets.filter(g => String(g.status || '').toUpperCase() === 'CLIPPED_ON').length;
          const topPort = stockByPort.slice().sort((a,b) => b.total - a.total)[0];
          answer = responseIsAr
            ? 'إجمالي المولدات: ' + total + '\nفي المخزون: ' + inStock + '\nمركبة: ' + clipped + '\nفي الصيانة: ' + maintenanceCount + '\nأكبر مخزون: ' + (topPort?.port || '—') + ' (' + (topPort?.total || 0) + ')'
            : 'Total gensets: ' + total + '\nIn stock: ' + inStock + '\nClipped on: ' + clipped + '\nMaintenance: ' + maintenanceCount + '\nLargest port stock: ' + (topPort?.port || '—') + ' (' + (topPort?.total || 0) + ')';
        } else if (/operation|booking|container|عملية|حجز|حاوية|حاويه/.test(normalizedQuestion)) {
          const active = operations.filter(o => String(o.status || '').toUpperCase() === 'IN PROGRESS').length;
          const done = operations.filter(o => String(o.status || '').toUpperCase() === 'DONE').length;
          answer = responseIsAr ? 'إجمالي العمليات المسجلة: ' + operations.length + '\nمكتملة: ' + done + '\nتحت التشغيل: ' + active : 'Total recorded operations: ' + operations.length + '\nDone: ' + done + '\nIn progress: ' + active;
        } else if (/invoice|financial|money|paid|فاتور|مالي|مدفوع|مستحق/.test(normalizedQuestion)) {
          const billed = invoices.reduce((n,i) => n + (Number(i.amount) || 0), 0);
          const paid = invoices.filter(i => String(i.status || '').toUpperCase() === 'PAID').reduce((n,i) => n + (Number(i.amount) || 0), 0);
          answer = responseIsAr ? 'إجمالي الفواتير: ' + billed.toLocaleString() + '\nالمدفوع: ' + paid.toLocaleString() + '\nالمتبقي: ' + (billed-paid).toLocaleString() : 'Total invoiced: ' + billed.toLocaleString() + '\nPaid: ' + paid.toLocaleString() + '\nOutstanding: ' + (billed-paid).toLocaleString();
        } else if (/^(hi|hello|hey|hello dali|hi dali|hey dali|اهلا|أهلا|مرحبا|سلام|السلام عليكم|صباح الخير|مساء الخير)\\s*(dali|دالي)?[!?.،]*$/i.test(normalizedQuestion)) {
          answer = responseIsAr
            ? 'أهلاً 👋 أنا دالي. أقدر أساعدك في بيانات الأسطول والتشغيل والصيانة والموانئ والحجوزات والحاويات والعملاء والفواتير، وأقدر أكمل معاك من سياق كلامنا السابق.'
            : 'Hello 👋 I’m Dali. I can help with fleet, operations, maintenance, ports, bookings, containers, customers and invoices — and I can keep the conversation context.';
        } else if (/^(what do you know|what can you do|who are you|who is dali|what is dali|tell me about yourself|ايه اللي تعرفه|ماذا تعرف|ماذا تستطيع|مين انت|مين دالي|من هو دالي|ما هو دالي|بتعرف ايه)$/i.test(normalizedQuestion)) {
          const daliAgeAr = getDaliAgeText(true);
          const daliAgeEn = getDaliAgeText(false);
          const active = gensets.filter(g => String(g.status || '').toUpperCase() === 'CLIPPED_ON').length;
          const inStockNow = gensets.filter(g => String(g.status || '').toUpperCase() === 'IN_STOCK').length;
          const maintenanceNow = gensets.filter(g => String(g.status || '').toUpperCase() === 'MAINTENANCE').length;
          const retiredNow = gensets.filter(g => String(g.status || '').toUpperCase() === 'RETIRED').length;
          answer = responseIsAr
            ? `أنا دالي 🤖

أنا نموذج ذكاء اصطناعي أنشأني بيبيتو عشان أكون جزء من أسطول النيل، وتحديداً أساعد في قسم المولدات.

عندي ${daliAgeAr} دلوقتي، ولسه بتعلم. البداية كانت مجرد فكرة، وخلال الفترة اللي فاتت اتعلمت عن المولدات والمخزون، التشغيل والعمليات، الحجوزات والحاويات، الموانئ والمواقع، الصيانة والورشة، الوقود والغاز، الأسعار والفواتير، العملاء والتقارير.

وأهم حاجة اتعلمتها إن الرقم لوحده مش كفاية. لازم أفهم العلاقة بين البيانات.

مثلاً لو لقيت مولدين بنفس الرقم شغالين في Operations في نفس الوقت، أو Booking وعدد المولدات المرتبطة بيه مش مطابق للعمليات، أو مولد ظاهر في عملية من ميناء بينما الـ Stock بيقول إنه في ميناء تاني، هنا دوري إني أنبهك إن فيه تعارض محتاج مراجعة.

أنا أبحث في بيانات السيستم قبل ما أخمن. ولو مش متأكد، هقولك. ولو حاجة محتاجة تعديل، هوضح المشكلة والتعديل المقترح الأول ومش هغير البيانات من نفسي.

أنا مش موظف في الهيكل الإداري. أنا طبقة الذكاء داخل النظام، موجود عشان أساعدك تفهم البيانات وتلاحظ الحاجات اللي ممكن تعدي من غير ما حد ياخد باله.

وحالياً أقدر أتعامل مع بيانات حقيقية مثل:
• المولدات: ${gensets.length} وحدة
• تشغيل فعلي: ${active}
• بالمخزون: ${inStockNow}
• صيانة: ${maintenanceNow}
• متقاعد: ${retiredNow}
• العمليات: ${operations.length}
• الفواتير: ${invoices.length}
• سجلات الصيانة: ${maintenance.length}

وأقدر أكمل معاك من نفس السياق، مثل: "فين المولد 125؟" وبعدها "وماذا عن صيانته؟".`
            : `I’m DALI 🤖

I was created by Bebito to be part of Nile Fleet, specifically to support the Genset Department.

I’m ${daliAgeEn} now, and I’m still learning. I started as an idea and grew through the work around the system: gensets and stock, operations, bookings and containers, ports and locations, maintenance and workshop, fuel, prices and invoices, customers and reporting.

The most important thing I learned is that a number alone is not enough. I need to understand the relationships between the data.

I can flag duplicate active genset numbers, Booking/Operation count mismatches, or a genset whose Operation location conflicts with its Stock location.

I search the system before guessing. If I’m unsure, I say so. If something needs changing, I explain the problem and proposed correction first instead of silently changing data.

I’m not an employee in the administrative hierarchy. I’m the intelligence layer inside the system.

I currently work with live data such as:
• Gensets: ${gensets.length}
• Currently operating: ${active}
• In stock: ${inStockNow}
• Maintenance: ${maintenanceNow}
• Retired: ${retiredNow}
• Operations: ${operations.length}
• Invoices: ${invoices.length}
• Maintenance records: ${maintenance.length}

I can also keep context across follow-ups — for example, “Where is genset 125?” followed by “What about its maintenance?”.`        } else if (/^(what can dali do for me|what can dali do|what can you do for me|دالي يقدر يعمل ايه ليا|دالي يقدر يعمل إيه ليا|دالي يقدر يعمل ايه|دالي يقدر يعمل إيه|ماذا يستطيع دالي أن يفعل|ماذا يستطيع دالي ان يفعل|ماذا يمكن لدالي أن يفعل)$/i.test(normalizedQuestion)) {
          answer = responseIsAr
            ? `طيب… بعد ما عرفت أنا مين، خليني أقولك أقدر أساعدك في إيه. 🤖

أنا مش موجود بس عشان أجاوب على الأسئلة.

أقدر أبحث في بيانات السيستم، أربط المعلومات ببعض، وأساعدك تفهم اللي بيحصل في الشغل.

عايز تعرف كام مولد شغال دلوقتي؟ أقدر أجيبهم لك.

عايز تعرف مولد معين موجود فين؟ أقدر أدور عليه وأراجع حالته ومكانه.

عايز تعرف حجوزات اليوم؟ أقدر أعرضها لك وأربطها بالعمليات والمولدات المرتبطة بكل حجز.

ولو سألتني عن مولد معين، مش هبص على رقمه بس. هراجع حالته، مكانه، آخر عملية، والبيانات المرتبطة بيه.

والأهم… أقدر ألاحظ المشاكل اللي ممكن ما تكونش واضحة من شاشة واحدة.

مثلاً لو المولد موجود في المخزون في ميناء، لكن فيه عملية بتقول إنه موجود في ميناء تاني، هقولك إن فيه تعارض محتاج مراجعة. ⚠️

ولو نفس رقم المولد مستخدم في عمليتين شغالتين في نفس الوقت، هوقف عند النقطة دي وأنبهك.

ولو الحجز بيقول إن عليه 5 مولدات، لكن العمليات المرتبطة بيه فيها 4 بس، هقولك إن عدد المولدات مش متطابق.

أقدر كمان أساعدك في متابعة المولدات، المخزون، العمليات، الحجوزات، الحاويات، الموانئ، الصيانة، الورشة، الوقود، الأسعار، الفواتير، العملاء والتقارير.

ومش لازم تسألني بنفس طريقة السيستم. ممكن تكلمني بشكل طبيعي.

ولو مش عارف الإجابة، مش هخمن. هقولك إني مش متأكد وأبحث في البيانات المتاحة الأول.

ومع الوقت، كل ما تدربني وتصححلي، أقدر أفهم مصطلحات الشغل وطريقة استخدام السيستم بشكل أفضل.

أنا مش هاخد القرار مكانك. أنا أبحث، أربط البيانات، ألاحظ المشاكل، وأشرح لك اللي لقيته.

وأنت صاحب القرار.

يعني بدل ما أنت تدور على المعلومة…

أنا أدور معاك. 🤖`
            : `After you know who I am, here’s what I can do for you. 🤖

I can search system data, connect related records, answer operational questions, find gensets and review their location/status, show bookings, and spot inconsistencies across Stock and Operations.

I can help with gensets, stock, operations, bookings, containers, ports, maintenance, workshop, fuel, prices, invoices, customers and reports.

You can talk to me naturally. If I don’t know the answer, I won’t guess — I’ll say so and search the available data first.

As you train and correct me, I can understand Nile Fleet’s terminology and workflow better over time.

I don’t make decisions for you. I search, connect the data, notice issues, and explain what I found.

You make the decision.

Instead of you searching for the information…

I’ll search with you. 🤖`;
        } else {
          answer = responseIsAr
            ? 'لم أجد إجابة مباشرة لهذا السؤال في البيانات الحالية. جرّب ذكر المولد أو العميل أو الميناء أو رقم الحجز.'
            : 'I could not find a direct answer in the current data. Try giving me the genset, customer, port, or booking number.';
        }
      }
      const finalAnswer = answer || (isAr ? 'مش لاقي رد واضح من البيانات الحالية.' : 'I could not get a clear answer from the current data.');
      setAiChatMessages(prev => [...prev, { role: 'ai', text: finalAnswer }]);
      if (identityQuestion) completeDaliIntro();
      setDaliMemory(prev => [...prev, { role: 'assistant', message: finalAnswer }].slice(-30));
      void saveDaliMemory('assistant', finalAnswer);
    } catch (e) {
      console.error('DALI chat error', e);
      const detail = e instanceof Error ? e.message : String(e);
      setAiChatMessages(prev => [...prev, {
        role: 'ai',
        text: isAr ? `خطأ DALI: ${detail}` : `DALI ERROR: ${detail}`
      }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const handlePortGateTabClick = (tab: 'GATE' | 'TRANSIT' | 'UPCOMING') => {
    sessionStorage.setItem('portGateTab', tab);
    setActivePortGateTab(tab);
    setActiveScreen('port-gate');
    window.dispatchEvent(new CustomEvent('port-gate-tab-change', { detail: tab }));
  };

  const handleInvoicesTabClick = (tab: 'ALL' | 'NEED_ISSUE' | 'PAST_DUE') => {
    sessionStorage.setItem('invoicesTab', tab);
    setActiveInvoicesTab(tab);
    setActiveScreen('booking-invoices');
    window.dispatchEvent(new CustomEvent('invoices-tab-change', { detail: tab }));
  };

  const toggleTheme = () => {
    const nextTheme = isDark ? 'day' : 'night';
    setTheme(nextTheme);
    setThemeIslandOpen(true);
    if (themeIslandTimerRef.current) clearTimeout(themeIslandTimerRef.current);
    themeIslandTimerRef.current = setTimeout(() => setThemeIslandOpen(false), 1800);
  };

  useEffect(() => () => {
    if (themeIslandTimerRef.current) clearTimeout(themeIslandTimerRef.current);
  }, []);

  const toggleFullscreen = async () => {
    try {
      const docEl = document.documentElement as any;
      const doc = document as any;

      if (!document.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        if (isPseudoFullscreen) {
          setIsPseudoFullscreen(false);
          return;
        }
        
        const requestMethod = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        if (requestMethod) {
          await requestMethod.call(docEl);
        } else {
          setIsPseudoFullscreen(true);
        }
      } else {
        const exitMethod = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exitMethod) {
          await exitMethod.call(doc);
        }
        setIsPseudoFullscreen(false);
      }
    } catch (e) {
      console.warn("Standard fullscreen failed or was blocked. Falling back to pseudo-fullscreen mode.", e);
      setIsPseudoFullscreen(prev => !prev);
    }
  };

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = screenScrollPositions.current.get(activeScreen) || 0;
    }
    setIsMobileMenuOpen(false);
  }, [activeScreen]);

  const isInternal = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER || user.role === UserRole.VIEWER;
  const isGate = user.role === UserRole.GATE_OPERATOR;
  
  const dashboardId = isInternal ? 'dashboard' : (isGate ? 'port-gate' : 'cust-reservations');
  const isHome = activeScreen === dashboardId;

  const allPossibleMenuItems = [
    { id: 'dashboard', label: t.dashboard, icon: '📊' },
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'master-view', label: t.masterView, icon: '📑' },
    { id: 'operations', label: t.operations, icon: '🚛' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'booking-invoices', label: lang === 'ar' ? 'فواتير الحجوزات' : 'BOOKING INVOICES', icon: '🧾' },
    { id: 'analytics', label: t.analytics, icon: '📈' },
    { id: 'intelligence', label: t.intelligence, icon: '🧠' },
    { id: 'reports', label: t.reports, icon: '📝' },
    { id: 'stock', label: t.gensetStock, icon: '⚡' },
    { id: 'reservations', label: t.reservations, icon: '📅' },
    { id: 'daily-dispatch', label: isAr ? 'خطة التوزيع اليومية' : 'DAILY DISPATCH', icon: '🗂️' },
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
    { id: 'organization', label: isAr ? 'الهيكل التنظيمي' : 'ORGANIZATION', icon: '🏢' },
    { id: 'customer-prices', label: t.customerPrices, icon: '💰' },
    { id: 'financials', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'system-log', label: t.systemLog, icon: '🕒' },
    { id: 'cust-reservations', label: t.reservations, icon: '📅' },
    { id: 'cust-invoices', label: t.financials, icon: '🏦' },
    { id: 'user-settings', label: t.userSettings, icon: '⚙️' },
  ];

  const defaultMenu = isInternal ? [
    { id: 'dashboard', label: t.dashboard, icon: '📊' },
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'master-view', label: t.masterView, icon: '📑' },
    { id: 'operations', label: t.operations, icon: '🚛' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'booking-invoices', label: lang === 'ar' ? 'فواتير الحجوزات' : 'BOOKING INVOICES', icon: '🧾' },
    { id: 'analytics', label: t.analytics, icon: '📈' },
    { id: 'intelligence', label: t.intelligence, icon: '🧠' },
    { id: 'reports', label: t.reports, icon: '📝' },
    { id: 'stock', label: t.gensetStock, icon: '⚡' },
    { id: 'reservations', label: t.reservations, icon: '📅' },
    { id: 'daily-dispatch', label: isAr ? 'خطة توزيع المولدات اليومية' : 'DAILY GENSET DISPATCH', icon: '🗂️' },
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
    { id: 'organization', label: isAr ? 'الهيكل التنظيمي' : 'ORGANIZATION', icon: '🏢' },
    { id: 'customer-prices', label: t.customerPrices, icon: '💰' },
    { id: 'financials', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'system-log', label: t.systemLog, icon: '🕒' },
  ] : (isGate ? [    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'user-settings', label: t.userSettings, icon: '⚙️' },
  ] : [
    { id: 'cust-reservations', label: t.reservations, icon: '📅' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'cust-invoices', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
  ]);

  const roleDefaultScreenIds = user.role === UserRole.MANAGER
    ? ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'daily-dispatch', 'customers', 'customer-prices', 'booking-invoices', 'financials', 'intelligence', 'reports', 'notifications', 'system-log']
    : user.role === UserRole.VIEWER
      ? ['dashboard', 'master-view', 'reports', 'intelligence', 'notifications', 'support', 'system-log']
      : null;
  const menu = user.role === UserRole.CUSTOMER
    ? allPossibleMenuItems.filter(item => ['cust-reservations', 'cust-invoices', 'notifications', 'support'].includes(item.id))
    : Array.isArray(user.allowedScreens)
      ? allPossibleMenuItems.filter(item => user.allowedScreens?.includes(item.id))
    : roleDefaultScreenIds
      ? allPossibleMenuItems.filter(item => roleDefaultScreenIds.includes(item.id))
      : defaultMenu;

    const sidebarBg = isDark ? 'bg-[#001224]' : 'bg-[#e9e5de] shadow-xl';
  const mainBg = isDark ? 'bg-[#000b14]' : 'bg-[#f3f1ec]';
  const borderClass = isDark ? 'border-[#C2A37822]' : 'border-[#d8d2c8]';
  const textPrimary = isDark ? 'text-white' : 'text-[#26231f]';
  const textSecondary = isDark ? 'text-[#C2A37888]' : 'text-[#5f5a52]';
  const headerBg = isDark ? 'bg-[#001224bb] border-[#C2A37822]' : 'bg-[#faf9f6]/90 border-[#d8d2c8]';

  const getNavItemClass = (itemId: string) => {
    const isActive = activeScreen === itemId;
    if (isDark) return isActive ? 'bg-[#C2A378] text-[#26231f] shadow-[0_0_20px_rgba(194,163,120,0.4)]' : 'text-[#C2A378aa] hover:bg-white/5 hover:text-white';
    return isActive ? 'bg-[#C2A378] text-[#26231f] shadow-md' : 'text-[#5f5a52] hover:bg-[#e4dfd6]';
  };

  const forceBanners = notifications.filter(n => n.forceBanner);

  return (
    <div className={`nile-command-layout flex flex-col lg:flex-row h-screen overflow-hidden ${lang === 'ar' ? 'rtl' : 'ltr'} transition-colors duration-500 ${isPseudoFullscreen ? 'fixed inset-0 w-screen h-screen z-[99999]' : ''}`} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* FORCE NOTIFICATION BANNERS */}
      {forceBanners.length > 0 && !isMuted && (
        <div className="fixed top-0 left-0 right-0 z-[1000] no-print">
          {forceBanners.map(n => (
            <div key={n.id} className={`flex items-center justify-between px-6 py-2 text-white font-black uppercase text-[9px] tracking-widest animate-in slide-in-from-top-full duration-500 shadow-xl ${n.type === 'CRITICAL' ? 'bg-rose-600' : n.type === 'WARNING' ? 'bg-amber-600' : 'bg-blue-600'}`}>
               <div className="flex items-center gap-3">
                  <span className="text-xs">⚠️</span>
                  <span>{isAr ? n.messageAr : n.message}</span>
               </div>
               <button onClick={() => db.dismissNotification(n.id)} className="hover:scale-110 transition-transform font-bold p-1 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* SIDEBAR (Desktop) */}
      <aside className={`hidden lg:flex ${isSidebarCollapsed ? 'w-16' : 'w-56'} flex-col border-r transition-all duration-300 relative shrink-0 z-50 no-print`} style={{ backgroundColor: 'var(--rail-bg)', borderRightColor: 'var(--border-primary)' }}>
        <div className={`p-4 border-b ${borderClass} flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="flex items-center justify-center gap-2">
            <img src="/nile-fleet-logo.png" className="h-9 w-9 object-contain" alt="Nile Fleet" />
            {!isSidebarCollapsed && <h1 className={`text-lg font-black ${textPrimary} tracking-widest uppercase italic`}>NILE <span className="text-[#C2A378]">FLEET</span></h1>}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar text-start">
          {menu.map(item => (
            <React.Fragment key={item.id}>
              <button 
                title={item.label} 
                onClick={() => {
                  if (item.id === 'port-gate') {
                    handlePortGateTabClick(activePortGateTab);
                  } else if (item.id === 'booking-invoices') {
                    handleInvoicesTabClick(activeInvoicesTab);
                  } else {
                    setActiveScreen(item.id);
                  }
                }} 
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group ${getNavItemClass(item.id)} ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3'}`}
              >
                <span className="text-base">{(item as any).icon}</span>
                {!isSidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="font-black text-[9px] uppercase tracking-widest truncate">{item.label}</span>
                    {item.id === 'port-gate' && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextState = !isPortGateSubmenuCollapsed;
                          setIsPortGateSubmenuCollapsed(nextState);
                          sessionStorage.setItem('portGateSubmenuCollapsed', String(nextState));
                        }}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs transition-all cursor-pointer ml-1 text-[#C2A378] font-bold leading-none select-none"
                        title={isPortGateSubmenuCollapsed ? (isAr ? "توسيع" : "Expand shortcuts") : (isAr ? "تقليص" : "Minimize shortcuts")}
                      >
                        {isPortGateSubmenuCollapsed ? '▼' : '▲'}
                      </span>
                    )}
                    {item.id === 'booking-invoices' && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextState = !isInvoicesSubmenuCollapsed;
                          setIsInvoicesSubmenuCollapsed(nextState);
                          sessionStorage.setItem('invoicesSubmenuCollapsed', String(nextState));
                        }}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs transition-all cursor-pointer ml-1 text-[#C2A378] font-bold leading-none select-none"
                        title={isInvoicesSubmenuCollapsed ? (isAr ? "توسيع" : "Expand shortcuts") : (isAr ? "تقليص" : "Minimize shortcuts")}
                      >
                        {isInvoicesSubmenuCollapsed ? '▼' : '▲'}
                      </span>
                    )}
                  </div>
                )}
              </button>
              
              {item.id === 'port-gate' && !isSidebarCollapsed && !isPortGateSubmenuCollapsed && (
                <div className="pl-6 pr-2 my-1.5 space-y-1.5 border-l border-dashed border-[#C2A37855] ml-4 text-start font-mono">
                  {[
                    { tab: 'GATE' as const, label: isAr ? 'البوابة' : 'GATE', icon: '🚪' },
                    { tab: 'TRANSIT' as const, label: isAr ? 'النشطة' : 'ACTIVE', icon: '🟢' },
                    { tab: 'UPCOMING' as const, label: isAr ? 'القادمة' : 'NEXT', icon: '⏳' }
                  ].map(sub => {
                    const isSubActive = activeScreen === 'port-gate' && activePortGateTab === sub.tab;
                    const subClass = isSubActive 
                      ? (isDark ? 'text-[#C2A378] font-bold' : 'text-[#9b7438] font-bold') 
                      : 'text-[#C2A378aa] hover:text-white dark:hover:text-white';
                    return (
                      <button 
                        key={sub.tab} 
                        onClick={() => handlePortGateTabClick(sub.tab)} 
                        className={`w-full flex items-center gap-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${subClass}`}
                      >
                        <span className="text-xs">{sub.icon}</span>
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {item.id === 'booking-invoices' && !isSidebarCollapsed && !isInvoicesSubmenuCollapsed && (
                <div className="pl-6 pr-2 my-1.5 space-y-1.5 border-l border-dashed border-[#C2A37855] ml-4 text-start font-mono">
                  {[
                    { tab: 'ALL' as const, label: isAr ? 'جميع الفواتير' : 'ALL INVOICES', icon: '🧾' },
                    { tab: 'NEED_ISSUE' as const, label: isAr ? 'تحتاج إصدار' : 'NEED ISSUE', icon: '⚡' },
                    { tab: 'PAST_DUE' as const, label: isAr ? 'تجاوز الاستحقاق' : 'DUE PASSES', icon: '⚠️' }
                  ].map(sub => {
                    const isSubActive = activeScreen === 'booking-invoices' && activeInvoicesTab === sub.tab;
                    const subClass = isSubActive 
                      ? (isDark ? 'text-[#C2A378] font-bold' : 'text-blue-600 font-bold') 
                      : 'text-[#C2A378aa] hover:text-white dark:hover:text-white';
                    return (
                      <button 
                        key={sub.tab} 
                        onClick={() => handleInvoicesTabClick(sub.tab)} 
                        className={`w-full flex items-center gap-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${subClass}`}
                      >
                        <span className="text-xs">{sub.icon}</span>
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`absolute -right-3 top-16 bg-[#C2A378] text-[#26231f] w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 border-2 border-[var(--rail-bg)]`}>
          <span className="text-[10px] font-bold">{isSidebarCollapsed ? '→' : '←'}</span>
        </button>
        <div className={`p-3 border-t ${borderClass} ${isDark ? 'bg-black/40' : 'bg-[#f3f1ec]'}`}>
          <div className={`mb-3 flex items-center gap-2 px-1 ${isSidebarCollapsed ? 'flex-col px-0' : ''}`}>
            <div className={`w-8 h-8 rounded-lg bg-[#C2A378] overflow-hidden flex items-center justify-center text-[#001F3F] text-[10px] font-black border border-white/20 cursor-pointer uppercase`} onClick={() => setActiveScreen('user-settings')}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : user.name[0]}
            </div>
            {!isSidebarCollapsed && <div className="flex-1 min-w-0 text-start leading-tight"><p className={`text-[8px] font-black ${textSecondary} uppercase`}>{user.role}</p><p className={`text-[10px] font-bold ${textPrimary} truncate uppercase`}>{user.name}</p></div>}
          </div>
          <button onClick={onLogout} className={`w-full px-3 py-2 rounded-lg text-[9px] font-black transition-all border uppercase tracking-widest ${isDark ? 'bg-rose-900/20 hover:bg-rose-600 text-rose-100 border-rose-900/50' : 'bg-rose-50 hover:bg-rose-600 text-rose-500 border-rose-100'}`}>{isSidebarCollapsed ? 'OUT' : t.signOut}</button>
        </div>
      </aside>

      {/* MOBILE MENU OVERLAY (More menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-black/35 backdrop-blur-sm no-print">
          <div className={`absolute top-0 bottom-0 ${isAr ? 'right-0' : 'left-0'} w-[min(88vw,380px)] max-w-full bg-[var(--card-bg)] shadow-2xl border-white/10 ${isAr ? 'border-l' : 'border-r'} p-4 flex flex-col pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
          <div className="flex justify-between items-center mb-4">
            <h1 className="flex items-center gap-2 text-xl font-black text-white tracking-widest uppercase italic"><img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet" />NILE <span className="text-[#C2A378]">FLEET</span></h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="h-11 w-11 rounded-xl bg-white/10 text-white flex items-center justify-center text-lg border border-white/10">✕</button>
          </div>
          
          {/* User Info Card in Menu */}
          <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
             <div className="w-12 h-12 rounded-xl bg-[#C2A378] overflow-hidden">
                {user.avatarUrl && <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" />}
             </div>
             <div className="text-start">
                <p className="text-white font-black text-xs uppercase tracking-tight">{user.name}</p>
                <p className="text-[#C2A378] font-bold text-[8px] uppercase tracking-widest">{user.role} LEVEL</p>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {menu.map(item => (
              <React.Fragment key={item.id}>
                <button 
                  onClick={() => {
                    if (item.id === 'port-gate') {
                      handlePortGateTabClick(activePortGateTab);
                      setIsMobileMenuOpen(false);
                    } else {
                      setActiveScreen(item.id);
                      setIsMobileMenuOpen(false);
                    }
                  }} 
                  className={`w-full min-h-12 flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${activeScreen === item.id ? 'bg-[#C2A378] text-[#26231f]' : 'bg-black/5 text-[var(--text-secondary)]'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg">{(item as any).icon}</span>
                    <span className="font-black text-[10px] uppercase tracking-widest">{item.label}</span>
                  </div>
                  {item.id === 'port-gate' && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextState = !isPortGateSubmenuCollapsed;
                        setIsPortGateSubmenuCollapsed(nextState);
                        sessionStorage.setItem('portGateSubmenuCollapsed', String(nextState));
                      }}
                      className="p-2 rounded-lg bg-black/10 text-[10px] text-[#C2A378] font-black leading-none select-none"
                    >
                      {isPortGateSubmenuCollapsed ? '▼' : '▲'}
                    </span>
                  )}
                </button>
                
                {item.id === 'port-gate' && !isPortGateSubmenuCollapsed && (
                  <div className="pl-8 pr-4 py-2 space-y-3 border-l border-dashed border-[#C2A37855] ml-6 text-start font-mono flex flex-col">
                    {[
                      { tab: 'GATE' as const, label: isAr ? 'البوابة' : 'GATE', icon: '🚪' },
                      { tab: 'TRANSIT' as const, label: isAr ? 'النشطة' : 'ACTIVE', icon: '🟢' },
                      { tab: 'UPCOMING' as const, label: isAr ? 'القادمة' : 'NEXT', icon: '⏳' }
                    ].map(sub => {
                      const isSubActive = activeScreen === 'port-gate' && activePortGateTab === sub.tab;
                      const subClass = isSubActive 
                        ? 'text-[#C2A378] font-black' 
                        : 'text-slate-400 hover:text-white';
                      return (
                        <button 
                          key={sub.tab} 
                          onClick={() => {
                            handlePortGateTabClick(sub.tab);
                            setIsMobileMenuOpen(false);
                          }} 
                          className={`flex items-center gap-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${subClass}`}
                        >
                          <span className="text-sm">{sub.icon}</span>
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Persistent Sign Out in Mobile Menu */}
          <div className="mt-4 pt-4 border-t border-white/10">
             <button 
              onClick={onLogout} 
              className="w-full py-5 rounded-2xl bg-rose-600/20 border border-rose-600/50 text-rose-500 font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
             >
                <span>👋</span>
                {t.signOut}
             </button>
          </div>
        </div>
          </div>
        )}

      {/* DALI — centered orb assistant */}
      <style>{`
        @keyframes daliOrbFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.025); }
        }
        @keyframes daliOrbPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(194,163,120,.12), 0 10px 35px rgba(0,0,0,.28); }
          50% { box-shadow: 0 0 0 10px rgba(194,163,120,.035), 0 14px 45px rgba(0,0,0,.36); }
        }
        @keyframes daliOrbThink {
          0% { transform: rotate(0deg) scale(.96); filter: brightness(1); }
          50% { transform: rotate(180deg) scale(1.06); filter: brightness(1.28); }
          100% { transform: rotate(360deg) scale(.96); filter: brightness(1); }
        }
        @keyframes daliOrbShimmer { 0%,100% { opacity:.12; } 50% { opacity:.28; } }
        @keyframes daliOrbCore {
          0%,100% { transform: scale(.78); opacity:.72; }
          50% { transform: scale(1.05); opacity:1; }
        }
        @keyframes daliOrbRing {
          0% { transform: rotate(0deg) scale(.92); opacity:.35; }
          50% { opacity:.8; }
          100% { transform: rotate(360deg) scale(1.08); opacity:.35; }
        }
        .dali-orb-idle { animation: daliOrbFloat 3.8s ease-in-out infinite, daliOrbPulse 3.8s ease-in-out infinite; }
        .dali-orb-thinking { animation: daliOrbThink 1.25s linear infinite; }
        .dali-orb-core { animation: daliOrbCore 1.1s ease-in-out infinite; }
        .dali-orb-ring { animation: daliOrbRing 1.8s linear infinite; }
        @keyframes daliBlobMorph { 0%,100% { border-radius:44% 56% 62% 38% / 42% 38% 62% 58%; transform:translateY(0) rotate(0deg) scale(1); } 25% { border-radius:62% 38% 44% 56% / 55% 48% 52% 45%; transform:translate(2px,-4px) rotate(3deg) scale(1.03); } 50% { border-radius:38% 62% 55% 45% / 42% 60% 40% 58%; transform:translate(-3px,1px) rotate(-4deg) scale(.985); } 75% { border-radius:55% 45% 38% 62% / 60% 42% 58% 40%; transform:translate(3px,3px) rotate(2deg) scale(1.015); } }
        .dali-blob { animation:daliBlobMorph 9s ease-in-out infinite; will-change:transform,border-radius; }
        @media (prefers-reduced-motion: reduce) {
          .dali-orb-idle,.dali-orb-thinking,.dali-orb-core,.dali-orb-ring { animation: none; }
        }
        .dali-first-message { animation: daliFirstMessage .75s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes daliFirstMessage {
          0% { opacity: 0; transform: translateY(10px) scale(.96); }
          55% { opacity: 1; transform: translateY(-2px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dali-chat-surface-light { background-color: rgba(248,250,252,.50); }
        .dali-chat-surface-dark { background-color: rgba(4,14,24,.28); }
        .dali-bg-soft { background-image: radial-gradient(circle at 12% 8%, rgba(194,163,120,.14), transparent 32%), radial-gradient(circle at 88% 82%, rgba(0,31,63,.12), transparent 36%); }
        .dali-bg-grid { background-image: linear-gradient(rgba(194,163,120,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(194,163,120,.055) 1px, transparent 1px); background-size: 22px 22px; }
        .dali-bg-aurora { background-image: radial-gradient(circle at 18% 18%, rgba(194,163,120,.20), transparent 28%), radial-gradient(circle at 82% 72%, rgba(0,31,63,.12), transparent 30%); }
        .dali-bg-blueprint { background-image: linear-gradient(rgba(194,163,120,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(194,163,120,.045) 1px, transparent 1px), radial-gradient(circle at 50% 20%, rgba(194,163,120,.07), transparent 38%); background-size: 26px 26px, 26px 26px, auto; }
        .dali-bg-clear { background-image: none; }
      `}</style>
      <div
        className="fixed z-[100] no-print"
        style={{
          right: window.innerWidth < 640 ? 8 : daliButtonPosition.right,
          bottom: Math.max(8, daliButtonPosition.bottom + daliViewport.keyboardInset)
        }}
      >
        {canUseDali && isAiChatOpen && (
          <section aria-label={isAr ? 'دالي' : 'DALI'} className="absolute bottom-[68px] right-0 z-50 w-[calc(100vw-28px)] max-w-[360px] sm:w-[400px] sm:max-w-none h-[min(560px,calc(100dvh-132px))] max-h-[calc(100dvh-132px)] flex flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071522]/94 shadow-[0_24px_70px_rgba(0,0,0,.48)] backdrop-blur-2xl" style={window.innerWidth < 640 ? {height:`${Math.min(560,Math.max(340,daliViewport.height-132))}px`,maxHeight:`${Math.max(340,daliViewport.height-132)}px`} : undefined}>
            <header className="relative shrink-0 px-4 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4">
              <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#C2A378]/70 to-transparent"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 shrink-0 sm:h-9 sm:w-9"><span className="absolute inset-0 rounded-[13px] bg-[#C2A378]/15 blur-md"></span><span className="absolute inset-1 rounded-[12px] border border-white/20 bg-white/[0.07]"></span><span className="absolute inset-[11px] rounded-full bg-gradient-to-br from-white via-[#E8D8C0] to-[#C2A378] shadow-[0_0_18px_rgba(194,163,120,.42)]"></span></div>
                  <div><p className="text-[12px] font-black tracking-[0.08em] text-white">DALI</p><p className="mt-0.5 text-[7px] font-semibold tracking-[0.08em] text-white/40">{isAr ? 'ذكاء أسطول النيل' : 'NILE FLEET INTELLIGENCE'}</p></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={clearDaliChat} disabled={aiChatLoading} className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.045] text-white/65 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-30" title={isAr ? 'محادثة جديدة' : 'New chat'}>＋</button>
                  <button type="button" onClick={loadDaliArchive} disabled={daliHistoryLoading} className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.045] text-white/65 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-30" title={isAr ? 'المحادثات السابقة' : 'Previous chats'}>◫</button>
                  <button type="button" onClick={archiveCurrentDaliChat} disabled={aiChatLoading || aiChatMessages.length===0} className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.045] text-white/65 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-30" title={isAr ? 'أرشفة المحادثة' : 'Archive chat'}>↧</button>
                  <button type="button" onClick={async()=>{await clearDaliChat();setIsAiChatOpen(false)}} disabled={aiChatLoading} className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.045] text-white/65 transition hover:bg-white/[0.09] hover:text-white/90 disabled:opacity-30" title={isAr ? 'إغلاق' : 'Close'}>×</button>
                </div>
              </div>
            </header>
            <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
              {daliArchiveOpen && <div className="absolute inset-0 z-30 overflow-y-auto rounded-b-[28px] bg-[#07131f]/96 p-5 backdrop-blur-3xl">
                <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black tracking-[0.18em] text-[#C2A378]">{isAr?'المحادثات السابقة':'PREVIOUS CHATS'}</p><p className="mt-1 text-[9px] text-white/40">{isAr?'اختار محادثة للرجوع إلى سياقها.':'Choose a conversation to restore its context.'}</p></div><button type="button" onClick={()=>setDaliArchiveOpen(false)} className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.05] text-white/70">×</button></div>
                {daliArchivedChats.length===0?<div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-[10px] text-white/40">{isAr?'لا توجد محادثات سابقة.':'No previous chats.'}</div>:<div className="space-y-2.5">{daliArchivedChats.map((chat:any)=><button key={chat.session_id} type="button" onClick={()=>restoreDaliArchivedChat(chat.session_id)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.07]"><div className="flex items-start justify-between gap-3"><span className="line-clamp-2 text-[11px] font-bold leading-5 text-white/90">{chat.title}</span><span className="shrink-0 text-[8px] font-black text-[#C2A378]">{chat.message_count}</span></div><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-white/40">{chat.preview}</p></button>)}</div>}
              </div>}
              {aiChatMessages.length===0&&!daliArchiveOpen&&<div className="flex min-h-full flex-col items-center justify-center text-center">
                <div className="relative mb-5 h-28 w-32 sm:mb-6 sm:h-36 sm:w-40"><span className="absolute inset-[15%] rounded-full bg-[#C2A378]/10 blur-3xl"></span><span className="absolute -inset-4 rounded-[45%] bg-[#C2A378]/[0.045] blur-2xl"></span><div className="dali-blob relative h-full w-full overflow-hidden border border-white/20 bg-[radial-gradient(ellipse_at_34%_25%,rgba(255,255,255,.68),rgba(194,163,120,.24)_30%,rgba(194,163,120,.10)_55%,rgba(2,6,23,.72)_100%)] shadow-[0_24px_90px_rgba(194,163,120,.12)] backdrop-blur-3xl"><div className="pointer-events-none absolute inset-[8%] rounded-[48%] bg-[radial-gradient(ellipse_at_32%_24%,rgba(255,255,255,.52),rgba(194,163,120,.10)_34%,transparent_68%)] opacity-80"></div><div className="absolute inset-[16%] rounded-[45%] bg-[radial-gradient(ellipse_at_35%_28%,rgba(255,255,255,.42),rgba(194,163,120,.14)_42%,transparent_75%)] blur-md"></div><div className="absolute left-[19%] top-[17%] h-3 w-3 rounded-full bg-white/70 blur-[2px]"></div><div className="absolute right-[20%] bottom-[21%] h-2 w-2 rounded-full bg-[#E8D8C0]/50 blur-[1px]"></div></div></div>
                <p className="text-[9px] font-bold tracking-[0.22em] text-[#C2A378]">{(()=>{const hour=new Date().getHours();return hour<12?(isAr?'صباح الخير':'GOOD MORNING'):hour<18?(isAr?'مساء الخير':'GOOD AFTERNOON'):(isAr?'مساء الخير':'GOOD EVENING')})()}</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">{user.name||(isAr?'مستخدم':'there')}</h2>
                <p className="mt-2 max-w-[270px] text-[10px] leading-5 text-white/42">{isAr?'أنا دالي. جاهز نشتغل على بيانات النظام.':'I’m DALI. Ready to work through the system with you.'}</p>
                <div className="mt-5 w-full max-w-[320px]"><div className="mb-2 flex items-center gap-2"><span className="h-px flex-1 bg-white/10"></span><span className="text-[7px] font-black tracking-[0.2em] text-white/30">{isAr?'ابدأ بسؤال':'START WITH A QUESTION'}</span><span className="h-px flex-1 bg-white/10"></span></div><div className="grid gap-2">{(()=>{const prompts=!daliIntroCompleted?(isAr?['مين دالي؟']:['Who is DALI?']):(isAr?[['كم مولد يعمل اليوم؟','اعرض حجوزات اليوم','أين المولد 125؟'],['⚠️ في تعارض في البيانات؟','📍 المولدات موجودة فين؟','📦 إيه الحجوزات اللي محتاجة متابعة؟']][daliSuggestedSet]:[['How many gensets are operating today?','Show today’s bookings','Where is genset 125?'],['⚠️ Are there any data conflicts?','📍 Where are the gensets?','📦 Which bookings need follow-up?']][daliSuggestedSet]);return prompts.map(prompt=><button key={prompt} type="button" onClick={()=>setAiChatInput(prompt.replace(/^[^\p{L}\p{N}]+/u,'').trim())} className="min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 text-left text-[10px] font-semibold leading-5 text-white/75 transition hover:border-white/20 hover:bg-white/[0.075] hover:text-white active:scale-[.99]">{prompt}</button>)})()}</div></div>
              </div>}
              {aiChatMessages.length>0&&<div className="flex flex-col gap-3 pt-1">{aiChatMessages.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] px-3.5 py-2.5 text-[12px] leading-5.5 sm:text-[13px] sm:leading-6 whitespace-pre-wrap break-words overflow-wrap-anywhere ${m.role==='user'?'rounded-[20px] rounded-br-md bg-[#C2A378] text-[#07131f]':'rounded-[20px] rounded-bl-md bg-white/[0.055] text-white/90'}`}>{m.text}</div></div>)}{!aiChatLoading&&daliPostIntroSuggestion&&<div className="flex justify-start pt-1"><button type="button" onClick={()=>{setAiChatInput(isAr?'دالي يقدر يعمل إيه؟':'What can DALI do?');setDaliPostIntroSuggestion(false)}} className="rounded-full border border-[#C2A378]/30 bg-[#C2A378]/10 px-4 py-2 text-[9px] font-bold text-[#C2A378] transition hover:bg-[#C2A378]/15">{isAr?'دالي يقدر يعمل إيه؟':'What can DALI do?'}</button></div>}</div>}
              {aiChatLoading&&<div className="flex flex-col items-center justify-center py-10 text-center"><div className="relative h-24 w-28"><div className="dali-blob absolute inset-0 overflow-hidden border border-[#C2A378]/25 bg-[radial-gradient(ellipse_at_35%_28%,rgba(255,255,255,.30),rgba(194,163,120,.18)_38%,rgba(0,31,63,.76)_100%)] shadow-[0_0_55px_rgba(194,163,120,.16)]"><div className="pointer-events-none absolute inset-[10%] rounded-[48%] bg-[radial-gradient(ellipse_at_30%_25%,rgba(255,255,255,.38),rgba(194,163,120,.12)_40%,transparent_72%)] opacity-80" style={{animation:'daliOrbCore 1.8s ease-in-out infinite'}}></div><div className="absolute inset-[30%] rounded-full bg-[#C2A378]/55 blur-md"></div></div></div><p className="mt-4 text-[9px] font-black tracking-[0.18em] text-[#C2A378]">{isAr?'دالي يفكر':'DALI IS THINKING'}</p><p className="mt-1 text-[9px] leading-5 text-white/35">{false?'•••':isAr?(false?['بشوف الموضوع 👀…','براجع البيانات…','بربط النتائج…','تمام، بجمعها لك…'][daliThinkingPhase]:false?['أحدد نوع الطلب…','أطابق المصطلحات…','أراجع السجلات المرتبطة…','أتحقق من النتيجة…'][daliThinkingPhase]:['براجع البيانات المرتبطة…','ببحث في سجلات النظام…','براجع النتائج المرتبطة…','بجمع الإجابة…'][daliThinkingPhase]):(false?['Taking a quick look 👀…','Checking the data…','Connecting the results…','Got it — putting it together…'][daliThinkingPhase]:false?['Classifying the request…','Matching terminology…','Reviewing related records…','Validating the result…'][daliThinkingPhase]:['Checking the relevant system data…','Searching the system records…','Reviewing the related results…','Putting the answer together…'][daliThinkingPhase])}</p></div>}
            </div>
            <footer className="shrink-0 border-t border-white/10 bg-black/10 p-2.5 sm:p-3.5"><div className="flex items-end gap-2 rounded-[20px] border border-white/10 bg-white/[0.045] p-1.5 focus-within:border-white/20 focus-within:bg-white/[0.065]"><textarea value={aiChatInput} onChange={e=>setAiChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askNileAi()}}} placeholder={isAr?'اكتب لدالي...':'Message DALI...'} onFocus={e=>{if(window.innerWidth<640){const target=e.currentTarget;window.setTimeout(()=>{if(target&&target.isConnected)target.scrollIntoView({block:'nearest',behavior:'smooth'})},80)}}} className="min-h-[46px] max-h-28 flex-1 resize-none rounded-[15px] border-0 bg-transparent px-3 py-2.5 text-[16px] leading-6 text-white outline-none placeholder:text-white/30 sm:text-[13px]"/><button data-dali-send onClick={askNileAi} disabled={aiChatLoading||!aiChatInput.trim()} className="h-11 w-11 shrink-0 rounded-[15px] bg-[#C2A378] text-[#07131f] transition hover:brightness-110 active:scale-95 disabled:opacity-25" title={isAr?'إرسال':'Send'}>↑</button></div><p className="mt-2 px-1 text-[7px] text-white/25">{isAr?'دالي يبحث في بيانات النظام قبل أن يخمّن.':'DALI checks system data before guessing.'}</p></footer>
          </section>
        )}
        <button
          data-dali-button
          onClick={() => { if (daliDraggedRef.current) { daliDraggedRef.current = false; return; } setIsAiChatOpen(v => !v); }}
          onPointerDown={handleDaliPointerDown}
          onPointerMove={handleDaliPointerMove}
          onPointerUp={handleDaliPointerUp}
          onPointerCancel={handleDaliPointerUp}
          className="group relative flex h-[48px] w-[48px] sm:h-[56px] sm:w-[56px] items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          title={isAr ? "دالي — اسحب لتغيير المكان" : "DALI — drag to move"}
          aria-label={isAr ? "فتح دالي" : "Open DALI"}
        >
          <span className="absolute -inset-1.5 rounded-[44%_56%_62%_38%/42%_38%_62%_58%] bg-[#C2A378]/10 blur-lg opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110"></span>
          <span className={`dali-blob absolute inset-0 rounded-[44%_56%_62%_38%/42%_38%_62%_58%] border border-white/30 bg-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,.38)] backdrop-blur-2xl overflow-hidden opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-[1.06] ${aiChatLoading ? "dali-orb-thinking" : "dali-orb-idle"}`}>
            <span className="absolute inset-1 rounded-[46%_54%_60%_40%/44%_40%_60%_56%] border border-[#C2A378]/30 border-t-transparent dali-orb-ring"></span>
            <span className="absolute inset-2 rounded-[48%_52%_58%_42%/46%_42%_58%_54%] border border-white/15 border-b-transparent dali-orb-ring" style={{animationDuration:"2.7s", animationDirection:"reverse"}}></span>
            <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.55),rgba(194,163,120,.18)_38%,rgba(100,116,139,.12)_72%,transparent)]"></span>
            <span className="absolute inset-[34%] rounded-full bg-[#C2A378]/28 blur-[5px]"></span>
            <span className="absolute -inset-y-8 left-0 w-1/3 rotate-[18deg] bg-white/15 blur-xl" style={{animation:"daliOrbShimmer 3.6s ease-in-out infinite"}}></span>
            <span className="absolute top-[13%] left-[22%] h-2 w-2 rounded-full bg-white/70 blur-[1px]"></span>
          </span>
        </button>
      </div>

      {/* MAIN CONTENT */}
      <main ref={mainContentRef} onScroll={() => screenScrollPositions.current.set(activeScreen, mainContentRef.current?.scrollTop || 0)} className={`flex-1 overflow-y-auto custom-scrollbar relative flex flex-col transition-colors duration-500 ${forceBanners.length > 0 ? 'mt-8' : ''}`} style={{ backgroundColor: 'var(--bg-primary)' }}>
        <header className="min-h-14 border-b flex items-center px-3 sm:px-4 lg:px-6 py-2 justify-between gap-2 shadow-sm backdrop-blur-md transition-colors no-print" style={{ backgroundColor: 'var(--rail-bg)', borderBottomColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} aria-label={isAr ? 'فتح القائمة' : 'Open navigation'}>☰</button>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <img src="/nile-fleet-logo.png" className="h-8 w-8 object-contain" alt="Nile Fleet" />
              <span className={`hidden md:inline text-sm font-black uppercase tracking-widest italic ${textPrimary}`}>NILE <span className="text-[#C2A378]">FLEET</span></span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-slate-300/40 shrink-0"></div>
            <div className="min-w-0 flex items-center gap-2">
              <div className="w-1 h-5 bg-[#C2A378] rounded-full shrink-0"></div>
              <h2 className={`text-[11px] sm:text-xs lg:text-sm font-black uppercase tracking-tight italic truncate ${textPrimary}`}>{activeScreen.replace('-', ' ')}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#C2A37866] bg-[#C2A37815] text-[#C2A378] text-[8px] font-black uppercase tracking-widest" title="System Creator">👑 {isAr ? 'منشئ النظام' : 'CREATOR'}</span>}
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center p-1.5 rounded-lg border transition-all ${isDark ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-[#d8d2c8] bg-[#faf9f6]'}`}
              title={isMuted ? (isAr ? 'إلغاء كتم التنبيهات' : 'Unmute Notifications') : (isAr ? 'كتم التنبيهات' : 'Mute Notifications')}
            >
               <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className={`hidden sm:flex relative min-h-[44px] min-w-[44px] items-center justify-center p-1.5 rounded-lg border transition-all overflow-hidden ${isDark ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isDark ? (isAr ? 'الوضع الفاتح' : 'Light Mode') : (isAr ? 'الوضع الداكن' : 'Dark Mode')}
              aria-label={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              <span className={`block text-base leading-none transition-all duration-500 ${isDark ? 'rotate-0' : 'rotate-180'}`}>{isDark ? '☀️' : '🌙'}</span>
            </button>
            <button onClick={() => setActiveScreen('notifications')} className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg border relative transition-all ${isDark ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}>
               <span className="text-base">🔔</span>
               {notifications.length > 0 && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>}
            </button>
            <button 
              onClick={toggleFullscreen} 
              className={`hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1.5 rounded-lg border transition-all ${(isFullscreen || isPseudoFullscreen) ? 'border-rose-500/50 bg-rose-500/10 text-rose-500' : (isDark ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white')}`}
              title={(isFullscreen || isPseudoFullscreen) ? (isAr ? 'خروج من ملء الشاشة' : 'Exit Fullscreen') : (isAr ? 'ملء الشاشة' : 'Fullscreen')}
            >
              {(isFullscreen || isPseudoFullscreen) ? '✕' : '⛶'}
            </button>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className={`min-h-[44px] min-w-[44px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1 transition-all ${isDark ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}><span className="font-black text-[9px] uppercase">{lang === 'en' ? 'AR' : 'EN'}</span></button>
            {!isHome && activeScreen !== 'no-access' && (
              <button 
                onClick={() => setActiveScreen(dashboardId)} 
                className="hidden sm:flex bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-1 border border-rose-500"              >
                <span>{isAr ? 'إغلاق' : 'CLOSE'}</span>
                <span className="text-xs">✕</span>
              </button>
            )}
          </div>
          {themeIslandOpen && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[60] pointer-events-none px-3 w-max max-w-[calc(100vw-24px)]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#001F3F] dark:bg-white text-white dark:text-[#001F3F] shadow-2xl border border-[#C2A37866] animate-in fade-in zoom-in-95 duration-300">
                <span className="text-sm animate-spin">{isDark ? '☀️' : '🌙'}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{isDark ? (isAr ? 'الوضع الداكن' : 'DARK MODE') : (isAr ? 'الوضع الفاتح' : 'LIGHT MODE')}</span>
              </div>
            </div>
          )}
        </header>

        <div className="p-4 lg:p-6 flex-1">
          {children}
          
          <div className="mt-16 mb-8 flex flex-col items-center gap-3 opacity-30 hover:opacity-100 transition-opacity duration-700 pointer-events-none no-print text-center">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C2A378] to-transparent"></div>
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[0.5em] ${textSecondary} mb-1`}>
                 POWERED BY BEBITO
              </p>
              <p className={`text-[9px] font-black italic tracking-widest ${textSecondary}`}>
                Mohamed A-Alawy <span className="opacity-30 px-2">|</span> +20 114 647 5759
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE NAV: primary Genset screens */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t px-1.5 pt-1.5 z-40 grid grid-cols-5 gap-1 items-center transition-all ${isDark ? 'bg-[#001224] border-white/5' : 'bg-[var(--rail-bg)] border-[var(--border-primary)]'} backdrop-blur-xl pb-[calc(0.4rem+env(safe-area-inset-bottom))] no-print`}>
        {[
          { id: dashboardId, label: isAr ? 'الرئيسية' : 'DASHBOARD', icon: '📊' },
          { id: 'port-gate', label: isAr ? 'البوابة' : 'GATE', icon: '🚧' },
          { id: 'master-view', label: isAr ? 'الرئيسية الموحدة' : 'MASTER', icon: '📑' },
          { id: 'financials', label: isAr ? 'المالية' : 'FINANCE', icon: '💰' },
        ].map(item => {
          const available = item.id === dashboardId || menu.some(m => m.id === item.id);
          const active = activeScreen === item.id;
          return (
            <button
              key={item.id}
              disabled={!available}
              onClick={() => {
                if (item.id === 'port-gate') handlePortGateTabClick(activePortGateTab);
                else setActiveScreen(item.id);
              }}
              className={`min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${active ? 'bg-[#C2A378] text-[#001F3F]' : available ? (isDark ? 'text-[#C2A378cc] hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100') : 'opacity-25 cursor-not-allowed'}`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="max-w-full truncate text-[7.5px] font-black uppercase tracking-[.06em]">{item.label}</span>
            </button>
          );
        })}
        <button onClick={() => setActiveScreen('customer-prices')} className={`min-w-0 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${activeScreen === 'customer-prices' ? 'bg-[#C2A378] text-[#26231f]' : isDark ? 'text-[#C2A378cc] hover:bg-white/5' : 'text-[#5f5a52] hover:bg-[#e4dfd6]'}`}>
          <span className="text-base leading-none">💰</span>
          <span className="text-[6.5px] font-black uppercase tracking-[.08em]">{isAr ? 'الأسعار' : 'RATE MATRIX'}</span>
        </button>
      </nav>
    </div>
  );
};

export default React.memo(Layout);