import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Megaphone } from "lucide-react";
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
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setLoading(false);
      setError("Sua sessão expirou. Faça login novamente.");
      return;
    }

    const currentMetadata = userData.user.user_metadata ?? {};
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { ...currentMetadata, force_password_change: false },
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
              Por segurança, você precisa trocar a senha provisória antes de acessar o AutoAds.
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
              <Label htmlFor="confirm-password">Confirme a nova senha</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export function SellerAuthGate() {
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setMustChangePassword(Boolean(data.user?.user_metadata?.force_password_change));
    }

    checkUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => checkUser(), 0);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (mustChangePassword === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Megaphone className="h-4 w-4" /> Carregando...
        </div>
      </main>
    );
  }

  if (mustChangePassword) {
    return <ChangePasswordScreen onChanged={() => setMustChangePassword(false)} />;
  }

  return <SellerDashboard />;
}
