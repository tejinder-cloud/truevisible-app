// Facts shown while an audit runs. Every figure is from a named, dated, linked source — no unsourced numbers.
export type AeoFact = { text: string; source: string; url?: string };

export const AEO_FACTS: AeoFact[] = [
  { text: "When Google shows an AI summary, people click through to a website on 8% of visits — almost half the 15% when there's no summary.",
    source: "Pew Research Center, July 2025", url: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/" },
  { text: "Only about 1% of visits with a Google AI summary end in a click on a link inside it. Being named in the answer itself is what gets seen.",
    source: "Pew Research Center, July 2025", url: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/" },
  { text: "Google's AI Overviews reach more than 2 billion people a month, in over 200 countries.",
    source: "Google, via TechCrunch, July 2025", url: "https://techcrunch.com/2025/07/23/googles-ai-overviews-have-2b-monthly-users-ai-mode-100m-in-the-us-and-india" },
  { text: "ChatGPT passed 900 million weekly users in early 2026 — many of them asking which business to choose.",
    source: "OpenAI, February 2026", url: "https://www.roic.ai/news/openais-chatgpt-surpasses-900-million-weekly-users-50-million-paying-subscribers-02-27-2026" },
  { text: "Google's AI Mode reached 100 million monthly users in the US and India within months of launch.",
    source: "Google, via TechCrunch, July 2025", url: "https://techcrunch.com/2025/07/23/googles-ai-overviews-have-2b-monthly-users-ai-mode-100m-in-the-us-and-india" },
  { text: "Gartner predicted traditional search engine volume would fall 25% by 2026 as people switch to AI assistants.",
    source: "Gartner, February 2024", url: "https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents" },
  { text: "An AI answer usually names a handful of businesses, not a page of ten links. If you're not one of them, that buyer may never see you.",
    source: "How AI answers work" },
  { text: "AI builds its answer from pages it reads — directories, review sites, 'best of' lists. Your audit shows exactly which pages AI cites for your questions.",
    source: "What your audit measures" },
];
