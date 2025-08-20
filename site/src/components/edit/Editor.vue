<template>
  <div class="pane-container" v-bind="api.rootProps">
    <div
      v-bind="api.listProps"
      class="hstack h-9 text-sm md:(h-10 text-base) w-full text-c bg-c border-b border-c px-4 space-x-2"
    >
      <button
        v-for="tab in tabList"
        v-bind="api.getTriggerProps({ value: tab.value })"
        :key="tab.value"
        class="relative leading-9 md:leading-10 px-2"
      >
        {{ tab.label }}
        <span
          v-show="api.value == tab.value"
          class="absolute w-full h-0.4 bg-blue-500 dark:bg-blue-400 left-0 bottom-0 rounded"
        />
      </button>
    </div>

    <div class="flex h-full min-h-0">
      <MdSidebar
        class="flex-none border-r border-c bg-c/50"
        :state="sidebarState"
        @toggle-italic="() => toggleInlineWrap('*')"
        @toggle-bold="() => toggleInlineWrap('**')"
        @toggle-span="() => toggleSpan()"
        @toggle-h1="() => toggleLinePrefix('# ')"
        @toggle-h2="() => toggleLinePrefix('## ')"
        @toggle-h3="() => toggleLinePrefix('### ')"
        @toggle-list="() => toggleLinePrefix('- ')"
        @toggle-ol="() => toggleLinePrefix('1. ')"
        @toggle-colon="() => toggleLinePrefix(': ')"
        @wrap-link="(url: string) => wrapLink(url)"
        @wrap-image="(url: string) => wrapImage(url)"
        @wrap-crossref="(name: string) => wrapWith(`[~${name}]`, '')"
        @insert-crossref-def="(name: string) => insertCrossrefDef(name)"
        @add-internship-title="() => insertTemplate('internship-title')"
        @add-internship-entry="() => insertTemplate('internship-entry')"
        @add-campus-title="() => insertTemplate('campus-title')"
        @add-campus-entry="() => insertTemplate('campus-entry')"
        @add-research-title="() => insertTemplate('research-title')"
        @add-research-entry="() => insertTemplate('research-entry')"
        @add-project-title="() => insertTemplate('project-title')"
        @add-project-entry="() => insertTemplate('project-entry')"
        @add-publication-title="() => insertTemplate('pub-title')"
        @add-publication-entry="() => insertTemplate('pub-entry')"
        @add-skills="() => insertTemplate('skills')"
      />
      <ClientOnly>
        <AiToolbar :getSelection="getCurrentSelectionText" :getSelectionRect="getCurrentSelectionRect" :applyText="replaceSelectionText" />
      </ClientOnly>
      <div ref="editorRef" class="flex-1 min-w-0 min-h-0 overflow-auto" h-full />
    </div>
  </div>
  
</template>

<script lang="ts" setup>
import type * as Monaco from "monaco-editor";
import * as tabs from "@zag-js/tabs";
import { normalizeProps, useMachine } from "@zag-js/vue";
import { isClient } from "@renovamen/utils";
import { setupMonacoEditor } from "~/monaco";
import MdSidebar from "~/components/edit/toolbar/MdSidebar.vue";
import { useShortcuts } from "@renovamen/vue-shortcuts";
import AiToolbar from "~/components/edit/toolbar/AiToolbar.vue";

const editorRef = ref<HTMLDivElement>();

let editor:
  | {
      editor: Monaco.editor.IStandaloneCodeEditor;
      models: {
        [key: string]: {
          getModel: () => Monaco.editor.ITextModel;
          activate: () => void;
          dispose: () => void;
        };
      };
      dispose: () => void;
    }
  | undefined;

