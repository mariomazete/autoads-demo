import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ManagerPanel } from "@/components/ManagerPanel";
import { SellerDashboard } from "@/components/SellerDashboard";

export function RoleAccess() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  async function resolveRole() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      setRole(null);
      setSessionChecked(true);
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .in("role", ["ADMIN_MASTER", "ADMIN_LOJA", "VENDEDOR"])
      .limit(1)
      .maybeSingle();

    setRole(roleRow?.role ?? null);
    setSessionChecked(true);
  }

  useEffect(() => {
    resolveRole();
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => resolveRole(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!sessionChecked) {
    return <div className="min-h-screen flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Verificando acesso...</div>;
  }

  if (role === "ADMIN_LOJA") return <ManagerPanel />;
  if (role === "VENDEDOR") return <SellerDashboard />;
  if (role === "ADMIN_MASTER") {
    return <div className="min-h-screen flex items-center justify-center p-6"><div className="text-center space-y-3"><h1 className="text-2xl font-semibold">Acesso Master</h1><p className="text-sm text-muted-foreground">Use o painel administrativo para acessar a operação.</p><a className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground" href="/admin">Abrir Administração</a></div></div>;
  }

  return <SellerDashboard />;
}
