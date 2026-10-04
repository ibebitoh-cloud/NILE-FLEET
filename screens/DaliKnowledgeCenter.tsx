import React, { useContext, useEffect, useMemo, useState } from 'react';
import { LanguageContext } from '../App';
import { User, UserRole } from '../types';
import { db } from '../services/supabaseDb';
import { getDaliKnowledge, teachDaliKnowledge, canEditDaliTraining } from '../services/daliKnowledge';
import type { DaliKnowledge } from '../services/daliKnowledge';
import { getDaliCustomerAliases, saveDaliCustomerAlias, deleteDaliCustomerAlias } from '../services/daliCustomerAliases';
import type { DaliCustomerAlias } from '../services/daliCustomerAliases';
import { getTerminology, learnTerminology, matchTerminology, scanSystemTerminology } from '../services/daliTerminology';
import type { TerminologyRecord } from '../services/daliTerminology';

const C = [
  ['company_rule', 'Company Rules'],
  ['terminology', 'Terminology'],
  ['workflow', 'Workflows'],
  ['port_rule', 'Port Rules'],
  ['genset_rule', 'Genset Rules'],
  ['invoice_rule', 'Invoice Rules'],
  ['customer_rule', 'Customer Rules'],
  ['faq', 'FAQ'],
  ['correction', 'Corrections'],
  ['example', 'Examples']
];

