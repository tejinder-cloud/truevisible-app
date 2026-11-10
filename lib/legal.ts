// Legal documents (plan Day 32). Drafted by Claude for the Architect's approval (decision 10 Nov: Architect approves,
// no lawyer). Business details come from env so nothing is hard-coded; a missing detail shows as [to be added].
// A document shows a "Draft — not yet in force" banner until LEGAL_APPROVED_VERSION equals LEGAL_VERSION.

export const LEGAL_VERSION = "2026-11-10";
export const DOCS = ["terms", "privacy", "refunds", "contact"] as const;
export type DocId = (typeof DOCS)[number];
export const TITLE: Record<DocId, string> = { terms: "Terms of Service", privacy: "Privacy Notice", refunds: "Cancellation and Refunds", contact: "Contact Us" };

export function legalFacts(env: Record<string, string | undefined> = process.env) {
  const v = (k: string, d?: string) => env[k]?.trim() || d || "[to be added]";
  return {
    name: v("LEGAL_NAME", "Falkan Media"), entity: v("LEGAL_ENTITY"), trading: v("LEGAL_TRADING_AS", "The Growth Lab"), address: v("LEGAL_ADDRESS"),
    gstin: v("LEGAL_GSTIN"), email: v("LEGAL_EMAIL"), phone: v("LEGAL_PHONE"), officer: v("GRIEVANCE_OFFICER"), officerEmail: v("GRIEVANCE_EMAIL"),
    courts: v("LEGAL_COURTS", "Sahibzada Ajit Singh Nagar (Mohali), Punjab"),
  };
}
export const isApproved = (env: Record<string, string | undefined> = process.env) => env.LEGAL_APPROVED_VERSION?.trim() === LEGAL_VERSION;
export const missingFacts = (f: ReturnType<typeof legalFacts>) => Object.entries(f).filter(([, x]) => x === "[to be added]").map(([k]) => k);

const fill = (t: string, f: ReturnType<typeof legalFacts>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (f as any)[k] ?? `{{${k}}}`);
export function legalText(doc: DocId, env: Record<string, string | undefined> = process.env): string { return fill(TEXT[doc], legalFacts(env)); }