// Setup Monaco editor
onMounted(async () => {
  if (isClient && editorRef.value && !editor) {
    editor = await setupMonacoEditor(editorRef.value);
    activate("markdown");
    // bind listeners for sidebar state
    const ed = editor.editor;
    ed.onDidChangeCursorSelection(() => refreshSidebarState());
    ed.onDidChangeModelContent(() => refreshSidebarState());
    refreshSidebarState();

    // Ensure paste works even if some global handlers block default behavior
    const pasteHandler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isInputLike = tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable);
      if (isInputLike) return;
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text) return;
      e.preventDefault();
      replaceSelectionText(text);
    };
    window.addEventListener('paste', pasteHandler, true);
    (ed as any)._mdr_pasteHandler = pasteHandler;

    // If user presses Ctrl+V while focus is not in an input, focus editor early
    const keydownFocusForPaste = (e: KeyboardEvent) => {
      const isCtrlV = (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');
      if (!isCtrlV) return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isInputLike = tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable);
      if (isInputLike) return;
      ed.focus();
    };
    window.addEventListener('keydown', keydownFocusForPaste, true);
    (ed as any)._mdr_keydownFocusForPaste = keydownFocusForPaste;
  }
});

onBeforeUnmount(() => {
  if (editor) {
    const ed = editor.editor as any;
    if (ed._mdr_pasteHandler) window.removeEventListener('paste', ed._mdr_pasteHandler, true);
    if (ed._mdr_keydownFocusForPaste) window.removeEventListener('keydown', ed._mdr_keydownFocusForPaste, true);
  }
  editor?.dispose();
});

// Watch the updates of editor content on other places
const { data, toggleMdFlag, toggleCssFlag } = useDataStore();

watch(
  () => data.mdFlag,
  () => {
    if (data.mdFlag) {
      editor?.models["markdown"].getModel().setValue(data.mdContent);
      toggleMdFlag(false);
    }
  }
);

watch(
  () => data.cssFlag,
  () => {
    if (data.cssFlag) {
      editor?.models["css"].getModel().setValue(data.cssContent);
      toggleCssFlag(false);
    }
  }
);

// Change model
const activate = (value: "markdown" | "css") => {
  editor?.models[value].activate();
};

// Tabs UI
const tabList = [
  { value: "markdown", label: "Markdown" },
  { value: "css", label: "CSS" }
];

const [state, send] = useMachine(
  tabs.machine({
    id: "editor",
    value: "markdown",
    onValueChange: (details) => {
      activate(details.value as "markdown" | "css");
    }
  })
);
const api = computed(() => tabs.connect(state.value, send, normalizeProps));

// Markdown operations
const sidebarState = reactive({
  italic: false,
  bold: false,
  span: false,
  h1: false,
  h2: false,
  h3: false,
  ul: false,
  ol: false,
  colon: false,
  link: false,
  image: false,
  crossrefInline: false,
  crossrefDef: false
});

const refreshSidebarState = () => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const sel = ed.getSelection();
  if (!sel) return;

  const hasSelection = !sel.isEmpty();

  const getWrapState = (marker: string) => {
    if (!hasSelection) return false;
    const len = marker.length;
    const left = model.getValueInRange(new (window as any).monaco.Range(
      sel.startLineNumber, Math.max(1, sel.startColumn - len), sel.startLineNumber, sel.startColumn
    ));
    const right = model.getValueInRange(new (window as any).monaco.Range(
      sel.endLineNumber, sel.endColumn, sel.endLineNumber, sel.endColumn + len
    ));
    if (left === marker && right === marker) return true;
    const selectedText = model.getValueInRange(sel);
    return selectedText.startsWith(marker) && selectedText.endsWith(marker);
  };

  const lineText = model.getLineContent(sel.startLineNumber);
  const linePrefix = (p: string) => {
    const m = lineText.match(/^\s*/);
    const i = m ? m[0].length : 0;
    return lineText.slice(i).startsWith(p);
  };

  sidebarState.italic = getWrapState('*');
  sidebarState.bold = getWrapState('**');
  // removed strike/code from basic toolbar
  // span detection (strict selection or boundary at selection edges)
  try {
    const content = hasSelection ? model.getValueInRange(sel) : "";
    const trimmed = content.trim();
    let boundary = false;
    if (hasSelection) {
      const leftSlice = model.getValueInRange(new (window as any).monaco.Range(
        sel.startLineNumber,
        Math.max(1, sel.startColumn - 20),
        sel.startLineNumber,
        sel.startColumn
      ));
      const rightSlice = model.getValueInRange(new (window as any).monaco.Range(
        sel.endLineNumber,
        sel.endColumn,
        sel.endLineNumber,
        Math.min(model.getLineMaxColumn(sel.endLineNumber), sel.endColumn + 20)
      ));
      boundary = /<span(?:\s[^>]*?)?>$/.test(leftSlice) && /^<\/span>/.test(rightSlice);
    }
    sidebarState.span = /^<span[^>]*>.*<\/span>$/.test(trimmed) || boundary;
  } catch { sidebarState.span = false; }
  sidebarState.h1 = linePrefix('# ');
  sidebarState.h2 = linePrefix('## ');
  sidebarState.h3 = linePrefix('### ');
  sidebarState.ul = linePrefix('- ');
  sidebarState.ol = linePrefix('1. ');
  sidebarState.quote = linePrefix('> ');
  sidebarState.colon = linePrefix(': ');
  try {
    const content = hasSelection ? model.getValueInRange(sel).trim() : "";
    // Strict, from-start detection (anchor at both ends)
    sidebarState.link = hasSelection && /^\[[^\]]*?\]\([^)]*?\)$/.test(content);
    sidebarState.image = hasSelection && /^!\[[^\]]*?\]\([^)]*?\)$/.test(content);
    sidebarState.crossrefInline = hasSelection && /^\[~[^\]]+\]$/.test(content);
  } catch {
    sidebarState.link = false;
    sidebarState.image = false;
    sidebarState.crossrefInline = false;
  }

  // Crossref definition on current line start (ignore indent)
  const line = model.getLineContent(sel.startLineNumber);
  const indentMatch = line.match(/^\s*/);
  const indentLen = indentMatch ? indentMatch[0].length : 0;
  sidebarState.crossrefDef = /^\[~[^\]]+\]:\s/.test(line.slice(indentLen));
};


