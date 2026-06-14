/// <reference lib="webworker" />

// To prevent TS errors with the Service Worker Global Scope
const sw = self as any;

// --- Web Push Handling (Module 7 & 8) ---
sw.addEventListener("push", (event: any) => {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "New Notification", body: event.data.text() };
    }
    
    const title = data.title || "FaceSnap Notification";
    const options = {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/dashboard",
      },
    };

    event.waitUntil(sw.registration.showNotification(title, options));
  }
});

sw.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes("facesnap") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
    })
  );
});

// --- Background Sync (Module 6 & 16) ---
// When the app regains connectivity, we can dispatch events to the client
// However, since background sync API is not perfectly supported in all browsers,
// we mostly rely on our `idb` hooks in `offlineSync.ts` in the browser tab.
// This is a progressive enhancement for browsers that DO support the SyncManager.
sw.addEventListener("sync", (event: any) => {
  if (event.tag === "sync-messages") {
    // We notify the clients to perform sync
    event.waitUntil(
      sw.clients.matchAll().then((clients: any) => {
        clients.forEach((client: any) => {
          client.postMessage({ type: "SYNC_MESSAGES" });
        });
      })
    );
  } else if (event.tag === "sync-uploads") {
    event.waitUntil(
      sw.clients.matchAll().then((clients: any) => {
        clients.forEach((client: any) => {
          client.postMessage({ type: "SYNC_UPLOADS" });
        });
      })
    );
  }
});
