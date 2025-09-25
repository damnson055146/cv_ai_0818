import { pwa } from "./configs/pwa";
import { i18n } from "./configs/i18n";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
// Prefer standard .env mechanism (works in dev and on many hosts)
dotenv.config();
// Also try site/configs/.env during dev/start
dotenv.config({ path: "./configs/.env" });
const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: "src/",
  // Disable Vue Inspector to avoid dev transform conflicts on complex templates
  devtools: { enabled: false },

  modules: [
    "@vueuse/nuxt",
    "@unocss/nuxt",
    "@pinia/nuxt",
    "@nuxtjs/i18n",
    "@nuxtjs/color-mode",
    "@vite-pwa/nuxt",
    "nuxt-simple-sitemap"
  ],

  css: [
    "@unocss/reset/tailwind.css",
    "katex/dist/katex.min.css",
    "~/assets/css/index.css"
  ],

  components: [
    {
      path: "~/components",
      pathPrefix: false
    }
  ],

  i18n,

  runtimeConfig: {
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    // Token for MCP queue API auth (optional)
    mcpQueueToken: process.env.MCP_QUEUE_TOKEN || "",
    // SiliconFlow server-side key (preferred: server-only)
    siliconFlowApiKey: process.env.SILICON_FLOW_API_KEY || "",
    public: {
      // FastAPI backend base (absolute). Use env when provided; otherwise leave blank
      // so client code falls back to same-origin relative `/api/*`.
      backendBase: (process.env.FASTAPI_BASE_URL || "").replace(/\/$/, ''),
      // SiliconFlow client-visible helpers (no secrets)
      // Lowercase keys are what server reads: config.public.siliconFlowBaseUrl / siliconFlowModel
      siliconFlowBaseUrl: process.env.SILICON_FLOW_BASE_URL || "https://api.siliconflow.cn/v1",
      siliconFlowModel: process.env.SILICON_FLOW_MODEL || "Qwen/Qwen2.5-7B-Instruct",
      // Back-compat: some code checks config.public.SILICON_FLOW_API_KEY
      SILICON_FLOW_API_KEY: process.env.SILICON_FLOW_API_KEY || "",
      googleFontsKey: "",
      chatbot: {
        provider: "openai", // control in config file
        model: "gpt-5", // default and only model id
        // Hide Chatbot floating bubble on specific routes (exact match)
        // Control routes in config file as required
        bubbleHiddenRoutes: ["/", "/en", "/sp", "/zh-cn"],
        // Build chatbot API base: prefer absolute FASTAPI_BASE_URL if set, else relative path
        // which works behind a reverse proxy (same-origin).
        apiBase: (process.env.FASTAPI_BASE_URL
          ? `${process.env.FASTAPI_BASE_URL.replace(/\/$/, '')}/api/ai`
          : "/api/ai"),
        gpt5Extras: false, // include gpt-5 extras (verbosity/reasoning_effort) by default
        responseFormat: {
          enabled: false,
          schema: {
            type: "object",
            properties: {
              steps: { type: "array", items: { type: "string" } },
              final_answer: { type: "string" }
            },
            required: ["steps", "final_answer"],
            additionalProperties: false
          }
        },
        models: [
          {
            id: "gpt-5",
            label: "GPT‑5",
            apiBase: "https://api.openai.com/v1/chat/completions",
            apiModel: "gpt-5",
            general: {
              temperature: { min: 0, max: 2, step: 0.1, default: 1 },
              max_tokens: { min: 16, max: 32768, step: 16, default: 2048 }
            },
            specific: {
              verbosity: { type: "enum", options: ["low", "medium", "high"], default: "medium" },
              reasoning_effort: { type: "enum", options: ["low", "medium", "high"], default: "medium" }
            }
          }
        ]
      } as any,
      // MCP public config for client polling
      mcp: {
        enabled: true,
        queueToken: process.env.MCP_QUEUE_TOKEN || ""
      },
      psPrompts: {
        // Configure base paths via env to allow Docker/host overrides
        baseDir: process.env.PS_PROMPTS_BASE_DIR || "C:/Users/PSJ/Desktop/bridge_to_future/cursor_ps_test/ps_test(1)/ps_test",
        files: {
          ps_requirement: process.env.PS_PROMPT_REQUIREMENT || "info_ps_requirement.md",
          guidance_outline: process.env.PS_PROMPT_GUIDANCE_OUTLINE || "guidance_outline.md",
          guidance_element: process.env.PS_PROMPT_GUIDANCE_ELEMENT || "guidance_element.md"
        }
      },
      // PS creation behavior flags (controlled in config file)
      ps: {
        requireUpload: false,
        allowedUploadTypes: [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".md",
          ".txt",
          ".doc",
          ".docx"
        ]
      },
      rec: {
        requireUpload: true,
        allowedUploadTypes: [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".md",
          ".txt",
          ".doc",
          ".docx"
        ]
      }
    }
  },

  colorMode: {
    preference: "light",
    classSuffix: ""
  },

  app: {
    // If host it on https://example.com
    //    baseURL: '/'
    // Else if host it on https://example.com/resume
    //    baseURL: '/resume/'
    baseURL: process.env.NUXT_APP_BASE_URL || '/', // override with NUXT_APP_BASE_URL='/' in dev
    buildAssetsDir: 'assets', // don't use "_" at the begining of the folder name to avoids
    head: {
      viewport: "width=device-width,initial-scale=1",
      link: [
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#222" }
      ],
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "application-name", content: "md_ai_cv" },
        { name: "apple-mobile-web-app-title", content: "md_ai_cv" },
        { name: "msapplication-TileColor", content: "#fff" },
        { property: "og:type", content: "website" }
      ]
    }
  },

  site: {
    // Must be absolute for nuxt-site-config / sitemap
    url: SITE_URL
  },

  pwa,

  vite: {
    resolve: {
      alias: {
        "/css": fileURLToPath(new URL("./src/assets/css", import.meta.url))
      }
    }
  },

  // Enable external access in dev when running locally or in Docker
  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3000)
  },

});
