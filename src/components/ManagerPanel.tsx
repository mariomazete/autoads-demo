import { useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ManagerDashboard } from "@/components/ManagerDashboard";
import { ManagerSellers } from "@/components/ManagerSellers";
import { ManagerCampaignLibrary } from "@/components/ManagerCampaignLibrary";
import { ManagerCampaignCreator } from "@/components/ManagerCampaignCreator";
import { MetaAdsConnection } from "@/components/MetaAdsConnection";
import { ManagerSettings } from "@/components/ManagerSettings";
import { SalesReport } from "@/components/sales/SalesReport";
import { supabase } from "@/integrations/supabase/client";

type ManagerView = "dashboard" | "vendas" | "vendedores" | "campanhas" | "ofertas" | "meta" | "configuracoes";
type NavItem = { label: string; value: Exclude<ManagerView, "configuracoes" | "dashboard">; icon: typeof LayoutDashboard; group?: string };

const navigation: NavItem[] = [
  { label: "Vendas", value: "vendas", icon: BadgeCheck, group: "Operação" },
  { label: "Vendedores", value: "vendedores", icon: Users, group: "Operação" },
  { label: "Criar / Editar Campanha", value: "campanhas", icon: BarChart3, group: "Campanhas" },
  { label: "Ofertas", value: "ofertas", icon: Megaphone, group: "Campanhas" },
  { label: "Meta Ads", value: "meta", icon: BarChart3, group: "Integrações" },
];

export function ManagerPanel() {
  const [view, setViewState] = useState<ManagerView>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function setView(next: ManagerView) {
    setViewState(next);
    setMobileMenuOpen(false);
  }
  const currentPage = view === "configuracoes"
    ? { label: "Configurações" }
    : view === "dashboard"
      ? { label: "Dashboard" }
      : navigation.find((item) => item.value === view);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function renderContent() {
    switch (view) {
      case "dashboard": return <ManagerDashboard onOpenSales={() => setView("vendas")} />;
      case "vendas": return <SalesReport scope="store" />;
      case "vendedores": return <ManagerSellers />;
      case "campanhas": return <ManagerCampaignCreator />;
      case "ofertas": return <ManagerCampaignLibrary />;
      case "meta": return <MetaAdsConnection />;
      case "configuracoes": return <ManagerSettings onLogout={logout} />;
      default: return null;
    }
  }

  const groups = Array.from(new Set(navigation.map((item) => item.group ?? "Geral")));

  const sidebarContent = (
    <>
      <div className="flex h-20 shrink-0 flex-col justify-center border-b border-border px-6">
        <p className="text-lg font-semibold">AutoAds</p>
        <p className="text-xs text-muted-foreground">Painel da Loja</p>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1">
          <Button
            variant={view === "dashboard" ? "secondary" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setView("dashboard")}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        {groups.map((group) => (
          <div key={group}>
            {group !== "Geral" && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>}
            <div className="space-y-1">
              {navigation.filter((item) => (item.group ?? "Geral") === group).map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.value}
                    variant={view === item.value ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setView(item.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background p-4">
        <Button
          variant={view === "configuracoes" ? "secondary" : "ghost"}
          className="mb-2 w-full justify-start gap-3"
          onClick={() => setView("configuracoes")}
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  );


  return (
    <main className="min-h-screen bg-muted/30" data-section={view === "campanhas" ? "campaign-editor" : view}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          {sidebarContent}
        </aside>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
            <SheetTitle className="sr-only">Menu do gerente</SheetTitle>
            <SheetDescription className="sr-only">Navegue entre as áreas do painel da loja.</SheetDescription>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 h-20 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Painel do Gerente</p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{currentPage?.label ?? "Dashboard"}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">Área da loja</Badge>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
            {view !== "dashboard" && view !== "vendedores" && view !== "vendas" && (
              <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Minha loja</span><ChevronRight className="h-3.5 w-3.5" /><span>{currentPage?.label}</span>
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      </div>
    </main>
  );
}
