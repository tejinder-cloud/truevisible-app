"use client";
import { useActionState, useState } from "react";
import { saveMarket, type StepState } from "./actions";
import { QuestionFlow, type Question } from "@/components/QuestionFlow";

type Initial = { competitors: string; product: string; icp: string; location: string };
const need = (field: string, msg: string) => (fd: FormData) => (String(fd.get(field) ?? "").trim().length < 2 ? msg : null);

export function MarketStep({ brandName, initial }: { brandName: string; initial: Initial }) {
  const [state, action] = useActionState<StepState, FormData>(saveMarket, {});
  const [product, setProduct] = useState(initial.product);
  const [location, setLocation] = useState(initial.location);
  const p = product.trim() || "it";

  const questions: Question[] = [
    {
      id: "product",
      title: <>What should AI <em className="accent">recommend</em> {brandName} for?</>,
      lead: "One product or service to start. You can add more after setup.",
      validate: need("product", "Add the product or service you want to be found for."),
      body: <input type="text" name="product" aria-label="Product or service" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. nursing entrance coaching" />,
    },
    {
      id: "icp",
      title: <>Who buys {p}?</>,
      lead: "Describe them the way they'd describe themselves.",
      validate: need("icp", "Add who buys it."),
      body: <input type="text" name="icp" aria-label="Who buys it" defaultValue={initial.icp} placeholder="e.g. BSc nursing aspirants and their parents" />,
    },
    {
      id: "location",
      title: <>Where do they buy?</>,
      lead: "A city or area. Buyers ask AI “best … in Mohali”, so city-level questions matter most.",
      validate: need("location", "Add the city or area you serve."),
      body: <input type="text" name="location" aria-label="City or area" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mohali" />,
    },
    {
      id: "competitors",
      optional: true,
      isEmpty: (fd) => !String(fd.get("competitors") ?? "").trim(),
      title: <>Who do you lose customers to{location.trim() ? ` in ${location.trim()}` : ""}?</>,
      lead: "One per line, with their website if you know it. Up to 10.",
      body: (
        <div className="stack-s">
          <textarea name="competitors" aria-label="Competitors" defaultValue={initial.competitors} rows={5} placeholder={"ABC Academy — abcacademy.in\nXYZ Institute"} />
          <p className="notice">Before your first audit, our setup team checks your category, competitors and prompts against what AI engines actually say, so your report compares you with the right businesses.</p>
        </div>
      ),
    },
  ];

  return (
    <form action={action}>
      <QuestionFlow questions={questions} submitLabel="Continue" pendingLabel="Saving…" serverError={state.error} backHref="/onboarding?step=1" />
    </form>
  );
}