const toggleInlineWrap = (marker: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const markerLen = marker.length;
  const hasSelection = !selection.isEmpty();

  if (!hasSelection) {
    ed.executeEdits("md-inline-wrap", [
      {
        range: selection,
        text: `${marker}${marker}`,
        forceMoveMarkers: true
      }
    ]);
    const pos = ed.getPosition();
    if (pos) ed.setPosition({ lineNumber: pos.lineNumber, column: pos.column - markerLen });
    return;
  }

  const selectedText = model.getValueInRange(selection);

  const leftRange = new (window as any).monaco.Range(
    selection.startLineNumber,
    Math.max(1, selection.startColumn - markerLen),
    selection.startLineNumber,
    selection.startColumn
  );
  const rightRange = new (window as any).monaco.Range(
    selection.endLineNumber,
    selection.endColumn,
    selection.endLineNumber,
    selection.endColumn + markerLen
  );

  const leftText = model.getValueInRange(leftRange);
  const rightText = model.getValueInRange(rightRange);

  if (leftText === marker && rightText === marker) {
    // unwrap
    ed.executeEdits("md-inline-unwrap", [
      { range: rightRange, text: "", forceMoveMarkers: true },
      { range: leftRange, text: "", forceMoveMarkers: true }
    ]);
    // keep selecting inner text
    ed.setSelection(selection);
  } else if (selectedText.startsWith(marker) && selectedText.endsWith(marker)) {
    // unwrap when markers are inside the selection
    ed.executeEdits("md-inline-unwrap-inside", [
      { range: selection, text: selectedText.slice(markerLen, selectedText.length - markerLen), forceMoveMarkers: true }
    ]);
    ed.setSelection(selection);
  } else {
    // wrap
    ed.executeEdits("md-inline-wrap", [
      { range: selection, text: `${marker}${selectedText}${marker}`, forceMoveMarkers: true }
    ]);
    // reselect entire region including markers so next toggle can detect correctly
    const sel = new (window as any).monaco.Selection(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.endColumn + markerLen * 2
    );
    ed.setSelection(sel);
  }
};

