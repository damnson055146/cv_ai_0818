/* eslint-disable */

import type { AttributifyAttributes } from "@unocss/preset-attributify";

declare interface Window {
  // extend the window
  monaco: typeof m | undefined;
  MonacoEnvironment: Environment;
}

declare module "*.vue" {
  import { type DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@vue/runtime-dom" {
  interface HTMLAttributes extends AttributifyAttributes {}
}

// PDF.js ESM worker url import
declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const url: string
  export default url
}