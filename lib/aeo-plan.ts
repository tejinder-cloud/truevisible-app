// The 90-day plan on the dashboard (plan Day 29b). Pure: which week we're in and where each item stands, from the
// recommendation it delivers and the WordPress work done for it. Nothing here is estimated.

export type PlanItem = { id: string; week: number; title: string; detail: string; kind: string; path: string; count: number; recommendation_id: string | null };
export type ItemState = "done" | "in_progress" | "this_week" | "overdue" | "planned";

/** Week of the plan (1–13) for a date; 0 before it starts, 14 after it ends. */
export function planWeek(startsOn: string, today: string): number {
  const days = Math.floor((Date.parse(today + "T00:00:00Z") - Date.parse(startsOn + "T00:00:00Z")) / 86_400_000);
  if (days < 0) return 0;
  return Math.min(14, Math.floor(days / 7) + 1);
}

export function itemState(i: PlanItem, week: number, recStatus: Map<string, string>, wpBusy: Set<string>): ItemState {
  const rs = i.recommendation_id ? recStatus.get(i.recommendation_id) : undefined;
  if (rs === "done" || rs === "managed") return "done";
  if (i.recommendation_id && wpBusy.has(i.recommendation_id)) return "in_progress";
  if (i.week === week) return "this_week";
  if (i.week < week) return "overdue";
  return "planned";
}

export const STATE_LABEL: Record<ItemState, string> = { done: "Done", in_progress: "In progress", this_week: "This week", overdue: "Carried over", planned: "Planned" };
export const KIND_LABEL: Record<string, string> = { page: "Page", technical: "Technical", outreach: "Outreach", listing: "Listings", gbp: "Google Business Profile", review: "Reviews", measure: "Measure" };
export const PATH_LABEL: Record<string, string> = { wordpress: "on your WordPress", change_pack: "change pack", offsite: "off your site", gbp: "Google Business Profile", team: "our team" };