const toggleLinePrefix = (prefix: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;

  const lines = [] as { num: number; text: string }[];
  for (let i = startLine; i <= endLine; i++) {
    lines.push({ num: i, text: model.getLineContent(i) });
  }
  const allPrefixed = lines.every((l) => {
    const m = l.text.match(/^\s*/);
    const i = m ? m[0].length : 0;
    return l.text.slice(i).startsWith(prefix);
  });

  const edits = lines.map((l) => {
    const m = l.text.match(/^\s*/);
    const i = m ? m[0].length : 0;
    if (allPrefixed) {
      return {
        range: new (window as any).monaco.Range(l.num, i + 1, l.num, i + 1 + prefix.length),
        text: "",
        forceMoveMarkers: true
      };
    }
    return {
      range: new (window as any).monaco.Range(l.num, i + 1, l.num, i + 1),
      text: prefix,
      forceMoveMarkers: true
    };
  });

  ed.executeEdits("md-line-prefix", edits as any);

  // keep selection covering the affected lines
  const lastLineLen = model.getLineMaxColumn(endLine);
  const newSel = new (window as any).monaco.Selection(
    startLine,
    1,
    endLine,
    lastLineLen
  );
  ed.setSelection(newSel);
};

const wrapWith = (before: string, after: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const hasSelection = !selection.isEmpty();
  if (!hasSelection) return;

  const beforeLen = before.length;
  const afterLen = after.length;

  const leftRange = new (window as any).monaco.Range(
    selection.startLineNumber,
    Math.max(1, selection.startColumn - beforeLen),
    selection.startLineNumber,
    selection.startColumn
  );
  const rightRange = new (window as any).monaco.Range(
    selection.endLineNumber,
    selection.endColumn,
    selection.endLineNumber,
    selection.endColumn + afterLen
  );

  const leftText = model.getValueInRange(leftRange);
  const rightText = model.getValueInRange(rightRange);

  const selectedText = model.getValueInRange(selection);

  if (leftText === before && rightText === after) {
    ed.executeEdits("md-wrap-unwrap", [
      { range: rightRange, text: "", forceMoveMarkers: true },
      { range: leftRange, text: "", forceMoveMarkers: true }
    ]);
    ed.setSelection(selection);
  } else if (selectedText.startsWith(before) && (after === "" || selectedText.endsWith(after))) {
    // unwrap when markers are inside the selection
    const startOffset = before.length;
    const endOffset = after.length;
    ed.executeEdits("md-wrap-unwrap-inside", [
      { range: selection, text: selectedText.slice(startOffset, endOffset ? selectedText.length - endOffset : undefined), forceMoveMarkers: true }
    ]);
    ed.setSelection(selection);
  } else {
    ed.executeEdits("md-wrap-wrap", [
      { range: selection, text: `${before}${selectedText}${after}` as string, forceMoveMarkers: true }
    ]);
    const sel = new (window as any).monaco.Selection(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.endColumn + beforeLen + afterLen
    );
    ed.setSelection(sel);
  }
};

const insertCrossrefDef = (name: string) => {
  if (!editor || !name) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const position = ed.getPosition();
  if (!position) return;

  const lineNumber = position.lineNumber;
  const lineText = model.getLineContent(lineNumber);
  const prefix = `[~${name}]: `;
  if (lineText.startsWith(prefix)) {
    ed.executeEdits("md-crossref-def-remove", [
      {
        range: new (window as any).monaco.Range(lineNumber, 1, lineNumber, 1 + prefix.length),
        text: "",
        forceMoveMarkers: true
      }
    ]);
  } else {
    ed.executeEdits("md-crossref-def-insert", [
      {
        range: new (window as any).monaco.Range(lineNumber, 1, lineNumber, 1),
        text: prefix,
        forceMoveMarkers: true
      }
    ]);
  }
};

// Keyboard shortcuts
useShortcuts("ctrl+b", () => toggleInlineWrap("**"));
useShortcuts("ctrl+i", () => toggleInlineWrap("*"));
useShortcuts("ctrl+shift+s", () => toggleSpan());
useShortcuts("ctrl+shift+\'", () => toggleLinePrefix("> "));
useShortcuts("ctrl+shift+l", () => toggleLinePrefix("- "));
useShortcuts("ctrl+shift+1", () => toggleLinePrefix("1. "));
useShortcuts("ctrl+shift+2", () => toggleLinePrefix("## "));
useShortcuts("ctrl+shift+3", () => toggleLinePrefix("### "));
useShortcuts("ctrl+shift+`", () => toggleCodeBlock());

