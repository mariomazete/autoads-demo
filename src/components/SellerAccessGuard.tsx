import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SellerDashboard } from "@/components/SellerDashboard";

function ChangePasswordScreen({ onChanged }: { onChanged: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLoading(false);
      setError("Sua sessão expirou. Entre novamente.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        ...user.user_metadata,
        force_password_change: false,
      },
    });

    setLoading(false);

    if (updateError) {
      setError("Não foi possível alterar a senha. Tente novamente.");
      return;
    }

    onChanged();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">Crie sua nova senha</CardTitle>
            <CardDescription className="mt-2">
              Por segurança, esta senha provisória deve ser alterada antes do primeiro acesso ao AutoAds.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Salvando..." : "Alterar senha e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export function SellerAccessGuard() {
  const [ready, setReady] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setMustChangePassword(Boolean(session?.user?.user_metadata?.force_password_change));
      setReady(true);
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setMustChangePassword(false);
        setReady(true);
        return;
      }

      if (session?.user) {
        setMustChangePassword(Boolean(session.user.user_metadata?.force_password_change));
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  if (mustChangePassword) {
    return <ChangePasswordScreen onChanged={() => setMustChangePassword(false)} />;
  }

  return <SellerDashboard />;
}
