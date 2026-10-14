import { createFileRoute } from "@tanstack/react-router";

import { RoleAccess } from "@/components/RoleAccess";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoAds | Anúncios para vendedores de veículos" },
      { name: "description", content: "Plataforma para vendedores de veículos publicarem anúncios na Meta com ofertas da loja e contatos direto no WhatsApp." },
      { property: "og:title", content: "AutoAds" },
      { property: "og:description", content: "Anúncios na Meta para vendedores de veículos, com contatos direto no WhatsApp." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return <RoleAccess />;
}
