import { Link, createFileRoute } from "@tanstack/react-router";

import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço | AutoAds" },
      { name: "description", content: "Condições de uso da plataforma AutoAds." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Termos de Serviço"
      intro="Ao acessar o AutoAds, você concorda com estes termos. Se não concordar, não utilize a plataforma."
    >
      <section>
        <h2>1. O serviço</h2>
        <p>O AutoAds permite que administradores e gerentes de lojas de veículos preparem campanhas e que vendedores as publiquem como anúncios na Meta, direcionando os interessados para o WhatsApp do próprio vendedor.</p>
      </section>

      <section>
        <h2>2. Acesso</h2>
        <p>O acesso é concedido pela loja ou pelo administrador da plataforma. Você é responsável por manter sua senha em sigilo e por todas as ações feitas com o seu acesso.</p>
      </section>

      <section>
        <h2>3. Conta Meta e investimento em anúncios</h2>
        <ul>
          <li>Ao conectar sua conta Meta, você autoriza o AutoAds a criar e gerenciar anúncios na conta de anúncios e na Página selecionadas.</li>
          <li>Os valores investidos em anúncios são cobrados diretamente pela Meta, na forma de pagamento cadastrada na sua conta de anúncios.</li>
          <li>Você deve cumprir as <a className="underline" href="https://transparency.meta.com/policies/ad-standards/" target="_blank" rel="noreferrer">Políticas de Publicidade da Meta</a>. A aprovação, veiculação e entrega dos anúncios dependem exclusivamente da Meta.</li>
          <li>Você pode desconectar sua conta Meta a qualquer momento.</li>
        </ul>
      </section>

      <section>
        <h2>4. Responsabilidades</h2>
        <p>O conteúdo das ofertas (preços, condições e imagens) é de responsabilidade da loja que as cadastrou. O AutoAds não garante resultados de vendas, número de contatos ou desempenho dos anúncios.</p>
      </section>

      <section>
        <h2>5. Uso proibido</h2>
        <p>É proibido usar a plataforma para anúncios enganosos, ilegais ou que violem direitos de terceiros, bem como tentar acessar dados de outros usuários ou comprometer a segurança do sistema. Acessos usados dessa forma podem ser suspensos.</p>
      </section>

      <section>
        <h2>6. Privacidade</h2>
        <p>O tratamento de dados pessoais segue a nossa <Link to="/privacidade" className="underline">Política de Privacidade</Link>.</p>
      </section>

      <section>
        <h2>7. Alterações e contato</h2>
        <p>Estes termos podem ser atualizados, e a data no topo indica a versão vigente. Aplica-se a legislação brasileira. Contato: <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalPage>
  );
}
