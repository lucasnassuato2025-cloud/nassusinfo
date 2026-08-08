export type BillingPlan = "essential" | "professional";

const CHECKOUTS: Record<BillingPlan, string> = {
  essential: process.env.NEXT_PUBLIC_CAKTO_ESSENTIAL_CHECKOUT_URL?.trim() || "",
  professional: process.env.NEXT_PUBLIC_CAKTO_PROFESSIONAL_CHECKOUT_URL?.trim() || "",
};

export function getCheckoutUrl(plan: BillingPlan): string | null {
  const value = CHECKOUTS[plan];
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
