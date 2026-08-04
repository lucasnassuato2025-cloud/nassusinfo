"use client";

import { createClient } from "@neondatabase/neon-js";

const AUTH_URL =
  "https://ep-jolly-snow-awbq15u7.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth";
const DATA_API_URL =
  "https://ep-jolly-snow-awbq15u7.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1";

export const neonClient = createClient({
  auth: { url: AUTH_URL },
  dataApi: { url: DATA_API_URL },
});
