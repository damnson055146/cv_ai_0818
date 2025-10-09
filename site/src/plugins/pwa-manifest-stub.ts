export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.dev) return;
  nuxtApp.vueApp.component("VitePwaManifest", {
    render: () => null
  });
});
