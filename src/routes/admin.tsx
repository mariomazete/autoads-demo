import { FormEvent, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/AdminDashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração | AutoAds" },
      {
        name: "description",
        content: "Área administrativa da plataforma AutoAds.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setAuthenticated(Boolean(data.session));
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.session) {
      setErrorMessage(
        error?.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Confira o cadastro do usuário no Supabase.",
      );
      setLoading(false);
      return;
    }

    setAuthenticated(true);
    setPassword("");
    setLoading(false);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Verificando sessão...
        </p>
      </main>
    );
  }

  if (authenticated) {
    return <AdminDashboard />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Área administrativa</CardTitle>
          <CardDescription>
            Entre com seu usuário administrador para acessar o Painel Master.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha</Label>
              <PasswordInput
                id="admin-password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Entrando..." : "Entrar na área administrativa"}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-5 text-center">
            <Button asChild variant="link">
              <Link to="/">Voltar para o login de vendedor</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}