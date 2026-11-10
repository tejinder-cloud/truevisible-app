import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { AnswerText } from "@/components/AnswerText";
import { DOCS, isApproved, LEGAL_VERSION, legalText, TITLE, type DocId } from "@/lib/legal";

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  return { title: TITLE[doc as DocId] ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!DOCS.includes(doc as DocId)) notFound();
  const d = doc as DocId;
  const approved = isApproved();
  return (
    <>
      <TopBar />
      <main className="narrow stack-m legal" style={{ paddingTop: 48, paddingBottom: 96 }}>
        {!approved && <p className="notice" role="note"><strong>Draft — not yet in force.</strong> This document is waiting for approval.</p>}
        <div className="stack-xs">
          <p className="eyebrow">TrueVisible</p>
          <h1>{TITLE[d]}</h1>
          <p className="small muted">Version {LEGAL_VERSION}</p>
        </div>
        <AnswerText text={legalText(d)} />
        <nav className="small" style={{ display: "flex", gap: 16, flexWrap: "wrap", borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
          {DOCS.map((x) => (x === d ? <span key={x} className="muted">{TITLE[x]}</span> : <Link key={x} href={`/legal/${x}`}>{TITLE[x]}</Link>))}
        </nav>
      </main>
    </>
  );
}
