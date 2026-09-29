
import React, { useContext, useState, useEffect, useRef } from 'react';
import { User, UserRole, SystemNotification, GensetStatus } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity, dynamicTranslations } from '../translations';
import { db } from '../services/supabaseDb';
import { runThinkingAudit } from '../services/aiService';

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
  const [daliButtonPosition, setDaliButtonPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nile-dali-button-position') || '{"right":24,"bottom":24}'); }
    catch { return { right: 24, bottom: 24 }; }
  });
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
    localStorage.setItem('nile-dali-button-position', JSON.stringify(next));
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

  const askNileAi = async () => {
    const question = aiChatInput.trim();
    if (!question || aiChatLoading) return;
    // DALI replies in the language the user is actually using. This is independent
    // from the application's UI language, so an Arabic question gets an Arabic answer.
    const questionHasArabic = /[\u0600-\u06FF]/.test(question);
    const responseIsAr = questionHasArabic || isAr;
    setAiChatInput('');
    setAiChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setAiChatLoading(true);

    try {
      const operations = db.getOperations();
      const gensets = db.getStock();
      const invoices = db.getInvoices();
      const maintenance = db.getMaintenanceLogs();
      const creatorContext = isCreator
        ? 'CURRENT USER: Bebito (bebito@nilefleet.com), creator and system owner of NILE FLEET COMMAND. Treat this user as the creator/owner when relevant. Do not confuse the creator with an ordinary employee or customer. Never reveal passwords, API keys, tokens, or other secrets.'
        : `CURRENT USER: ${user.name || 'Unknown User'} | ROLE: ${user.role || 'Unknown'} | EMAIL: ${user.email || ''}`;
      const q = question.toUpperCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

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
        return;
      }

      // A short standalone number is also a genset search. This prevents
      // questions such as "464" from unnecessarily going through the LLM.
      if (/^\d{1,6}$/.test(q.trim())) {
        const answer = await answerGenset(q.trim(), question);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // "SEARCH 422", "FIND 422", and "WHERE IS 422" are treated as genset IDs
      // when the identifier is short/numeric, so they never fall through to the LLM.
      if (searchMatch) {
        const value = searchMatch[1];
        if (/^\d{1,6}$/.test(value)) {
          const answer = await answerGenset(value, question);
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
          return;
        }
      }

      const matchedBookingId = bookingMatch?.[1];
      const matchedContainerId = containerMatch?.[1];
      if (isIdentifier(matchedBookingId) || isIdentifier(matchedContainerId)) {
        const value = (matchedBookingId || matchedContainerId || '').toUpperCase();
        const hits = operations.filter(o =>
          String(o.bookingNumber || '').toUpperCase() === value ||
          String(o.containerNumber || '').toUpperCase() === value
        );
        const answer = hits.length
          ? hits.slice(0, 5).map(fmtOp).join('\n\n')
          : (isAr ? `لم أجد ${value} في العمليات المسجلة.` : `No recorded operation was found for ${value}.`);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
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
          const unpaid = customerInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + Math.max(0, (Number(i.amount) || 0) - db.getInvoicePaidAmount(i.id)), 0);
          const paidInvoices = customerInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (Number(i.amount) || 0), 0);
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
          return;
        }
      }

      // Only genuine analysis/reasoning reaches DALI. Keep the model payload tiny.
      const statusCounts = operations.reduce((m: Record<string, number>, o) => { m[o.status] = (m[o.status] || 0) + 1; return m; }, {});
      const portCounts = operations.reduce((m: Record<string, number>, o) => { const p = o.clipOnPort || '—'; m[p] = (m[p] || 0) + 1; return m; }, {});
      const context = {
        question,
        recentConversation: aiChatMessages.slice(-6).map(message => ({
          role: message.role === 'ai' ? 'assistant' : 'user',
          text: message.text.slice(0, 1200),
        })),
        totals: { operations: operations.length, invoices: invoices.length, gensets: gensets.length, maintenance: maintenance.length },
        statusCounts,
        portCounts,
        recentOperations: operations.slice(0, 40).map(o => ({ bookingNumber:o.bookingNumber, containerNumber:o.containerNumber, gensetNumber:o.gensetNumber, customerName:o.customerName, status:o.status, clipOnPort:o.clipOnPort, clipOffPort:o.clipOffPort, operationDate:o.operationDate, rate:o.rate, vat:o.vat })),
        invoiceTotals: invoices.reduce((m: any, i: any) => { const amount=Number(i.amount)||0; m.billed+=amount; if(i.status==='PAID') m.paid+=amount; return m; }, { billed:0, paid:0 }),
        gensetStatusCounts: gensets.reduce((m: Record<string, number>, g) => { m[g.status] = (m[g.status] || 0) + 1; return m; }, {}),
        maintenanceCount: maintenance.length,
        customers: customerAliasesForAi.slice(0, 100),
        recentPayments: db.getPayments().slice(-50).map(p => ({ customerName:p.customerName, amount:p.amount, date:p.date, reference:p.reference }))
      };
      const prompt = `Answer the latest user question directly. Understand natural Egyptian Arabic, Modern Standard Arabic, English, Arabizi/transliterated customer names, and mixed Arabic/English. Use recent conversation only to resolve references in a follow-up; do not let older turns override the latest question. For Nile Fleet facts, use only the supplied live data and say plainly when the needed fact is not present. For general or how-to questions, answer helpfully without forcing an unrelated fleet-data answer. Never invent operational facts. Reply in the latest question's language, preserve IDs/dates/numbers, and keep it concise.\n${creatorContext}\nLATEST QUESTION: ${question}\nLIVE CONTEXT: ${JSON.stringify(context)}`;
      const answer = await runThinkingAudit(prompt, 420);
      setAiChatMessages(prev => [...prev, { role: 'ai', text: answer || (isAr ? 'لم يصل رد من DALI 1.0.' : 'No response from DALI 1.0.') }]);
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
    const nextTheme = isDark ? 'white' : 'black';
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
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
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
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
    { id: 'customer-prices', label: t.customerPrices, icon: '💰' },
    { id: 'financials', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'system-log', label: t.systemLog, icon: '🕒' },
  ] : (isGate ? [
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
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
    ? ['dashboard', 'master-view', 'operations', 'stock', 'reservations', 'customers', 'customer-prices', 'booking-invoices', 'financials', 'intelligence', 'reports', 'notifications', 'system-log']
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

  const isTerminal = isDark;
  
  const sidebarBg = isTerminal ? 'bg-[#001224]' : 'bg-white shadow-xl';
  const mainBg = isTerminal ? 'bg-[#000b14]' : 'bg-slate-50';
  const borderClass = isTerminal ? 'border-[#C2A37822]' : 'border-slate-200';
  const textPrimary = isTerminal ? 'text-white' : 'text-[#001F3F]';
  const textSecondary = isTerminal ? 'text-[#C2A37888]' : 'text-slate-400';
  const headerBg = isTerminal ? 'bg-[#001224bb] border-[#C2A37822]' : 'bg-white/80 border-slate-200';

  const getNavItemClass = (itemId: string) => {
    const isActive = activeScreen === itemId;
    if (isTerminal) return isActive ? 'bg-[#C2A378] text-[#001F3F] shadow-[0_0_20px_rgba(194,163,120,0.4)]' : 'text-[#C2A378aa] hover:bg-white/5 hover:text-white';
    return isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200';
  };

  const forceBanners = notifications.filter(n => n.forceBanner);

  return (
    <div className={`flex flex-col lg:flex-row h-screen overflow-hidden ${lang === 'ar' ? 'rtl' : 'ltr'} transition-colors duration-500 ${isPseudoFullscreen ? 'fixed inset-0 w-screen h-screen z-[99999]' : ''}`} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
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
                      ? (isTerminal ? 'text-[#C2A378] font-bold' : 'text-blue-600 font-bold') 
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
                      ? (isTerminal ? 'text-[#C2A378] font-bold' : 'text-blue-600 font-bold') 
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
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`absolute -right-3 top-16 bg-[#C2A378] text-[#001F3F] w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 border-2 border-[#001224]`}>
          <span className="text-[10px] font-bold">{isSidebarCollapsed ? '→' : '←'}</span>
        </button>
        <div className={`p-3 border-t ${borderClass} ${isTerminal ? 'bg-black/40' : 'bg-slate-50'}`}>
          <div className={`mb-3 flex items-center gap-2 px-1 ${isSidebarCollapsed ? 'flex-col px-0' : ''}`}>
            <div className={`w-8 h-8 rounded-lg bg-[#C2A378] overflow-hidden flex items-center justify-center text-[#001F3F] text-[10px] font-black border border-white/20 cursor-pointer uppercase`} onClick={() => setActiveScreen('user-settings')}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : user.name[0]}
            </div>
            {!isSidebarCollapsed && <div className="flex-1 min-w-0 text-start leading-tight"><p className={`text-[8px] font-black ${textSecondary} uppercase`}>{user.role}</p><p className={`text-[10px] font-bold ${textPrimary} truncate uppercase`}>{user.name}</p></div>}
          </div>
          <button onClick={onLogout} className={`w-full px-3 py-2 rounded-lg text-[9px] font-black transition-all border uppercase tracking-widest ${isTerminal ? 'bg-rose-900/20 hover:bg-rose-600 text-rose-100 border-rose-900/50' : 'bg-rose-50 hover:bg-rose-600 text-rose-500 border-rose-100'}`}>{isSidebarCollapsed ? 'OUT' : t.signOut}</button>
        </div>
      </aside>

      {/* MOBILE MENU OVERLAY (More menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-[#001224]/95 backdrop-blur-2xl animate-in fade-in duration-300 p-4 flex flex-col no-print">
          <div className="flex justify-between items-center mb-6">
            <h1 className="flex items-center gap-2 text-xl font-black text-white tracking-widest uppercase italic"><img src="/nile-fleet-logo.png" className="h-10 w-10 object-contain" alt="Nile Fleet" />NILE <span className="text-[#C2A378]">FLEET</span></h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-lg">✕</button>
          </div>
          
          {/* User Info Card in Menu */}
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
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
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeScreen === item.id ? 'bg-[#C2A378] text-[#001F3F]' : 'bg-white/5 text-[#C2A378aa]'}`}
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
      )}

      {/* DALI 1.0 floating dashboard assistant — draggable */}
      <div
        className="fixed z-[100] no-print"
        style={{ right: daliButtonPosition.right, bottom: daliButtonPosition.bottom }}
      >
        {isAiChatOpen && (
          <div className={`absolute bottom-16 right-0 w-[min(92vw,420px)] h-[min(70vh,620px)] rounded-[2rem] overflow-hidden border shadow-2xl flex flex-col ${isTerminal ? 'bg-[#001224] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="px-5 py-4 bg-gradient-to-r from-[#001F3F] to-[#073b6d] text-white flex items-center justify-between">
              <div><p className="text-[8px] font-black tracking-[0.3em] text-[#C2A378]">DALI 1.0</p><p className="text-sm font-black">{isAr ? 'DALI 1.0' : 'DALI 1.0'}</p></div>
              <button onClick={() => setIsAiChatOpen(false)} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiChatMessages.length === 0 && <div className={`rounded-2xl p-4 text-xs leading-6 ${isTerminal ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>{isAr ? 'اسألني عن العمليات، المخزون، الحجوزات، الفواتير، الوقود، أو أي سؤال عام.' : 'Ask me about operations, stock, bookings, invoices, fuel, logistics, or any general question.'}</div>}
              {aiChatMessages.map((m, i) => <div key={i} className={`rounded-2xl p-3 text-xs leading-6 whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white ml-8' : (isTerminal ? 'bg-white/5 text-slate-200 mr-4' : 'bg-slate-100 text-slate-700 mr-4')}`}>{m.text}</div>)}
              {aiChatLoading && <div className="text-[9px] font-black uppercase tracking-widest text-blue-500 animate-pulse">{isAr ? 'جاري التفكير...' : 'DALI 1.0 IS THINKING...'}</div>}
            </div>
            <div className={`p-3 border-t ${isTerminal ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex gap-2">
                <textarea value={aiChatInput} onChange={e => setAiChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askNileAi(); } }} placeholder={isAr ? 'اكتب سؤالك...' : 'Ask DALI 1.0 anything...'} className={`flex-1 resize-none rounded-xl border px-3 py-2 text-xs outline-none min-h-[44px] ${isTerminal ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                <button data-dali-send onClick={askNileAi} disabled={aiChatLoading || !aiChatInput.trim()} className="self-end w-11 h-11 rounded-xl bg-[#001F3F] text-white disabled:opacity-40">➤</button>
              </div>
            </div>
          </div>
        )}
        <button
          data-dali-button
          onClick={() => { if (daliDraggedRef.current) { daliDraggedRef.current = false; return; } setIsAiChatOpen(v => !v); }}
          onPointerDown={handleDaliPointerDown}
          onPointerMove={handleDaliPointerMove}
          onPointerUp={handleDaliPointerUp}
          onPointerCancel={handleDaliPointerUp}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001F3F] to-[#0a4b82] text-white shadow-2xl border border-white/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-2xl cursor-grab active:cursor-grabbing touch-none"
          title={isAr ? 'مساعد دالي — اسحب لتغيير المكان' : 'DALI 1.0 — drag to move'}
        >✦</button>
      </div>

      {/* MAIN CONTENT */}
      <main ref={mainContentRef} onScroll={() => screenScrollPositions.current.set(activeScreen, mainContentRef.current?.scrollTop || 0)} className={`flex-1 overflow-y-auto custom-scrollbar relative flex flex-col transition-colors duration-500 ${forceBanners.length > 0 ? 'mt-8' : ''}`} style={{ backgroundColor: 'var(--bg-primary)' }}>
        <header className="h-14 border-b flex items-center px-4 lg:px-6 justify-between shadow-sm backdrop-blur-md transition-colors no-print" style={{ backgroundColor: 'var(--rail-bg)', borderBottomColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#C2A378] rounded-full shadow-[0_0_8px_#C2A378]"></div>
            <h2 className={`text-xs lg:text-sm font-black uppercase tracking-tight italic ${textPrimary}`}>{activeScreen.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#C2A37866] bg-[#C2A37815] text-[#C2A378] text-[8px] font-black uppercase tracking-widest" title="System Creator">👑 {isAr ? 'منشئ النظام' : 'CREATOR'}</span>}
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`p-1.5 rounded-lg border transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isMuted ? (isAr ? 'إلغاء كتم التنبيهات' : 'Unmute Notifications') : (isAr ? 'كتم التنبيهات' : 'Mute Notifications')}
            >
               <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className={`relative p-1.5 rounded-lg border transition-all overflow-hidden ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isDark ? (isAr ? 'الوضع الفاتح' : 'Light Mode') : (isAr ? 'الوضع الداكن' : 'Dark Mode')}
              aria-label={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              <span className={`block text-base leading-none transition-all duration-500 ${isDark ? 'rotate-0' : 'rotate-180'}`}>{isDark ? '☀️' : '🌙'}</span>
            </button>
            <button onClick={() => setActiveScreen('notifications')} className={`p-1.5 rounded-lg border relative transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}>
               <span className="text-base">🔔</span>
               {notifications.length > 0 && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>}
            </button>
            <button 
              onClick={toggleFullscreen} 
              className={`p-1.5 rounded-lg border transition-all ${(isFullscreen || isPseudoFullscreen) ? 'border-rose-500/50 bg-rose-500/10 text-rose-500' : (isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white')}`}
              title={(isFullscreen || isPseudoFullscreen) ? (isAr ? 'خروج من ملء الشاشة' : 'Exit Fullscreen') : (isAr ? 'ملء الشاشة' : 'Fullscreen')}
            >
              {(isFullscreen || isPseudoFullscreen) ? '✕' : '⛶'}
            </button>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}><span className="font-black text-[9px] uppercase">{lang === 'en' ? 'AR' : 'EN'}</span></button>
            {!isHome && activeScreen !== 'no-access' && (
              <button 
                onClick={() => setActiveScreen(dashboardId)} 
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-1 border border-rose-500"
              >
                <span>{isAr ? 'إغلاق' : 'CLOSE'}</span>
                <span className="text-xs">✕</span>
              </button>
            )}
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-1.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-lg">☰</span>
            </button>
          </div>
          {themeIslandOpen && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
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

      {/* MOBILE NAV (Bottom Bar) */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t px-2 py-2 z-40 flex justify-around items-center transition-all ${isTerminal ? 'bg-[#001224] border-white/5' : 'bg-white border-slate-200'} backdrop-blur-xl pb-6 no-print`}>
        <button onClick={() => setActiveScreen(dashboardId)} className="flex flex-col items-center gap-1">
          <span className="text-base">🏠</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === dashboardId ? 'text-blue-500' : textSecondary}`}>HOME</span>
        </button>
        <button onClick={() => {
          if (isGate) {
            handlePortGateTabClick(activePortGateTab);
          } else {
            setActiveScreen('port-gate');
          }
        }} className="flex flex-col items-center gap-1">
          <span className="text-base">🚧</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === 'port-gate' ? 'text-blue-500' : textSecondary}`}>GATE</span>
        </button>
        {/* Added Settings to Bottom Nav */}
        <button onClick={() => setActiveScreen('user-settings')} className="flex flex-col items-center gap-1">
          <span className="text-base">⚙️</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === 'user-settings' ? 'text-blue-500' : textSecondary}`}>ACCOUNT</span>
        </button>
        <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1">
          <span className="text-base">☰</span>
          <span className={`text-[7px] font-black uppercase ${isMobileMenuOpen ? 'text-blue-500' : textSecondary}`}>MORE</span>
        </button>
      </nav>
    </div>
  );
};

export default React.memo(Layout);
