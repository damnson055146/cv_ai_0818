export default defineNuxtPlugin(() => {
  if (import.meta.dev && typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          // Best-effort unregister to avoid stale caches during local dev
          registration.unregister().catch(() => {});
        }
      })
      .catch(() => {});
  }
});