const TEXT: Record<DocId, string> = {
terms: `## 1. Who we are
TrueVisible is provided by {{name}}, {{entity}}, trading as {{trading}}, of {{address}} (GSTIN {{gstin}}) — "we", "us". These terms are an agreement between us and the business that signs up ("you").

## 2. What TrueVisible does
TrueVisible asks AI assistants (such as ChatGPT, Gemini and Perplexity) the questions your buyers ask, records what they answer and which websites they cite, and shows you where you are named, who is named instead, and what you can do about it.
- The answers come from third-party AI services we do not control. They change over time and can be wrong.
- **We do not guarantee that any AI assistant will name, cite or recommend you**, on any plan.
- Every figure we show is counted from answers we stored; where we have none we show "—".

## 3. Your account
- You must be at least 18 and able to act for the business you sign up.
- Keep your sign-in email secure. You are responsible for what happens in your workspace.
- The details you give us (brand, website, competitors, questions) must be accurate and yours to use.

## 4. Trial
The free trial runs for 7 days from your first verified AI check, on up to 10 questions. No card is needed. When it ends, checks pause and your dashboard stays readable.

## 5. Plans, prices and payment
- Plans and prices are shown on our website and at checkout, in Indian rupees plus GST for customers in India, or in US dollars for customers outside India.
- Paid plans renew automatically each month or year until cancelled. Payments are processed by Razorpay; we do not see or store your card details.
- We issue a GST tax invoice for every payment. If you give us your GSTIN, it appears on the invoice.
- If a renewal fails we may pause checks until payment succeeds.
- We may change prices for future periods with at least 30 days' notice by email.

## 6. Managed AEO
Managed and Managed Plus include work our team does for you (pages, listings, outreach, Google Business Profile). That work is governed by a separate Managed AEO agreement, which sets the scope, the 90-day minimum term and the fees. Where it differs from these terms, the Managed AEO agreement wins.

## 7. Connecting your tools
- **WordPress:** if you connect it, you give us a token from the Easy MCP AI plugin. We use it only to draft and publish changes you approve, and we never delete content. You can revoke it at any time in the plugin.
- **Google Analytics 4:** read-only access to daily visit counts by source. You can disconnect at any time.

## 8. Acceptable use
Do not use TrueVisible to break the law, to harm others, to misrepresent your business, to overload or reverse-engineer the service, or to resell it without our written agreement.

## 9. Your data and ours
- You own your business information and the content you give us. You give us permission to use it to provide TrueVisible to you.
- We own TrueVisible, its software and its methods. Drafts and recommendations we create for you are yours to use on your own channels.
- How we handle personal data is described in our Privacy Notice.

## 10. Confidentiality
We keep your non-public business information confidential and use it only to provide the service. We may use anonymised, aggregated figures (never your name or your data) to improve TrueVisible.

## 11. Cancelling and ending
- You can cancel a paid plan at any time in Settings; it stays active until the end of the period you have paid for. See Cancellation and Refunds.
- We may suspend or close an account that breaks these terms, after telling you why where we reasonably can.
- When an account closes, we delete your data as described in the Privacy Notice, except where the law requires us to keep it (for example invoices).

## 12. Liability
- TrueVisible is provided "as is". We take reasonable care, but we do not promise it will be uninterrupted or error-free, or that AI answers are accurate.
- We are not liable for indirect or consequential losses, such as lost profits or lost business.
- Our total liability for any claim is limited to the fees you paid us in the 3 months before the claim.
- Nothing in these terms limits liability that cannot be limited by law.

## 13. Changes to these terms
We may update these terms. We will email you at least 15 days before a change that affects you materially; continuing to use TrueVisible after that means you accept it.

## 14. Law and disputes
These terms are governed by the laws of India. The courts at {{courts}} have exclusive jurisdiction.

## 15. Contact
{{name}}, {{address}} · {{email}} · {{phone}}`,

privacy: `## 1. Who is responsible
{{name}}, {{entity}}, trading as {{trading}}, of {{address}}, is the Data Fiduciary for personal data processed through TrueVisible, under India's Digital Personal Data Protection Act, 2023 ("DPDP Act").

## 2. What personal data we collect
- **Account:** your email address, and your name if you give it.
- **Usage:** when you last opened the dashboard and the email choices you make.
- **Business details you enter:** brand, website, competitors, questions, notes. These are mostly about your business, not about people.
- **Payments:** your business name and GSTIN if you give them, and Razorpay payment references. Card and bank details are handled by Razorpay, not by us.
- **Connected tools:** a WordPress token (stored encrypted) and, for Google Analytics, daily visit counts by source — never information about individual visitors.
We do not collect sensitive personal data, and TrueVisible is not meant for anyone under 18.

## 3. Why we use it
To create and run your account; to ask AI assistants your questions and show you the results; to send the reports and emails you choose; to bill you and issue tax invoices; to keep the service secure; and to meet legal obligations. We use it only for these purposes, with your consent, which you give when you accept this notice.

## 4. Who processes it for us
We use service providers who process data on our instructions: Supabase (database, Singapore), Railway (hosting), Resend (email), Razorpay (payments), Slack (our internal team messages), and AI providers — OpenAI, Google, Perplexity and Anthropic — which receive the questions about your market and your business details needed to answer them, not your personal contact details. Some of these providers process data outside India; we transfer data only where the DPDP Act allows.

## 5. How long we keep it
While your account is open, and for 30 days after it closes; then we delete it. Invoices and payment records are kept for 8 years because GST law requires it.

## 6. Your rights
Under the DPDP Act you can:
- **access** a summary of your personal data and how we use it — download your data any time in Settings → Your data;
- **correct or update** it — most of it you can edit in Settings;
- **ask us to erase** it — in Settings → Your data, or by email;
- **withdraw consent** — this closes your account, since we can't provide TrueVisible without the data;
- **nominate** someone to exercise these rights if you die or become unable to;
- **raise a grievance** with our Grievance Officer (below). If you're not satisfied with our answer, you can complain to the Data Protection Board of India.

## 7. Security
Data is encrypted in transit and at rest, access is limited by workspace, secrets such as your WordPress token are kept in an encrypted vault, and only the people who run the service can reach production systems. If a breach affects your personal data, we will tell you and the Data Protection Board as the law requires.

## 8. Grievance Officer
{{officer}} · {{officerEmail}} · {{address}}. We reply within 30 days.

## 9. Changes
If we change this notice we'll update the date at the top and, for material changes, email you first.`,

refunds: `## Cancelling
- **Track (monthly or annual):** cancel any time in Settings → Plan. Your plan stays active until the end of the period you have paid for; you will not be charged again.
- **Managed and Managed Plus:** cancellable any time after the first 90 days, with notice as set out in your Managed AEO agreement.
- **Free trial:** nothing to cancel — it ends by itself after 7 days and no payment is taken.

## Refunds
- Payments for a period that has started are not refunded, in full or in part.
- If you were charged twice, charged after cancelling, or charged the wrong amount, write to {{email}} within 30 days and we will refund the extra amount to the original payment method, normally within 7 working days of approving it.
- Refunds of GST follow the credit note we issue for the refunded amount.

## Questions
{{name}} · {{email}} · {{phone}}`,

contact: `## {{trading}} — TrueVisible
**{{name}}**
{{address}}

- Email: {{email}}
- Phone: {{phone}}
- GSTIN: {{gstin}}

## Support
Reply to any TrueVisible email or write to {{email}}. Track customers hear back within 2 business days; Managed within 1 business day; Managed Plus the same day.

## Privacy and grievances
Grievance Officer: {{officer}} · {{officerEmail}}`,
};
