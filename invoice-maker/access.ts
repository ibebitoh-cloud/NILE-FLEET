// Only these accounts can open the Invoice Maker screen (user decision, 2026-11-04).
// Keep in step with INVOICE_MAKER_EMAILS in functions/ai-proxy.js.
export const INVOICE_MAKER_EMAILS = ['bebito@nilefleet.com', 'doniasoltan@nilefleet.com'];

export const canUseInvoiceMaker = (email?: string | null): boolean =>
  INVOICE_MAKER_EMAILS.includes(String(email || '').trim().toLowerCase());
