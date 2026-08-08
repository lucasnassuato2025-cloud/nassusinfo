import "./signing-v2.css";
import SigningClientV2 from "./signing-client-v2";

export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SigningClientV2 token={token} />;
}
