import { createAuthClient } from "@neondatabase/auth";

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL || "https://ep-delicate-smoke-9t4rfcg8.neonauth.c-4.us-east-1.aws.neon.tech/neondb/auth";

export const authClient = createAuthClient(AUTH_URL);
