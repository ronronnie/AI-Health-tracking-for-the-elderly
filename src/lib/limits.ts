import { db } from "@/lib/db";

/** Free-plan quotas. Users past these limits are asked to email us. */
export const MAX_PARENTS = 2;
export const MAX_GENERATIONS = 2;
export const CONTACT_EMAIL = "ronoldanthony@gmail.com";

const GENERATIONS_KEY = "generations";

/**
 * Lifetime count of report generations. Stored as a counter rather than derived
 * from the reports table so deleting a report doesn't hand back a free parse.
 */
export async function getGenerationsUsed(): Promise<number> {
  const row = await db.usage.get(GENERATIONS_KEY);
  return row?.count ?? 0;
}

export async function incrementGenerationsUsed(): Promise<number> {
  return db.transaction("rw", db.usage, async () => {
    const used = (await db.usage.get(GENERATIONS_KEY))?.count ?? 0;
    const next = used + 1;
    await db.usage.put({ key: GENERATIONS_KEY, count: next });
    return next;
  });
}

export async function hasGenerationsLeft(): Promise<boolean> {
  return (await getGenerationsUsed()) < MAX_GENERATIONS;
}

export async function getParentsUsed(): Promise<number> {
  return db.parents.count();
}

export async function hasParentSlotsLeft(): Promise<boolean> {
  return (await getParentsUsed()) < MAX_PARENTS;
}

/** Prefilled mailto: link shown when a user hits a limit. */
export function upgradeMailtoHref(kind: "parents" | "generations"): string {
  const subject =
    kind === "parents"
      ? "ParentCare — request for more parent slots"
      : "ParentCare — request for more report generations";
  const body = [
    "Hi,",
    "",
    kind === "parents"
      ? `I've used all ${MAX_PARENTS} parent slots on ParentCare and would like to add more.`
      : `I've used all ${MAX_GENERATIONS} report generations on ParentCare and would like more.`,
    "",
    "Thanks!",
  ].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
