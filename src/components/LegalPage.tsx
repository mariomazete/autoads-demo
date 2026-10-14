import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const LEGAL_CONTACT_EMAIL = "contact@example.com";
export const LEGAL_UPDATED_AT = "1º de outubro de 2026";

type LegalPageProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

const links = [
  { to: "/privacidade", label: "Política de Privacidade" },
  { to: "/termos", label: "Termos de Serviço" },
  { to: "/exclusao-de-dados", label: "Exclusão de dados" },
] as const;

export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            AutoAds
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LEGAL_UPDATED_AT}</p>
        <p className="mt-6 leading-relaxed">{intro}</p>
        <div className="mt-8 space-y-8 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
          Dúvidas: <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </div>
      </footer>
    </div>
  );
}
