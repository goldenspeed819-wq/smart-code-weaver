import { createFileRoute } from "@tanstack/react-router";
import { Download, Github, Sparkles, GitCommitVertical, Images, SplitSquareHorizontal } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lovable Copilot — editor GitHub com IA em painel flutuante" },
      {
        name: "description",
        content:
          "Extensão flutuante que lê imagens da interface, edita o código do seu repositório GitHub com IA, mostra o diff, comita e envia o resumo para o chat.",
      },
      { property: "og:title", content: "Lovable Copilot — editor GitHub com IA" },
      {
        property: "og:description",
        content: "Painel flutuante com GitHub, multi-IA, diff e commit automático.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  "Baixe o arquivo .zip e descompacte em uma pasta.",
  "Abra chrome://extensions e ative o Modo do desenvolvedor.",
  "Clique em Carregar sem compactação e selecione a pasta.",
  "Abra seu projeto em lovable.dev — o painel aparece no canto inferior direito.",
  "Clique no botão de ligar, cole seu token do GitHub e escolha o repositório.",
];

const features = [
  {
    icon: Github,
    title: "Repositório detectado sozinho",
    body: "Cole o token e a lista de repositórios aparece pronta, com branch padrão e árvore de arquivos.",
  },
  {
    icon: Sparkles,
    title: "Multi-IA com fallback",
    body: "Usa a IA inclusa por padrão; se falhar, tenta OpenAI, Anthropic, Gemini e Groq com suas chaves.",
  },
  {
    icon: Images,
    title: "Lê as imagens da tela",
    body: "Cole ou envie prints da interface: a IA compara com o código atual antes de reescrever.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Diff antes de aplicar",
    body: "Cada alteração aparece linha a linha para você aprovar ou descartar.",
  },
  {
    icon: GitCommitVertical,
    title: "Commit e resumo no chat",
    body: "Ao concluir, o commit é enviado ao GitHub e o relatório volta para o chat automaticamente.",
  },
];

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-chart-2" /> extensão para Chrome
        </span>

        <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Lovable Copilot
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Um painel flutuante que conecta seu repositório do GitHub a várias IAs, edita o código a
          partir das imagens da interface, mostra o diff, comita e devolve o resumo direto no chat.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/lovable-copilot-extension.zip"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Baixar extensão (.zip)
          </a>
        </div>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Como instalar</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-foreground">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
