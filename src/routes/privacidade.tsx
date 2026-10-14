import { Link, createFileRoute } from "@tanstack/react-router";

import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | AutoAds" },
      { name: "description", content: "Como o AutoAds coleta, usa e protege os dados dos usuários." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro="O AutoAds é uma plataforma que ajuda vendedores de veículos a publicar anúncios na Meta (Facebook e Instagram) usando campanhas preparadas pela loja. Esta política explica quais dados tratamos, por quê e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)."
    >
      <section>
        <h2>1. Dados que coletamos</h2>
        <ul>
          <li><strong>Dados de cadastro:</strong> nome, e-mail, número de WhatsApp, cargo, loja e empresa a que o usuário pertence.</li>
          <li><strong>Dados da conexão com a Meta:</strong> quando o vendedor conecta sua conta, recebemos um token de acesso, o identificador do usuário Meta, as contas de anúncios, as Páginas do Facebook e o portfólio empresarial autorizados por ele.</li>
          <li><strong>Dados das campanhas:</strong> orçamento, duração, público, área de alcance, identificadores das campanhas criadas na Meta e métricas de desempenho (impressões, cliques e investimento).</li>
          <li><strong>Dados técnicos:</strong> registros de acesso e de erro necessários para segurança e funcionamento da plataforma.</li>
        </ul>
        <p>O AutoAds <strong>não armazena</strong> as conversas de WhatsApp nem os dados das pessoas que respondem aos anúncios: os contatos vão direto para o WhatsApp do vendedor.</p>
      </section>

      <section>
        <h2>2. Como usamos os dados</h2>
        <ul>
          <li>Criar, publicar, pausar e encerrar campanhas na conta de anúncios autorizada pelo vendedor.</li>
          <li>Exibir resultados, saldo e desempenho das campanhas.</li>
          <li>Controlar o acesso de vendedores, gerentes e administradores.</li>
          <li>Garantir a segurança da plataforma e cumprir obrigações legais.</li>
        </ul>
        <p>As bases legais são a execução do contrato com o usuário, o legítimo interesse na operação e segurança do serviço e, quando aplicável, o consentimento dado ao conectar a conta Meta.</p>
      </section>

      <section>
        <h2>3. Compartilhamento</h2>
        <p>Os dados são compartilhados apenas com:</p>
        <ul>
          <li><strong>Meta Platforms</strong>, para criar e gerenciar os anúncios autorizados pelo vendedor;</li>
          <li><strong>provedores de infraestrutura</strong> (hospedagem e banco de dados) que operam a plataforma;</li>
          <li>autoridades, quando exigido por lei.</li>
        </ul>
        <p>Não vendemos dados pessoais.</p>
      </section>

      <section>
        <h2>4. Armazenamento e segurança</h2>
        <p>Os tokens de acesso da Meta ficam apenas no servidor e nunca são exibidos na interface. Mantemos os dados enquanto a conta estiver ativa ou pelo tempo necessário para cumprir obrigações legais. Ao desconectar a conta Meta, o token é invalidado e deixa de ser usado.</p>
      </section>

      <section>
        <h2>5. Seus direitos</h2>
        <p>Você pode solicitar a qualquer momento: confirmação e acesso aos seus dados, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamento e revogação do consentimento. Para excluir seus dados, veja a página <Link to="/exclusao-de-dados" className="underline">Exclusão de dados</Link>.</p>
      </section>

      <section>
        <h2>6. Contato</h2>
        <p>Solicitações e dúvidas sobre privacidade: <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalPage>
  );
}
