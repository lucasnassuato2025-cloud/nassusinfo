import SigningClient from "./signing-client";

export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SigningClient token={token} />;
}