const DaliKnowledgeCenter: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const ar = lang === 'ar';

  const [items, setItems] = useState<DaliKnowledge[]>([]);
  const [aliases, setAliases] = useState<DaliCustomerAlias[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEditTraining, setCanEditTraining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aliasSaving, setAliasSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [category, setCategory] = useState('company_rule');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliasType, setAliasType] = useState<DaliCustomerAlias['alias_type']>('arabic');
  const [notice, setNotice] = useState('');
  const [terminology, setTerminology] = useState<TerminologyRecord[]>([]);
  const [termInput, setTermInput] = useState('');
  const [termCanonical, setTermCanonical] = useState('');
  const [termType, setTermType] = useState('entity');
  const [termDebug, setTermDebug] = useState('');
  const [termLoading, setTermLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [knowledge, dictionary, editable] = await Promise.all([
        getDaliKnowledge(),
        getDaliCustomerAliases(),
        canEditDaliTraining()
      ]);
      setCanEditTraining(editable);
      setItems(knowledge);
      setAliases(dictionary);
      const customerRows = db.getUsers().filter((u: User) => String(u.role).toUpperCase() === UserRole.CUSTOMER);
      setCustomers(customerRows);
      if (!selectedCustomerId && customerRows.length) setSelectedCustomerId(customerRows[0].id);
    } catch (e) {
      setNotice(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getTerminology().then(setTerminology).catch(() => {});
  }, []);

  const saveLesson = async () => {
    if (!canEditTraining || !title.trim() || !content.trim()) return;
    setSaving(true);
    setNotice('');
    try {
      await teachDaliKnowledge({
        category,
        title,
        content,
        keywords: [
          ...keywords.split(',').map(x => x.trim()).filter(Boolean),
          ...(arabicName.trim() ? [arabicName.trim()] : [])
        ]
      });
      setTitle('');
      setContent('');
      setArabicName('');
      setKeywords('');
      setNotice(ar ? 'تم تعليم دالي وحفظ القاعدة.' : 'DALI learned it and saved the rule.');
      await load();
    } catch (e) {
      setNotice(String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAlias = async () => {
    if (!canEditTraining || !selectedCustomerId || !aliasInput.trim()) return;
    setAliasSaving(true);
    setNotice('');
    try {
      await saveDaliCustomerAlias({
        customerId: selectedCustomerId,
        alias: aliasInput,
        aliasType
      });
      setAliasInput('');
      setNotice(ar ? 'تم حفظ اسم العميل كاسم بديل لدالي.' : 'Customer alias saved to DALI.');
      const dictionary = await getDaliCustomerAliases();
      setAliases(dictionary);
    } catch (e) {
      setNotice(String(e));
    } finally {
      setAliasSaving(false);
    }
  };

  const removeAlias = async (id: string) => {
    if (!canEditTraining) return;
    setNotice('');
    try {
      await deleteDaliCustomerAlias(id);
      setAliases(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setNotice(String(e));
    }
  };

  const filteredLessons = items.filter(x =>
    [x.title, x.content, x.category, ...(x.keywords || [])]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      [c.name, c.companyName, c.companyNameAr]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [customers, customerSearch]);

  const trainTerminology = async () => {
    if (!canEditTraining || !termCanonical.trim() || !termInput.trim()) return;
    setTermLoading(true); setNotice('');
    try {
      await learnTerminology({
        canonical_value: termCanonical.trim(),
        canonical_type: termType as any,
        alias: termInput.trim(),
        language: /[\\u0600-\\u06ff]/.test(termInput) ? 'ar' : /[A-Za-z]/.test(termInput) ? 'en' : 'mixed',
        alias_type: 'manual',
        context: [termType],
        confidence: 0.98,
        source: 'Manual Training Node',
        status: 'approved'
      });
      setTermInput('');
      setTerminology(await getTerminology());
      setNotice(ar ? 'تم حفظ المصطلح والاسم البديل.' : 'Terminology alias saved.');
    } catch (e) { setNotice(String(e)); }
    finally { setTermLoading(false); }
  };

  const runTerminologyScan = async () => {
    if (!canEditTraining) return;
    setTermLoading(true); setNotice('');
    try {
      const count = await scanSystemTerminology();
      setTerminology(await getTerminology());
      setNotice(ar ? `تم فحص النظام وتعلم ${count} مصطلحاً.` : `System scan learned ${count} terminology records.`);
    } catch (e) { setNotice(String(e)); }
    finally { setTermLoading(false); }
  };

  const debugTerminology = () => {
    if (!termInput.trim()) return;
    const match = matchTerminology(termInput, terminology);
    setTermDebug(JSON.stringify({
      user_input: termInput,
      normalized_input: termInput ? termInput.normalize('NFKC').toLowerCase() : '',
      detected_terms: match.entities,
      intent: match.intent,
      confidence: match.confidence,
      candidates: match.candidates.slice(0, 8).map(x => ({
        alias: x.alias, canonical_value: x.canonical_value, category: x.canonical_type,
        confidence: x.score, match_type: x.matchType
      }))
    }, null, 2));
  };

  const selectedAliases = aliases.filter(a => a.customer_id === selectedCustomerId);
  const activeAliasCustomers = new Set(aliases.map(a => a.customer_id));
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6 border border-[#C2A37855] bg-gradient-to-br from-[#001F3F] to-[#071522] text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[.35em] text-[#C2A378] uppercase">DALI KNOWLEDGE CENTER</div>
            <h1 className="text-2xl font-black mt-2">{ar ? 'علّم دالي كل شيء' : 'Teach DALI Everything'}</h1>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              {ar
                ? 'قواعد الشركة والمصطلحات وأسماء العملاء البديلة تُحفظ وتُستخدم في المحادثات القادمة.'
                : 'Company rules, terminology and customer aliases are stored persistently and used in future DALI conversations.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className={`px-3 py-2 rounded-xl border text-[8px] font-black uppercase tracking-wider ${canEditTraining ? 'border-emerald-400/30 text-emerald-300 bg-emerald-400/10' : 'border-white/10 text-white/50 bg-white/5'}`}>
              {canEditTraining ? (ar ? 'أنت منشئ التدريب' : 'TRAINING CREATOR') : (ar ? 'عرض فقط' : 'READ ONLY')}
            </div>
            <div className="text-center px-5 py-3 rounded-2xl bg-white/10 border border-white/10">
              <div className="text-2xl font-black">{items.length}</div>
              <div className="text-[8px] uppercase tracking-widest text-white/50">ACTIVE LESSONS</div>
            </div>
            <div className="text-center px-5 py-3 rounded-2xl bg-white/10 border border-white/10">
              <div className="text-2xl font-black">{aliases.length}</div>
              <div className="text-[8px] uppercase tracking-widest text-white/50">CUSTOMER ALIASES</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-3xl border p-5 bg-[var(--card-bg)] border-[var(--border-primary)]">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#C2A378] mb-4">{ar ? 'تعليم جديد' : 'Teach DALI'}</div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]">
            {C.map(([value, label]) => <option key={value} value={value}>{ar && value === 'customer_rule' ? 'قواعد العملاء' : label}</option>)}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={ar ? 'عنوان القاعدة' : 'Lesson title'} className="w-full rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={ar ? 'ما الذي يجب أن يعرفه دالي؟' : 'What should DALI know and do?'} className="w-full h-32 rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]" />
          <input value={arabicName} onChange={e => setArabicName(e.target.value)} placeholder={ar ? 'اسم العميل بالعربي (مثال: نوتك)' : 'Customer Arabic name (example: نوتك)'} className="w-full rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]" />
          <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder={ar ? 'كلمات مفتاحية مفصولة بفواصل' : 'Keywords, comma separated'} className="w-full rounded-xl border p-3 text-sm mb-4 bg-[var(--input-bg)]" />
          <button disabled={!canEditTraining || saving || !title.trim() || !content.trim()} onClick={saveLesson} className="w-full py-3 rounded-xl bg-[#C2A378] text-[#001F3F] font-black uppercase text-xs disabled:opacity-40">
            {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'علّم دالي' : 'TEACH DALI')}
          </button>
        </section>

        <section className="rounded-3xl border p-5 bg-[var(--card-bg)] border-[var(--border-primary)]">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#C2A378] mb-4">{ar ? 'قاموس أسماء العملاء' : 'Customer Dictionary'}</div>
          <p className="text-xs opacity-60 mb-4">
            {ar
              ? 'اربط الاسم العربي أو الاسم المختصر أو خطأ الكتابة بالعميل الحقيقي، بدون تغيير اسم العميل في البيانات.'
              : 'Link Arabic names, nicknames or common misspellings to the real customer without changing the original customer name.'}
          </p>
          <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder={ar ? 'ابحث عن عميل...' : 'Search customer...'} className="w-full rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]" />
          <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full rounded-xl border p-3 text-sm mb-3 bg-[var(--input-bg)]">
            <option value="">{ar ? 'اختر العميل' : 'Select customer'}</option>
            {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name}</option>)}
          </select>
          {selectedCustomer && (
            <div className="mb-4 rounded-2xl border p-3 bg-black/[.02]">
              <div className="text-[8px] font-black uppercase tracking-widest opacity-50">CUSTOMER</div>
              <div className="font-black mt-1">{selectedCustomer.companyName || selectedCustomer.name}</div>
              {selectedCustomer.companyNameAr && <div className="text-sm mt-1 text-[#C2A378]">{selectedCustomer.companyNameAr}</div>}
              {selectedAliases.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {selectedAliases.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] border">
                      {a.alias}
                      <button type="button" onClick={() => removeAlias(a.id)} disabled={!canEditTraining} className="opacity-60 hover:opacity-100 disabled:hidden">×</button>
                    </span>
                  ))}
                </div>
              )}
              {!selectedAliases.length && <div className="text-[10px] opacity-50 mt-2">{ar ? 'لا توجد أسماء بديلة بعد.' : 'No aliases trained yet.'}</div>}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={aliasInput} onChange={e => setAliasInput(e.target.value)} disabled={!canEditTraining} onKeyDown={e => { if (e.key === 'Enter') saveAlias(); }} placeholder={ar ? 'مثال: نوتك' : 'Example: نوتك'} className="rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
            <select value={aliasType} onChange={e => setAliasType(e.target.value as DaliCustomerAlias['alias_type'])} disabled={!canEditTraining} className="rounded-xl border px-2 text-xs bg-[var(--input-bg)]">
              <option value="arabic">{ar ? 'عربي' : 'Arabic'}</option>
              <option value="nickname">{ar ? 'مختصر' : 'Nickname'}</option>
              <option value="typo">{ar ? 'خطأ شائع' : 'Common typo'}</option>
              <option value="manual">{ar ? 'بديل' : 'Manual'}</option>
            </select>
          </div>
          <button disabled={!canEditTraining || aliasSaving || !selectedCustomerId || !aliasInput.trim()} onClick={saveAlias} className="w-full mt-2 py-3 rounded-xl border border-[#C2A37866] text-[#C2A378] font-black uppercase text-xs disabled:opacity-40">
            {aliasSaving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'إضافة الاسم لدالي' : 'ADD ALIAS TO DALI')}
          </button>
          <div className="mt-4 text-[9px] opacity-50">
            {activeAliasCustomers.size} {ar ? 'عملاء لديهم أسماء بديلة محفوظة' : 'customers have trained aliases'}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border p-5 bg-[var(--card-bg)] border-[var(--border-primary)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[#C2A378]">{ar ? 'عقدة التدريب اليدوي • قاموس المصطلحات' : 'MANUAL TRAINING NODE • TERMINOLOGY ENGINE'}</div>
            <p className="text-xs opacity-60 mt-1">{ar ? 'يتعلم الأسماء البديلة والأخطاء الشائعة دون تغيير أي بيانات تشغيلية.' : 'Learns aliases, Arabic/English variants and typos without modifying operational data.'}</p>
          </div>
          <button type="button" onClick={runTerminologyScan} disabled={!canEditTraining || termLoading} className="px-4 py-2 rounded-xl border font-black text-[9px] disabled:opacity-40">
            {termLoading ? '…' : (ar ? 'فحص النظام' : 'SCAN SYSTEM')}
          </button>
        </div>
        <div className="grid md:grid-cols-4 gap-2">
          <input value={termCanonical} onChange={e => setTermCanonical(e.target.value)} placeholder={ar ? 'المصطلح الأساسي' : 'Canonical term'} className="rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
          <input value={termInput} onChange={e => setTermInput(e.target.value)} placeholder={ar ? 'الاسم البديل / الخطأ' : 'Alias / typo / Arabic'} className="rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
          <select value={termType} onChange={e => setTermType(e.target.value)} className="rounded-xl border p-3 text-xs bg-[var(--input-bg)]">
            {['entity','field','status','port','customer','shipper','trucker','genset','booking','container','maintenance','invoice','operation','action','intent'].map(x => <option key={x}>{x}</option>)}
          </select>
          <button type="button" onClick={trainTerminology} disabled={!canEditTraining || termLoading || !termCanonical.trim() || !termInput.trim()} className="rounded-xl bg-[#C2A378] text-[#001F3F] font-black text-[9px] disabled:opacity-40">
            {ar ? 'حفظ الاسم البديل' : 'SAVE ALIAS'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 text-[9px]">
          <span className="px-2 py-1 rounded-lg border">{terminology.length} {ar ? 'مصطلح معتمد' : 'approved terms'}</span>
          <span className="px-2 py-1 rounded-lg border">{ar ? 'Exact → Alias → Normalized → Fuzzy' : 'Exact → Alias → Normalized → Fuzzy'}</span>
          <button type="button" onClick={debugTerminology} className="px-2 py-1 rounded-lg border">{ar ? 'تشخيص المطابقة' : 'DEBUG MATCH'}</button>
        </div>
        {termDebug && <pre dir="ltr" className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/90 text-emerald-300 p-3 text-[9px] whitespace-pre-wrap">{termDebug}</pre>}
      </section>

      {notice && <div className="rounded-2xl border border-[#C2A37855] bg-[#C2A37810] text-[#C2A378] p-3 text-xs font-bold">{notice}</div>}

      <section className="rounded-3xl border p-5 bg-[var(--card-bg)] border-[var(--border-primary)]">
        <div className="flex gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? 'ابحث في معرفة دالي...' : 'Search DALI knowledge...'} className="flex-1 rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
          <button onClick={load} className="px-4 rounded-xl border font-black text-xs">↻</button>
        </div>
        {loading ? (
          <div className="p-8 text-center opacity-50">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
        ) : (
          <div className="space-y-3 max-h-[650px] overflow-y-auto">
            {filteredLessons.map(x => (
              <article key={x.id} className="rounded-2xl border p-4 bg-black/[.02]">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#C2A378]">{x.category.replace('_', ' ')}</div>
                <h3 className="font-black mt-1">{x.title}</h3>
                <p className="text-sm opacity-70 mt-2 whitespace-pre-wrap">{x.content}</p>
                {x.keywords.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{x.keywords.map(k => <span key={k} className="px-2 py-1 rounded-lg text-[8px] border opacity-60">{k}</span>)}</div>}
              </article>
            ))}
            {!filteredLessons.length && <div className="p-8 text-center opacity-50">{ar ? 'لا توجد نتائج.' : 'No results.'}</div>}
          </div>
        )}
      </section>
    </div>
  );
};

export default DaliKnowledgeCenter;