const wrapLink = (url: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const text = model.getValueInRange(selection) || "link";
  const before = `[${text}](`;
  const after = ")";

  const beforeLen = before.length;
  const afterLen = after.length;

  const leftRange = new (window as any).monaco.Range(
    selection.startLineNumber,
    Math.max(1, selection.startColumn - beforeLen),
    selection.startLineNumber,
    selection.startColumn
  );
  const rightRange = new (window as any).monaco.Range(
    selection.endLineNumber,
    selection.endColumn,
    selection.endLineNumber,
    selection.endColumn + afterLen
  );

  const leftText = model.getValueInRange(leftRange);
  const rightText = model.getValueInRange(rightRange);

  if (leftText === before && rightText === after) {
    ed.executeEdits("md-link-unwrap", [
      { range: rightRange, text: "", forceMoveMarkers: true },
      { range: leftRange, text: "", forceMoveMarkers: true }
    ]);
  } else if (/^\[[^\]]*?\]\([^)]*?\)$/.test(model.getValueInRange(selection))) {
    const m = model.getValueInRange(selection).match(/^\[([^\]]*?)\]\(([^)]*?)\)$/);
    const inner = m ? m[1] : "";
    ed.executeEdits("md-link-unwrap-inside", [
      { range: selection, text: inner, forceMoveMarkers: true }
    ]);
  } else {
    ed.executeEdits("md-link-wrap", [
      { range: selection, text: `${before}${url || ''}${after}`, forceMoveMarkers: true }
    ]);
    // select inner text (inside square brackets)
    const newSel = new (window as any).monaco.Selection(
      selection.startLineNumber,
      selection.startColumn + 1,
      selection.endLineNumber,
      selection.endColumn + 1
    );
    ed.setSelection(newSel);
  }
};

const wrapImage = (url: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const alt = model.getValueInRange(selection) || "alt";
  const text = `![${alt}](${url || ''})`;
  ed.executeEdits("md-image-insert", [
    { range: selection, text, forceMoveMarkers: true }
  ]);
  // select alt text inside []
  const newSel = new (window as any).monaco.Selection(
    selection.startLineNumber,
    selection.startColumn + 2,
    selection.endLineNumber,
    selection.startColumn + 2 + alt.length
  );
  ed.setSelection(newSel);
};

const toggleCodeBlock = () => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const start = selection.startLineNumber;
  const end = selection.endLineNumber;

  const firstLine = model.getLineContent(start);
  const lastLine = model.getLineContent(end);

  const isWrapped = firstLine.trim().startsWith("```") && lastLine.trim().endsWith("```");

  if (isWrapped) {
    // remove first and last code fence lines
    ed.executeEdits("md-codeblock-remove", [
      { range: new (window as any).monaco.Range(end, 1, end, lastLine.length + 1), text: "", forceMoveMarkers: true },
      { range: new (window as any).monaco.Range(start, 1, start, firstLine.length + 1), text: "", forceMoveMarkers: true }
    ]);
  } else {
    // insert fences
    ed.executeEdits("md-codeblock-insert", [
      { range: new (window as any).monaco.Range(end, lastLine.length + 1, end, lastLine.length + 1), text: "\n```", forceMoveMarkers: true },
      { range: new (window as any).monaco.Range(start, 1, start, 1), text: "```\n", forceMoveMarkers: true }
    ]);
  }

  // keep selecting the original block
  const newSel = new (window as any).monaco.Selection(
    start,
    1,
    end,
    model.getLineMaxColumn(end)
  );
  ed.setSelection(newSel);
};

// Selection helpers for AI toolbar
const getCurrentSelectionText = () => {
  if (!editor) return "";
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return "";
  const selection = ed.getSelection();
  if (!selection || selection.isEmpty()) return "";
  return model.getValueInRange(selection);
};

