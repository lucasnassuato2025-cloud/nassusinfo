import { neon } from "@neondatabase/serverless";

import { requiredEnv } from "@/lib/env";

export const sql = neon(requiredEnv("DATABASE_URL"));
