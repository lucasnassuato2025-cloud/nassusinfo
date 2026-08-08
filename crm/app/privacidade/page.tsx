import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidade e proteção de dados | Nassus CRM",
  description: "Informações sobre privacidade, segurança e tratamento de dados no Nassus CRM e no portal de assinatura.",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="sign-shell sign-document-shell">
      <article className="sign-paper">
        <header className="sign-paper-head">
          <div>
            <span>PRIVACIDADE E PROTEÇÃO DE DADOS</span>
            <h1>Aviso de privacidade do Nassus CRM</h1>
          </div>
          <dl><div><dt>Atualização</dt><dd>08/08/2026</dd></div></dl>
        </header>

        <section className="sign-section">
          <h2>1. Quem trata os dados</h2>
          <p>A Nassusinfo Soluções Tecnológicas utiliza o Nassus CRM para gestão comercial, operação, documentos e relacionamento com clientes. Este aviso também se aplica ao portal privado usado para leitura e assinatura eletrônica de contratos.</p>
        </section>

        <section className="sign-section">
          <h2>2. Dados tratados</h2>
          <p>Conforme o fluxo utilizado, o CRM pode tratar dados de cadastro e contato, informações comerciais, dados de projetos e pagamentos, conteúdo de propostas e contratos e informações necessárias para autenticação.</p>
          <p>No fluxo de assinatura, CPF ou CNPJ é solicitado para confirmar a identidade vinculada ao documento. O código de acesso, o token do link e o documento informado para validação são comparados por mecanismos criptográficos; o gateway não registra o endereço IP em texto puro nos eventos de segurança.</p>
        </section>

        <section className="sign-section">
          <h2>3. Finalidades</h2>
          <p>Os dados são utilizados para autenticar usuários autorizados, prestar e administrar serviços, gerar documentos, registrar pagamentos, executar contratos, prevenir fraude e abuso, manter trilhas de auditoria, atender obrigações aplicáveis e permitir o exercício regular de direitos.</p>
        </section>

        <section className="sign-section">
          <h2>4. Assinatura eletrônica e evidências</h2>
          <p>Cada versão encaminhada para assinatura possui identificação própria e hash de integridade. O sistema registra consentimento, versão assinada, método de assinatura e eventos técnicos de segurança. Alterações posteriores devem gerar uma nova versão.</p>
          <p>O portal do Nassus CRM registra uma assinatura eletrônica particular. Ele não se apresenta como certificado ICP-Brasil nem como assinatura Gov.br.</p>
        </section>

        <section className="sign-section">
          <h2>5. Segurança</h2>
          <p>O CRM utiliza autenticação, isolamento por workspace, políticas de acesso no banco de dados, links de assinatura com expiração e revogação, hashes, limitação de tentativas, proteção contra carregamento em frames e controles de segurança do navegador. Logs de diagnóstico são minimizados e não devem conter senha, código de acesso, token de assinatura ou conteúdo integral de documentos.</p>
        </section>

        <section className="sign-section">
          <h2>6. Retenção e exclusão</h2>
          <p>Registros operacionais excluídos são enviados para uma lixeira com período padrão de retenção de 30 dias, sujeito às regras administrativas do CRM.</p>
          <p>Documentos assinados e suas evidências podem ser preservados além do período normal de lixeira quando a retenção for necessária para execução contratual, cumprimento de obrigações aplicáveis, prevenção a fraude ou exercício regular de direitos. Esses registros não devem ser eliminados automaticamente por uma exclusão comum do CRM.</p>
        </section>

        <section className="sign-section">
          <h2>7. Infraestrutura e operadores</h2>
          <p>Serviços de infraestrutura em nuvem e banco de dados utilizados pelo CRM podem processar informações estritamente para hospedagem, autenticação, armazenamento, segurança e disponibilidade do serviço, conforme as configurações e contratos aplicáveis.</p>
        </section>

        <section className="sign-section">
          <h2>8. Direitos do titular</h2>
          <p>Solicitações relacionadas a acesso, correção, atualização, informação sobre tratamento ou eliminação de dados podem ser feitas pelo canal oficial utilizado no relacionamento com a Nassusinfo. A exclusão poderá ser limitada quando houver necessidade legítima ou obrigação de preservação do registro.</p>
        </section>

        <section className="sign-section">
          <h2>9. Contato</h2>
          <p>Para dúvidas sobre privacidade ou tratamento de dados, utilize o canal oficial de atendimento da Nassusinfo informado no relacionamento comercial ou em <a href="https://nassusinfo.com.br" target="_blank" rel="noopener noreferrer">nassusinfo.com.br</a>.</p>
        </section>

        <footer className="sign-hash">
          <span>PRIVACIDADE POR PADRÃO</span>
          <small>Este aviso descreve os controles técnicos do Nassus CRM e não substitui avaliação jurídica específica sobre as atividades da empresa.</small>
        </footer>
      </article>
    </main>
  );
}
