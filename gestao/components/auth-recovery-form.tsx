"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { authClient } from "@/lib/auth-client";

export default function AuthRecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  const router = useRouter();
  const path = mode === "forgot" ? "forgot-password" : "reset-password";

  return (
    <div className="neon-auth-surface">
      <NeonAuthUIProvider
        authClient={authClient}
        navigate={router.push}
        replace={router.replace}
        onSessionChange={() => router.refresh()}
        redirectTo="/sign-in"
        Link={Link}
        defaultTheme="light"
      >
        <AuthView path={path} />
      </NeonAuthUIProvider>
    </div>
  );
}
