"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthPage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const has = Boolean(data.session);
      setIsSignedIn(has);
      setEmail(data.session?.user.email ?? null);

      if (has && nextUrl) {
        window.location.href = decodeURIComponent(nextUrl);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const has = Boolean(session);
      setIsSignedIn(has);
      setEmail(session?.user.email ?? null);

      if (has && nextUrl) {
        window.location.href = decodeURIComponent(nextUrl);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [nextUrl]);

  if (isSignedIn && !nextUrl) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1>Signed in</h1>
        <p>{email}</p>
        <button onClick={async () => supabase.auth.signOut()}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Sign in</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        view="sign_in"
      />
    </main>
  );
}
