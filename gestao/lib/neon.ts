"use client";

import { createClient } from "@neondatabase/neon-js";

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim() ||
  "https://ep-wild-waterfall-aubyt47v.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth";

const DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim() ||
  "https://ep-wild-waterfall-aubyt47v.apirest.c-10.us-east-1.aws.neon.tech/neondb/rest/v1";

export const neonClient = createClient({
  auth: { url: AUTH_URL },
  dataApi: { url: DATA_API_URL },
});
