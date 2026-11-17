export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1b2c" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Prumo — Não foi possível carregar</title>
    <style>
      :root {color-scheme:dark}
      * {box-sizing:border-box}
      body {margin:0; padding:24px; min-height:100dvh; font:15px/1.5 system-ui,-apple-system,sans-serif; color:#f4faf9; background:radial-gradient(ellipse at 20% 0%,#17453f,#0d1b2c 60%); display:grid;place-items:center}
      main {width:100%;max-width:450px;padding:30px 24px;border:1px solid #31534d;background:#15293a;border-radius:24px;box-shadow:0 22px 60px #07111b70;text-align:center}
      svg {width:62px;height:62px;margin:0 auto 12px;display:block}
      h1 {font-size:22px;line-height:1.2;margin:12px 0;font-weight:800;letter-spacing:-.025em}
      p {margin:0;color:#b7c9d0;font-size:14px}
      .actions {display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px}
      a {padding:12px 18px;border-radius:12px;color:#0b241b;background:#65e9b9;text-decoration:none;font-weight:750}
      .secondary {background:transparent;color:#e4f6f2;border:1px solid #5a776f}
      .note {font-size:12px;margin-top:20px}
      a:focus-visible {outline:3px solid #fff;outline-offset:3px}
    </style>
  </head>
  <body>
    <main>
      <svg aria-hidden="true" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="18" fill="#0a513d"/><path d="M12 25q0-8 8-8h23a8 8 0 0 1 8 8v26H20q-8 0-8-8V25z" fill="#22d9a2"/><path d="M15 28h39v18H15z" fill="#13745e"/><path d="M43 31h12v13H43a6 6 0 0 1 0-13z" fill="#ffe184"/><circle cx="47" cy="37.5" r="2" fill="#155544"/></svg>
      <h1>Não foi possível abrir o Prumo</h1>
      <p>O aplicativo encontrou uma falha temporária. Seus dados não foram apagados por esta tela.</p>
      <div class="actions">
        <a href="/">Tentar novamente</a>
        <a href="/ajustes" class="secondary">Ajustes</a>
      </div>
      <p class="note">Se persistir, abra o endereço pelo Chrome. Não limpe os dados do aplicativo sem antes conferir seu backup.</p>
    </main>
  </body>
</html>`;
}
