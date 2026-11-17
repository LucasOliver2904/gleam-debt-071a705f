/* Service worker do Prumo.
 * Exibe avisos locais enquanto a aplicação está em uso; push remoto só
 * funcionará após configurar um emissor autenticado e o servidor de push. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const title = String(event.data.title || "Prumo");
    const body = String(event.data.body || "");
    event.waitUntil(self.registration.showNotification(title, {
      body, icon: "/icons/icon-192.png?v=4", badge: "/favicon.png?v=4",
      tag: "meu-caixa-vencimentos", data: { url: "/" },
    }));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { body: event.data.text() }; }
  const title = String(payload.title || "Lembrete do Prumo");
  const body = String(payload.body || "Confira suas contas próximas do vencimento.");
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: "/icons/icon-192.png?v=4", badge: "/favicon.png?v=4",
    tag: "meu-caixa-vencimentos", data: { url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if (client.navigate) await client.navigate("/");
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow("/");
    })
  );
});
