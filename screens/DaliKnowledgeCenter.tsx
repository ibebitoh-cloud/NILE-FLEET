import React, { useContext, useEffect, useMemo, useState } from 'react';
import { LanguageContext } from '../App';
import { User, UserRole } from '../types';
import { db } from '../services/supabaseDb';
import { getDaliKnowledge, teachDaliKnowledge } from '../services/daliKnowledge';
import type { DaliKnowledge } from '../services/daliKnowledge';
import { getDaliCustomerAliases, saveDaliCustomerAlias, deleteDaliCustomerAlias } from '../services/daliCustomerAliases';
import type { DaliCustomerAlias } from '../services/daliCustomerAliases';

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

  const load = async () => {
    setLoading(true);
    try {
      const [knowledge, dictionary] = await Promise.all([
        getDaliKnowledge(),
        getDaliCustomerAliases()
      ]);
      setItems(knowledge);
      setAliases(dictionary);
      setCustomers(db.getUsers().filter((u: User) => String(u.role).toUpperCase() === UserRole.CUSTOMER));
      if (!selectedCustomerId && customers.length) setSelectedCustomerId(customers[0].id);
    } catch (e) {
      setNotice(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveLesson = async () => {
    if (!title.trim() || !content.trim()) return;
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
    if (!selectedCustomerId || !aliasInput.trim()) return;
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
          <div className="flex gap-3">
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
          <button disabled={saving || !title.trim() || !content.trim()} onClick={saveLesson} className="w-full py-3 rounded-xl bg-[#C2A378] text-[#001F3F] font-black uppercase text-xs disabled:opacity-40">
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
                      <button type="button" onClick={() => removeAlias(a.id)} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
              {!selectedAliases.length && <div className="text-[10px] opacity-50 mt-2">{ar ? 'لا توجد أسماء بديلة بعد.' : 'No aliases trained yet.'}</div>}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={aliasInput} onChange={e => setAliasInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAlias(); }} placeholder={ar ? 'مثال: نوتك' : 'Example: نوتك'} className="rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
            <select value={aliasType} onChange={e => setAliasType(e.target.value as DaliCustomerAlias['alias_type'])} className="rounded-xl border px-2 text-xs bg-[var(--input-bg)]">
              <option value="arabic">{ar ? 'عربي' : 'Arabic'}</option>
              <option value="nickname">{ar ? 'مختصر' : 'Nickname'}</option>
              <option value="typo">{ar ? 'خطأ شائع' : 'Common typo'}</option>
              <option value="manual">{ar ? 'بديل' : 'Manual'}</option>
            </select>
          </div>
          <button disabled={aliasSaving || !selectedCustomerId || !aliasInput.trim()} onClick={saveAlias} className="w-full mt-2 py-3 rounded-xl border border-[#C2A37866] text-[#C2A378] font-black uppercase text-xs disabled:opacity-40">
            {aliasSaving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'إضافة الاسم لدالي' : 'ADD ALIAS TO DALI')}
          </button>
          <div className="mt-4 text-[9px] opacity-50">
            {activeAliasCustomers.size} {ar ? 'عملاء لديهم أسماء بديلة محفوظة' : 'customers have trained aliases'}
          </div>
        </section>
      </div>

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
