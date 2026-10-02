import assert from 'node:assert/strict';
import fs from 'node:fs';

const arabicSamples = [
  'العملاء',
  'الشاحنات',
  'المولدات',
  'التشغيل',
  'الصيانة',
  'المخزون',
  'ميناء بورسعيد',
  'ميناء السخنة',
  'ميناء الإسكندرية',
  'ميناء دمياط',
  'ميناء الدخيلة',
];

const mixedSamples = [
  'المولد G-102',
  'حجز NF-2026-001',
  'بورسعيد - Genset 125',
  'العميل شركة Nile Fleet - 1250 EGP',
];

const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

for (const value of [...arabicSamples, ...mixedSamples]) {
  assert.match(value, arabicPattern, `Expected Arabic content in: ${value}`);
}

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

assert.match(indexHtml, /Noto Sans Arabic/);
assert.match(indexHtml, /Tajawal/);
assert.match(indexHtml, /letter-spacing:\s*normal\s*!important/);
assert.match(indexHtml, /font-feature-settings:\s*"rlig" 1/);
assert.match(app, /nf-arabic-text/);
assert.match(app, /setAttribute\('dir', hasLatin \? 'auto' : 'rtl'\)/);
assert.doesNotMatch(indexHtml, /letter-spacing:\s*-[^;]+/i);

console.log('Arabic typography examples: PASS');
for (const value of arabicSamples) console.log(`  ✓ ${value}`);
for (const value of mixedSamples) console.log(`  ✓ ${value}`);
