import { Link, createFileRoute } from "@tanstack/react-router";

import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/exclusao-de-dados")({
  head: () => ({
    meta: [
      { title: "Exclusão de dados | AutoAds" },
      { name: "description", content: "Como solicitar a exclusão dos seus dados no AutoAds." },
    ],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <LegalPage
      title="Exclusão de dados"
      intro="Você pode remover a autorização do AutoAds na Meta e solicitar a exclusão dos seus dados a qualquer momento."
    >
      <section>
        <h2>1. Desconectar a conta Meta</h2>
        <ul>
          <li><strong>Pelo AutoAds:</strong> entre na plataforma, abra <em>Meta Ads</em> e clique em <em>Desconectar Meta</em>. O token de acesso é invalidado e deixa de ser usado imediatamente.</li>
          <li><strong>Pelo Facebook:</strong> acesse Configurações e privacidade → Configurações → Integrações comerciais, selecione <em>AutoAds</em> e clique em <em>Remover</em>.</li>
        </ul>
      </section>

      <section>
        <h2>2. Solicitar a exclusão de todos os dados</h2>
        <p>Envie um e-mail para <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Exclus%C3%A3o%20de%20dados%20AutoAds`}>{LEGAL_CONTACT_EMAIL}</a> com o assunto <strong>"Exclusão de dados AutoAds"</strong>, informando o e-mail usado no cadastro.</p>
        <p>Em até 15 dias excluiremos seus dados de cadastro, a conexão com a Meta (tokens, contas de anúncios e Páginas vinculadas) e o histórico das suas campanhas, e confirmaremos por e-mail.</p>
        <p>Podemos manter apenas os registros que a lei nos obriga a guardar, pelo prazo legal.</p>
      </section>

      <section>
        <h2>3. O que não é excluído pelo AutoAds</h2>
        <p>Anúncios e campanhas já criados na sua conta de anúncios continuam na Meta e podem ser apagados pelo Gerenciador de Anúncios. As conversas de WhatsApp não passam pelo AutoAds.</p>
        <p>Mais detalhes na <Link to="/privacidade" className="underline">Política de Privacidade</Link>.</p>
      </section>
    </LegalPage>
  );
}
