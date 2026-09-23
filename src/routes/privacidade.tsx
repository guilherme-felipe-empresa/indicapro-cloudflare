import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — IndicaPro" },
      {
        name: "description",
        content:
          "Como o IndicaPro coleta, usa e protege seus dados pessoais e sua chave PIX, conforme a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — IndicaPro" },
      {
        property: "og:description",
        content: "Como seus dados pessoais e sua chave PIX são tratados no IndicaPro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-6 pb-10">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight">Política de Privacidade</h1>
          <p className="text-xs text-muted-foreground">Última atualização: setembro de 2026</p>
        </header>

        <Section title="1. Dados que coletamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Dados de cadastro: nome, e-mail e telefone.</li>
            <li>Dados de pagamento: chave PIX e o tipo da chave (CPF, CNPJ, e-mail, telefone ou aleatória).</li>
            <li>
              Dados de uso: links de indicação gerados, intenções de compra, comissões, saques e
              mensagens enviadas ao suporte.
            </li>
          </ul>
        </Section>

        <Section title="2. Para que usamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Identificar quem indicou cada venda e calcular a comissão correspondente.</li>
            <li>Realizar o pagamento dos saques solicitados por PIX.</li>
            <li>Prestar atendimento pela Central de Suporte.</li>
            <li>Prevenir fraudes e uso indevido da plataforma.</li>
          </ul>
        </Section>

        <Section title="3. Compartilhamento">
          <p>
            Não vendemos seus dados. As informações são usadas internamente pela nossa equipe e
            pelos serviços de infraestrutura que hospedam a aplicação e o banco de dados. Sua chave
            PIX é utilizada apenas para efetuar o pagamento dos seus saques.
          </p>
        </Section>

        <Section title="4. Segurança e acesso">
          <p>
            Os dados ficam em banco de dados com regras de acesso por usuário: cada pessoa enxerga
            somente as próprias informações; apenas administradores autorizados acessam os dados
            necessários para aprovar vendas e pagar saques. Comprovantes e anexos ficam em
            armazenamento privado, acessível apenas por links temporários.
          </p>
        </Section>

        <Section title="5. Seus direitos (LGPD)">
          <p>
            Você pode solicitar a qualquer momento o acesso, a correção ou a exclusão dos seus
            dados, bem como o encerramento da conta. Alguns registros financeiros podem ser
            mantidos pelo prazo legal necessário. Para exercer esses direitos, abra um chamado na
            Central de Suporte do aplicativo.
          </p>
        </Section>

        <Section title="6. Retenção">
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa e pelo período necessário para
            cumprir obrigações legais, resolver disputas e comprovar pagamentos realizados.
          </p>
        </Section>

        <p className="text-sm text-muted-foreground">
          Veja também os{" "}
          <Link to="/termos" className="underline">
            Termos de Uso
          </Link>
          .
        </p>
      </article>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card space-y-2 p-4 text-sm leading-relaxed text-muted-foreground">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
