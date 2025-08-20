<template>
  <div w-56 h-80>
    <Dialog id="new-resume-template" :title="$t('resumes.new')" icon="i-ic:round-plus" box-class="w-full md:w-[28rem]">
      <template #button>
        <button
          class="resume-card group w-[210px] h-[299px] flex-center bg-darker-c hover:bg-c"
          :aria-label="$t('resumes.new')"
        >
          <span i-ic:round-plus text="5xl light-c group-hover:brand" />
        </button>
      </template>

      <template #content>
        <div class="p-4 space-y-4">
          <div text-sm text-light-c>{{ $t('resumes.choose_doc_type') || 'Choose document type' }}</div>
          <div class="grid grid-cols-3 gap-3">
            <button
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'cv'"
            >CV</button>
            <button
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'ps'"
            >{{ $t('resumes.ps') || 'Personal Statement' }}</button>
            <button
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'rec'"
            >{{ $t('resumes.rec') || 'Recommendation' }}</button>
          </div>

          <div v-if="step === 'lang'" class="space-y-2">
            <div text-sm text-light-c>{{ $t('resumes.choose_lang') || 'Choose language' }}</div>
            <div class="grid grid-cols-2 gap-3">
              <button
                class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
                @click="createBy(curDoc, 'en')"
              >English</button>
              <button
                class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
                @click="createBy(curDoc, 'zh')"
              >中文</button>
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
  
</template>

<script lang="ts" setup>
const router = useRouter();
const localePath = useLocalePath();

type Doc = 'cv' | 'ps' | 'rec';
type Lang = 'en' | 'zh';

const step = ref<'doc' | 'lang'>('doc');
const curDoc = ref<Doc>('cv');

const createBy = async (docType: Doc, lang: Lang) => {
  const key = buildTemplateKey(docType, lang);
  const id = await newResume(key);
  router.push(localePath(`/edit/${id}`));
};
</script>
