<template>
  <div class="file-options hstack space-x-2">
    <button :aria-label="$t('resumes.saveas')" @click="saveResumesToLocal">
      <span i-ic:baseline-save-as text-lg />
      <span>{{ $t("resumes.saveas") }}</span>
    </button>

    <Dialog
      id="import-md-home"
      :title="$t('import.title')"
      icon="i-mdi:upload"
      box-class="w-full md:w-96"
    >
      <template #button>
        <button :aria-label="$t('resumes.import')">
          <span i-ic:round-upload-file text-lg />
          <span>{{ $t("resumes.import") }}</span>
        </button>
      </template>
      <template #content>
        <ImportDialogContent />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import { useShortcuts } from "@renovamen/vue-shortcuts";
import Dialog from "~/components/shared/base/Dialog.vue";
import ImportDialogContent from "~/components/edit/toolbar/ImportDialogContent.vue";
import { newResumeFromImport } from "~/utils/database";
const router = useRouter();
const localePath = useLocalePath();

defineEmits<{
  (e: "update"): void;
}>();

useShortcuts("shift+ctrl+s", saveResumesToLocal);

// 提供给导入组件的回调：创建新文件并跳转编辑页
if (typeof window !== 'undefined') {
  (window as any).__newOnImport = async (content: string, filename?: string) => {
    const id = await newResumeFromImport(content, filename?.replace(/\.(md|txt|docx|pdf)$/i, '') )
    router.push(localePath(`/edit/${id}`))
    return id
  }
}
</script>

<style scoped>
.file-options button {
  @apply rect-btn border border-dark-c hover:bg-darker-c;
}
</style>
