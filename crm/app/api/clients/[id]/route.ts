import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { mapClient, parseClientInput } from "@/lib/clients";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validId(value: string): string | null {
  return /^\d+$/.test(value) ? value : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const { id: rawId } = await context.params;
  const id = validId(rawId);

  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  const rows = await sql`
    SELECT id, name, company, segment, phone, email, status,
           estimated_value, next_action, next_action_date, notes,
           created_at, updated_at
      FROM clients
     WHERE id = ${id} AND owner_id = ${user.id}
     LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    client: mapClient(rows[0] as Parameters<typeof mapClient>[0]),
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const { id: rawId } = await context.params;
  const id = validId(rawId);

  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  try {
    const input = parseClientInput(await request.json());
    const rows = await sql`
      UPDATE clients
         SET name = ${input.name},
             company = ${input.company},
             segment = ${input.segment},
             phone = ${input.phone},
             email = ${input.email},
             status = ${input.status},
             estimated_value = ${input.estimatedValue},
             next_action = ${input.nextAction},
             next_action_date = ${input.nextActionDate},
             notes = ${input.notes},
             updated_at = now()
       WHERE id = ${id} AND owner_id = ${user.id}
       RETURNING id, name, company, segment, phone, email, status,
                 estimated_value, next_action, next_action_date, notes,
                 created_at, updated_at
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      client: mapClient(rows[0] as Parameters<typeof mapClient>[0]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const { id: rawId } = await context.params;
  const id = validId(rawId);

  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!id) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });

  const rows = await sql`
    DELETE FROM clients
     WHERE id = ${id} AND owner_id = ${user.id}
     RETURNING id
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
