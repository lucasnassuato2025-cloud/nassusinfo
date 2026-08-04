import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { mapClient, parseClientInput } from "@/lib/clients";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rows = await sql`
    SELECT id, name, company, segment, phone, email, status,
           estimated_value, next_action, next_action_date, notes,
           created_at, updated_at
      FROM clients
     WHERE owner_id = ${user.id}
     ORDER BY updated_at DESC, id DESC
  `;

  return NextResponse.json({
    clients: rows.map((row) =>
      mapClient(row as Parameters<typeof mapClient>[0]),
    ),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const input = parseClientInput(await request.json());
    const rows = await sql`
      INSERT INTO clients (
        owner_id, name, company, segment, phone, email, status,
        estimated_value, next_action, next_action_date, notes
      ) VALUES (
        ${user.id}, ${input.name}, ${input.company}, ${input.segment},
        ${input.phone}, ${input.email}, ${input.status},
        ${input.estimatedValue}, ${input.nextAction}, ${input.nextActionDate},
        ${input.notes}
      )
      RETURNING id, name, company, segment, phone, email, status,
                estimated_value, next_action, next_action_date, notes,
                created_at, updated_at
    `;

    return NextResponse.json(
      { client: mapClient(rows[0] as Parameters<typeof mapClient>[0]) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cadastrar cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
