"use client";

import { createClient } from "@neondatabase/neon-js";

const FALLBACK_AUTH_URL =
  "https://ep-jolly-snow-awbq15u7.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth";
const FALLBACK_DATA_API_URL =
  "https://ep-jolly-snow-awbq15u7.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1";

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim() || FALLBACK_AUTH_URL;
const DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim() || FALLBACK_DATA_API_URL;

export const neonClient = createClient({
  auth: { url: AUTH_URL },
  dataApi: { url: DATA_API_URL },
});
