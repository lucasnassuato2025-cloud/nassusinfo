import { redirect } from "next/navigation";

import DashboardClient from "@/app/dashboard-client";
import { getCurrentUser } from "@/lib/auth/server";
import { mapClient } from "@/lib/clients";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const rows = await sql`
    SELECT id, name, company, segment, phone, email, status,
           estimated_value, next_action, next_action_date, notes,
           created_at, updated_at
      FROM clients
     WHERE owner_id = ${user.id}
     ORDER BY updated_at DESC, id DESC
  `;

  return (
    <DashboardClient
      initialClients={rows.map((row) =>
        mapClient(row as Parameters<typeof mapClient>[0]),
      )}
      user={{
        name: user.name || user.email.split("@")[0],
        email: user.email,
      }}
    />
  );
}
