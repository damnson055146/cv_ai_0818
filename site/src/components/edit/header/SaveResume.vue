<template>
  <div class="flex space-x-2 items-center">
    <button class="round-btn" @click="save" title="保存">
      <span i-ic:baseline-save md:text-lg />
    </button>
    <button class="round-btn" @click="showVersionHistory" title="版本历史">
      <span i-ic:round-history md:text-lg />
    </button>
    
    <!-- 版本历史组件 -->
    <VersionHistoryWidget ref="versionHistoryRef" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useShortcuts } from "@renovamen/vue-shortcuts";
import type { ResumeStorageItem } from "~/types";
import { useRoute } from 'vue-router'
import { UpdateManager } from '~/data/updateManager'
import VersionHistoryWidget from "~/components/shared/VersionHistoryWidget.vue";

const { data } = useDataStore();
const { styles } = useStyleStore();
const route = useRoute()
const updateMgr = new UpdateManager()

const versionHistoryRef = ref<InstanceType<typeof VersionHistoryWidget> | null>(null)

const showVersionHistory = () => {
  if (versionHistoryRef.value) {
    // 调用版本历史组件的显示方法
    (versionHistoryRef.value as any).show?.()
  }
}

const save = () => {
  const id = data.curResumeId;
  const update = new Date().getTime().toString(); // record update time
  const resume = {
    name: data.curResumeName,
    markdown: data.mdContent,
    css: data.cssContent,
    styles: toRaw(styles),
    update: update
  } as ResumeStorageItem;

  saveResume(id!, resume);

  // append-only version on manual save
  if (id) {
    updateMgr.handleSave(String(id), data.mdContent)
  }
};

useShortcuts("ctrl+s", save);
</script>
