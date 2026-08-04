import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retiredRoute() {
  return NextResponse.json(
    { error: "Os clientes agora são acessados diretamente pela Neon Data API." },
    { status: 410 },
  );
}

export const GET = retiredRoute;
export const PUT = retiredRoute;
export const DELETE = retiredRoute;
