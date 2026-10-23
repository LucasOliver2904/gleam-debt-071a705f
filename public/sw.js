// public/sw.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: '/favicon.png', // usa o ícone que você já tem
      badge: '/favicon.png',
      vibrate: [200, 100, 200],
    });
  }
});