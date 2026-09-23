import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — IndicaPro" },
      {
        name: "description",
        content:
          "Regras do programa de indicação IndicaPro: comissões, aprovação de vendas, saques via PIX e conduta.",
      },
      { property: "og:title", content: "Termos de Uso — IndicaPro" },
      {
        property: "og:description",
        content: "Regras de comissões, aprovação de vendas e saques via PIX do IndicaPro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-6 pb-10">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight">Termos de Uso</h1>
          <p className="text-xs text-muted-foreground">Última atualização: setembro de 2026</p>
        </header>

        <Section title="1. Sobre o programa">
          <p>
            O IndicaPro é uma plataforma de indicação de produtos. Ao criar uma conta, você passa a
            poder gerar links de indicação e receber comissões pelas vendas confirmadas que tenham
            sido originadas por esses links.
          </p>
        </Section>

        <Section title="2. Conta e dados cadastrais">
          <p>
            Você é responsável pela veracidade dos dados informados (nome, e-mail, telefone e chave
            PIX) e pelo sigilo da sua senha. Contas com dados falsos, duplicadas ou usadas para
            fraude podem ser bloqueadas sem aviso prévio.
          </p>
        </Section>

        <Section title="3. Como a comissão é gerada">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              O cliente acessa o produto pelo seu link de indicação e finaliza a conversa de compra
              pelo WhatsApp.
            </li>
            <li>
              Cada intenção de compra recebe um código único (ex.: IND-XXXXXX) usado para
              identificar a indicação.
            </li>
            <li>
              A comissão só é creditada após a equipe confirmar o pagamento da venda e registrar o
              comprovante no painel administrativo.
            </li>
            <li>
              Vendas canceladas, estornadas, não pagas ou sem comprovação não geram comissão.
            </li>
          </ul>
        </Section>

        <Section title="4. Saques via PIX">
          <ul className="list-disc space-y-1 pl-5">
            <li>O saque exige uma chave PIX válida cadastrada no seu perfil e em seu nome.</li>
            <li>Há um valor mínimo de saque, informado na tela da Carteira.</li>
            <li>
              O valor solicitado fica reservado até o pagamento e os saques são processados
              manualmente em dias úteis.
            </li>
            <li>
              Chave PIX incorreta ou de terceiros pode causar recusa do saque; o valor retorna ao
              saldo disponível.
            </li>
          </ul>
        </Section>

        <Section title="5. Conduta proibida">
          <ul className="list-disc space-y-1 pl-5">
            <li>Envio de spam, mensagens em massa não solicitadas ou compra de tráfego enganoso.</li>
            <li>Promessas falsas sobre produtos, preços, prazos ou resultados.</li>
            <li>Autoindicação, contas múltiplas ou pedidos simulados para gerar comissão.</li>
            <li>Uso da marca ou das imagens dos produtos de forma indevida.</li>
          </ul>
          <p>
            A violação destas regras pode resultar em cancelamento das comissões pendentes e
            bloqueio da conta.
          </p>
        </Section>

        <Section title="6. Alterações e contato">
          <p>
            Podemos atualizar estes termos e as condições de comissão a qualquer momento; a versão
            vigente é sempre a publicada nesta página. Dúvidas podem ser enviadas pela Central de
            Suporte dentro do aplicativo.
          </p>
        </Section>

        <p className="text-sm text-muted-foreground">
          Veja também a{" "}
          <Link to="/privacidade" className="underline">
            Política de Privacidade
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
