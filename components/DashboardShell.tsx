import Link from "next/link";
import { TopBar } from "@/components/TopBar";

// Header + tab bar shared by every dashboard tab. Tabs without a page yet stay visible but inert.
const TABS: { label: string; href: string | null }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Prompts", href: "/dashboard/prompts" },
  { label: "Citations", href: "/dashboard/citations" },
  { label: "Recommendations", href: "/dashboard/recommendations" },
  { label: "Impact", href: null },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function DashboardShell({ active, email, trialDays, brandName, domain, children }: {
  active: string; email?: string | null; trialDays: number | null; brandName: string; domain: string | null; children: React.ReactNode;
}) {
  return (
    <>
      <TopBar email={email} trialDays={trialDays} />
      <main className="container stack-l" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <div className="stack-xs">
          <p className="eyebrow">{domain ?? "No website"}</p>
          <h1>{brandName}</h1>
        </div>
        <nav className="tabs" aria-label="Dashboard">
          {TABS.map((t) =>
            t.label === active ? <span key={t.label} className="active" aria-current="page">{t.label}</span>
            : t.href ? <Link key={t.label} href={t.href}>{t.label}</Link>
            : <span key={t.label} aria-disabled="true" title="Coming in a later build">{t.label}</span>,
          )}
        </nav>
        {children}
      </main>
    </>
  );
}
