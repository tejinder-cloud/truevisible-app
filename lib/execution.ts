// Day 28: how approved changes reach a customer's site, and the change pack a developer can work from.

export type PathInfo = { label: string; how: string; connect?: "wordpress" };
/** Per platform, in plain words (SPEC §7: WordPress via plugin; others via change pack until their connectors ship). */
export const EXECUTION_PATH: Record<string, PathInfo> = {
  wordpress: { label: "WordPress", how: "Connect the free Easy MCP AI plugin below and we can publish approved pages, FAQs and schema for you. Without it, download the change pack and pass it to whoever manages your site.", connect: "wordpress" },
  shopify: { label: "Shopify", how: "Download the change pack from Recommendations and pass it to whoever manages your store. Direct publishing to Shopify is coming." },
  webflow: { label: "Webflow", how: "Download the change pack from Recommendations and pass it to your Webflow designer. Direct publishing to Webflow is coming." },
  wix: { label: "Wix", how: "Download the change pack from Recommendations — each change says which Wix panel it goes in." },
  squarespace: { label: "Squarespace", how: "Download the change pack from Recommendations — each change says which Squarespace panel it goes in." },
  custom: { label: "Custom site", how: "Download the change pack from Recommendations and give it to your developer. It lists every change with ready-to-paste code." },
  none: { label: "No website", how: "Your recommendations focus on listings and sites AI cites. When you have a website, set the platform and the change pack covers it." },
};
export const pathFor = (platform: string | null | undefined): PathInfo => EXECUTION_PATH[platform ?? ""] ?? EXECUTION_PATH.custom;

/** Where each asset kind goes — the developer's instruction line. */
const WHERE: Record<string, string> = {
  page_draft: "Publish as a new page (or replace the existing one) at the suggested URL.",
  faq_block: "Add to the page named in the change, as visible questions and answers. Pair with FAQPage schema if included.",
  json_ld: "Paste inside a <script type=\"application/ld+json\"> tag in the <head> of the page named in the change. Validate at https://validator.schema.org.",
  llms_txt: "Save as /llms.txt at the root of the site (plain text, UTF-8).",
  meta: "Update the page titles and meta descriptions listed.",
  change_pack: "Follow the steps as written.",
};
const PLATFORM_HINT: Record<string, Record<string, string>> = {
  wix: { json_ld: "In Wix: Pages → page settings → Advanced SEO → Structured data markup.", meta: "In Wix: Pages → page settings → SEO basics." },
  squarespace: { json_ld: "In Squarespace: page settings → Advanced → Page header code injection.", meta: "In Squarespace: page settings → SEO." },
  shopify: { json_ld: "In Shopify: Online Store → Themes → Edit code → the page's template.", llms_txt: "Shopify can't serve root files directly — use an app or a redirect from /llms.txt to a page." },
  webflow: { json_ld: "In Webflow: Page settings → Custom code → Inside <head> tag." },
};

export type PackRec = { id: string; title: string; body: string | null; category: string | null; impact: number; ease: number };
export type PackAsset = { kind: string; title: string; content: { format?: string; body?: string } | null };
const ONSITE = new Set(["onsite", "content", "technical"]);
export const inChangePack = (r: { category: string | null; status: string }) => ONSITE.has(r.category ?? "") && (r.status === "open" || r.status === "diy");

/** The change pack as one Markdown file (pure; tested). Code assets go in fenced blocks so nothing gets mangled in email. */
export function changePackMarkdown(o: { brand: string; domain: string | null; platform: string | null; date: string; items: { rec: PackRec; asset?: PackAsset }[] }): string {
  const fence = (fmt: string) => (fmt === "json" || fmt === "jsonld" ? "json" : fmt === "html" ? "html" : "");
  const lines = [
    `# Change pack — ${o.brand}`,
    ``,
    `Website: ${o.domain ?? "—"} · Platform: ${pathFor(o.platform).label} · Prepared ${o.date} by TrueVisible`,
    ``,
    `These changes help AI assistants (ChatGPT, Gemini, Perplexity) understand and cite ${o.brand}. Do them in order — the first ones matter most.`,
    `When a change is live, mark it done in TrueVisible → Recommendations so we can measure the effect.`,
    ``,
  ];
  o.items.forEach(({ rec, asset }, i) => {
    lines.push(`---`, ``, `## ${i + 1}. ${rec.title}`, ``);
    if (rec.body) lines.push(rec.body, ``);
    if (asset?.content?.body) {
      const fmt = asset.content.format ?? "markdown";
      const hint = PLATFORM_HINT[o.platform ?? ""]?.[asset.kind];
      lines.push(`**Where it goes:** ${WHERE[asset.kind] ?? "As described above."}${hint ? ` ${hint}` : ""}`, ``, `**${asset.title}**`, ``);
      if (fmt === "markdown") lines.push(asset.content.body.trim(), ``);
      else lines.push("```" + fence(fmt), asset.content.body.trim(), "```", ``);
    }
  });
  if (!o.items.length) lines.push(`No on-site changes are waiting right now.`, ``);
  return lines.join("\n");
}

export const changePackFilename = (brand: string, date: string) => `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand"}-change-pack-${date}.md`;
