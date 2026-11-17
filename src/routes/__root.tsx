import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/AuthGate";
import { ReminderAgent } from "@/components/ReminderAgent";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço pode ter mudado ou não existir mais.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta tela
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um problema inesperado. Tente recarregar esta tela ou volte ao painel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao painel
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // App financeiro privado: páginas, autenticação e dados só são renderizados no navegador.
  // Evita execução de integrações de browser durante SSR e falhas 500 ao abrir pelo Android.
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Prumo — Seu controle financeiro" },
      { name: "description", content: "Prumo: entradas, despesas, Pix, repasses, parcelas, vencimentos, orçamento e metas num só lugar." },
      { name: "theme-color", content: "#07131A" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "application-name", content: "Prumo" },
      { name: "mobile-web-app-capable", content: "yes" },

    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest?v=5" },
      { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg?v=5" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png?v=5" },
      { rel: "shortcut icon", href: "/favicon.ico?v=5" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=5" },
    ],
  }),
  shellComponent: RootShell,
  pendingComponent: () => <div role="status" className="flex min-h-screen items-center justify-center bg-background px-5 text-sm text-muted-foreground">Abrindo Prumo…</div>,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>O Prumo precisa de JavaScript para carregar seu painel financeiro.</noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    document.documentElement.dataset["theme"] = localStorage.getItem("meu-caixa-theme") === "light" ? "light" : "dark";
    const savedAccent = localStorage.getItem("meu-caixa-accent");
    document.documentElement.dataset["accent"] = savedAccent === "ocean" || savedAccent === "violet" ? savedAccent : "emerald";
    // Registro necessário para os avisos do navegador e instalação do app.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=5', { updateViaCache: 'none' }).catch(console.error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AuthGate>
        <ReminderAgent />
        <Outlet />
      </AuthGate>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}