import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retiredRoute() {
  return NextResponse.json(
    { error: "A autenticação agora é realizada diretamente pelo Neon Auth." },
    { status: 410 },
  );
}

export const GET = retiredRoute;
export const POST = retiredRoute;