const replaceSelectionText = (text: string) => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;
  const selected = model.getValueInRange(selection);

  // Preserve wrappers when selection fully equals a wrapped structure
  const tryReplaceInner = (
    pattern: RegExp,
    build: (match: RegExpMatchArray) => string
  ): boolean => {
    const m = selected.match(pattern);
    if (!m) return false;
    const replacement = build(m);
    ed.executeEdits("ai-rewrite-preserve", [
      { range: selection, text: replacement, forceMoveMarkers: true }
    ]);
    return true;
  };

  // Link: [text](url)
  if (tryReplaceInner(/^\[([^\]]*?)\]\(([^)]*?)\)$/s, (m) => `[${text}](${m[2]})`)) return;
  // Image: ![alt](url)
  if (tryReplaceInner(/^!\[([^\]]*?)\]\(([^)]*?)\)$/s, (m) => `![${text}](${m[2]})`)) return;
  // Span: <span ...>inner</span>
  if (tryReplaceInner(/^(<span[^>]*>)([\s\S]*?)(<\/span>)$/s, (m) => `${m[1]}${text}${m[3]}`)) return;
  // Inline markers **, *, ~~, `
  if (tryReplaceInner(/^(\*\*|\*|~~|`)([\s\S]*?)\1$/s, (m) => `${m[1]}${text}${m[1]}`)) return;

  // Fallback: replace selection as-is (or insert at caret if empty)
  ed.executeEdits("ai-rewrite", [
    { range: selection, text, forceMoveMarkers: true }
  ]);
};

const getCurrentSelectionRect = () => {
  if (!editor || !editorRef.value) return { x: 0, y: 0, visible: false } as { x: number; y: number; visible: boolean };
  const ed = editor.editor as any;
  const model = ed.getModel();
  if (!model) return { x: 0, y: 0, visible: false };
  const selection = ed.getSelection();
  if (!selection || selection.isEmpty()) return { x: 0, y: 0, visible: false };
  const start = selection.getStartPosition();
  const vp = ed.getScrolledVisiblePosition(start);
  if (!vp) return { x: 0, y: 0, visible: false };
  const rect = (editorRef.value as HTMLElement).getBoundingClientRect();
  return {
    x: rect.left + window.scrollX + vp.left,
    y: rect.top + window.scrollY + vp.top,
    visible: true
  };
};

const toggleSpan = () => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;

  const text = model.getValueInRange(selection);
  const closeTag = "</span>";

  // Case 1: selection contains full <span ...>...</span>
  const openTagMatch = text.match(/^<span[^>]*>/);
  if (openTagMatch && text.endsWith(closeTag)) {
    const inner = text.slice(openTagMatch[0].length, text.length - closeTag.length);
    ed.executeEdits("md-span-unwrap", [
      { range: selection, text: inner, forceMoveMarkers: true }
    ]);
    const newSel = new (window as any).monaco.Selection(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.startColumn + inner.length
    );
    ed.setSelection(newSel);
    return;
  }

  // Case 2: selection is the inner content while tags are outside selection boundaries
  const leftSliceRange = new (window as any).monaco.Range(
    selection.startLineNumber,
    Math.max(1, selection.startColumn - 64),
    selection.startLineNumber,
    selection.startColumn
  );
  const rightSliceRange = new (window as any).monaco.Range(
    selection.endLineNumber,
    selection.endColumn,
    selection.endLineNumber,
    Math.min(model.getLineMaxColumn(selection.endLineNumber), selection.endColumn + closeTag.length + 32)
  );
  const leftSlice = model.getValueInRange(leftSliceRange);
  const rightSlice = model.getValueInRange(rightSliceRange);
  const leftTagMatch = leftSlice.match(/<span(?:\s[^>]*?)?>$/);
  const rightTagMatch = rightSlice.match(/^<\/span>/);

  if (leftTagMatch && rightTagMatch) {
    const leftLen = leftTagMatch[0].length;
    const rightLen = "</span>".length;
    const rightRange = new (window as any).monaco.Range(
      selection.endLineNumber,
      selection.endColumn,
      selection.endLineNumber,
      selection.endColumn + rightLen
    );
    const leftRange = new (window as any).monaco.Range(
      selection.startLineNumber,
      selection.startColumn - leftLen,
      selection.startLineNumber,
      selection.startColumn
    );
    ed.executeEdits("md-span-unwrap-boundary", [
      { range: rightRange, text: "", forceMoveMarkers: true },
      { range: leftRange, text: "", forceMoveMarkers: true }
    ]);
    const newSel = new (window as any).monaco.Selection(
      selection.startLineNumber,
      selection.startColumn - leftLen,
      selection.endLineNumber,
      selection.endColumn - leftLen - rightLen
    );
    ed.setSelection(newSel);
    return;
  }

  // Case 3: wrap
  const before = "<span>";
  const after = "</span>";
  ed.executeEdits("md-span-wrap", [
    { range: selection, text: `${before}${text}${after}`, forceMoveMarkers: true }
  ]);
  const newSel = new (window as any).monaco.Selection(
    selection.startLineNumber,
    selection.startColumn + before.length,
    selection.endLineNumber,
    selection.endColumn + before.length
  );
  ed.setSelection(newSel);
};

const insertTemplate = (type: 'internship-title' | 'internship-entry' | 'campus-title' | 'campus-entry' | 'research-title' | 'research-entry' | 'project-title' | 'project-entry' | 'pub-title' | 'pub-entry' | 'skills') => {
  if (!editor) return;
  const ed = editor.editor;
  const model = ed.getModel();
  if (!model) return;
  const selection = ed.getSelection();
  if (!selection) return;
  const templates: Record<string, string> = {
    'internship-title': `## Internship Experience\n\n**<Company>**\n  : ****\n  : **<Company Address>**\n\n**<Position>**\n  : ****\n  : **<Period>**\n\n- <Responsibility 1>\n- <Responsibility 2>\n- <Responsibility 3>\n\n`,
    'internship-entry': `**<Company>**\n  : ****\n  : **<Company Address>**\n\n**<Position>**\n  : ****\n  : **<Period>**\n\n- <Responsibility 1>\n- <Responsibility 2>\n- <Responsibility 3>\n\n`,
    'campus-title': `## Campus Activity\n\n**<University Name>**\n\n**<Department/Club/Organization>**\n  : ****\n  : **<Period>**\n\n- <Responsibility 1>\n- <Responsibility 2>\n- <Responsibility 3>\n\n`,
    'campus-entry': `**<University Name>**\n\n**<Department/Club/Organization>**\n  : ****\n  : **<Period>**\n\n- <Responsibility 1>\n- <Responsibility 2>\n- <Responsibility 3>\n\n`,
    'research-title': `## Research Experience\n\n**<Research Title>**\n****\n\n**<Position / Role>**\n  : **<Date / Range>**\n\n- <Contribution 1>\n- <Contribution 2>\n- <Contribution 3>\n\n`,
    'research-entry': `**<Research Title>**\n****\n\n**<Position / Role>**\n  : **<Date / Range>**\n\n- <Contribution 1>\n- <Contribution 2>\n- <Contribution 3>\n\n`,
    'project-title': `## Project Experience\n\n**<Project Name>**\n  : **<Tech Stack / Role>**\n  : **<Date Range>**\n\n- <Highlight 1>\n- <Highlight 2>\n- <Highlight 3>\n\n`,
    'project-entry': `**<Project Name>**\n  : **<Tech Stack / Role>**\n  : **<Date Range>**\n\n- <Highlight 1>\n- <Highlight 2>\n- <Highlight 3>\n\n`,
    'pub-title': `## Publications\n\n[~P1]: **<Paper Title>**\n\n    <u><First Author></u>, <Coauthor A>, <Coauthor B>\n\n    *<Venue, Year>*\n\n`,
    'pub-entry': `[~P1]: **<Paper Title>**\n\n    <u><First Author></u>, <Coauthor A>, <Coauthor B>\n\n    *<Venue, Year>*\n\n`
    ,
    'skills': `## Skills\n\n**Programming Languages:** <span class="iconify" data-icon="vscode-icons:file-type-python"></span> Python, <span class="iconify" data-icon="vscode-icons:file-type-js-official"></span> JavaScript / <span class="iconify" data-icon="vscode-icons:file-type-typescript-official"></span> TypeScript, <span class="iconify" data-icon="vscode-icons:file-type-html"></span> HTML / <span class="iconify" data-icon="vscode-icons:file-type-css"></span> CSS, <span class="iconify" data-icon="logos:java" data-inline="false"></span> Java\n\n**Tools and Frameworks:** Git, PyTorch, Keras, scikit-learn, Linux, Vue, React, Django, $\\LaTeX$\n\n**Languages:** English (proficient), Indonesia (native)\n\n`
  };
  const text = templates[type];
  ed.executeEdits('insert-template', [
    { range: selection, text, forceMoveMarkers: true }
  ]);
};
</script>
