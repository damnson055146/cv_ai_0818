import { useDataStore } from "~/composables/stores/data";
import type { DocumentType } from "~/utils/constants/templates";
import { getPsMeta } from "~/utils/ps";

type MaybeDocumentType = DocumentType | "";

interface StoredDocMeta {
  docType?: DocumentType;
  lang?: string;
}

export interface DocumentContext {
  docId: string;
  docIds: string[];
  docType: MaybeDocumentType;
  language: string;
  chatId: string;
}

const DOC_META_PREFIX = "doc_meta_";
const DOC_META_MEMORY_KEY = "__psDocMetaMemory__";

const getGlobal = () => (typeof window !== "undefined" ? window : globalThis) as any;

const getDocMetaMemory = () => {
  const globalObj = getGlobal();
  if (!globalObj[DOC_META_MEMORY_KEY]) globalObj[DOC_META_MEMORY_KEY] = new Map<string, StoredDocMeta>();
  return globalObj[DOC_META_MEMORY_KEY] as Map<string, StoredDocMeta>;
};

const hasWindow = () => typeof window !== "undefined";

const readDocMeta = (docId: string): StoredDocMeta | null => {
  if (!docId) return null;
  const memory = getDocMetaMemory();
  const fromMemory = memory.get(docId);
  if (fromMemory) return fromMemory;
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(DOC_META_PREFIX + docId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDocMeta;
    memory.set(docId, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const setDocMeta = (docId: string, meta: StoredDocMeta & { docType: DocumentType }): void => {
  if (!docId) return;
  const payload: StoredDocMeta & { docType: DocumentType } = { docType: meta.docType };
  if (meta.lang) payload.lang = meta.lang;

  const memory = getDocMetaMemory();
  memory.set(docId, payload);

  if (!hasWindow()) return;
  try {
    localStorage.setItem(DOC_META_PREFIX + docId, JSON.stringify(payload));
  } catch {
    /* no-op */
  }
};

const randomSegment = () => Math.random().toString(36).slice(2, 10);

export const createChatId = (prefix = "chat"): string => {
  const base = Date.now().toString(36);
  return `${prefix}_${base}${randomSegment()}`;
};

export const createDocId = (): string => {
  const timePart = Date.now().toString(36);
  return `${timePart}${randomSegment()}`;
};

export const resolveDocumentContext = (options?: {
  docId?: string | null;
  docTypeHint?: MaybeDocumentType;
  languageHint?: string;
}): DocumentContext => {
  if (!hasWindow()) {
    return {
      docId: "",
      docIds: [],
      docType: options?.docTypeHint || "",
      language: options?.languageHint || "",
      chatId: "",
    };
  }

  let storeDocId: string | null = null;
  try {
    const store = useDataStore();
    storeDocId = store.data.curResumeId;
  } catch {
    storeDocId = null;
  }

  const baseDocId = String(options?.docId ?? storeDocId ?? "").trim();

  const docIds: string[] = [];
  let docType: MaybeDocumentType = options?.docTypeHint || "";
  let language = options?.languageHint || "";
  let chatId = "";

  if (baseDocId) {
    docIds.push(baseDocId);

    const storedMeta = readDocMeta(baseDocId);
    if (storedMeta) {
      if (storedMeta.docType && !docType) docType = storedMeta.docType;
      if (storedMeta.lang && !language) language = storedMeta.lang;
    }

    const psMeta = getPsMeta(baseDocId);
    if (psMeta) {
      docType = "ps";
      chatId = psMeta.chatId;
      if (psMeta.siblingId) docIds.push(psMeta.siblingId);
    }
  }

  if (!chatId && baseDocId) chatId = baseDocId;

  const uniqueDocIds = Array.from(new Set(docIds.filter(Boolean)));

  return {
    docId: baseDocId,
    docIds: uniqueDocIds,
    docType,
    language,
    chatId,
  };
};
