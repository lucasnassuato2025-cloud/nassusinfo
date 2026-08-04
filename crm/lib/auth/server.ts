import { createNeonAuth } from "@neondatabase/auth/next/server";

import { requiredEnv, validateCookieSecret } from "@/lib/env";

export const auth = createNeonAuth({
  baseUrl: requiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: validateCookieSecret(requiredEnv("NEON_AUTH_COOKIE_SECRET")),
  },
});

export type CrmUser = {
  id: string;
  name?: string | null;
  email: string;
};

export async function getCurrentUser(): Promise<CrmUser | null> {
  const { data } = await auth.getSession();
  const user = data?.user as CrmUser | undefined;

  if (!user?.id || !user.email) {
    return null;
  }

  return user;
}
