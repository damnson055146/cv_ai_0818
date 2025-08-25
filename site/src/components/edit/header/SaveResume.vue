<template>
  <button class="round-btn" @click="save">
    <span i-ic:baseline-save md:text-lg />
  </button>
</template>

<script lang="ts" setup>
import { useShortcuts } from "@renovamen/vue-shortcuts";
import type { ResumeStorageItem } from "~/types";
import { useRoute } from 'vue-router'
import { UpdateManager } from '~/data/updateManager'

const { data } = useDataStore();
const { styles } = useStyleStore();
const route = useRoute()
const updateMgr = new UpdateManager()

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
