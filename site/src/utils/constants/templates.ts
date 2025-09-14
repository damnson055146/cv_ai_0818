import type { ResumeStyles } from "~/types";
import {
  DEFAULT_NAME,
  DEFAULT_MD_CONTENT,
  DEFAULT_CSS_CONTENT,
  DEFAULT_STYLES
} from "./default";

export type DocumentType = "cv" | "ps" | "rec";
export type LanguageKey = "en" | "zh";
export type PsSubtype = "outline" | "body";

export type ResumeTemplate = {
  key: string; // e.g., "cv-en"
  docType: DocumentType;
  lang: LanguageKey;
  name?: string;
  markdown: string;
  css: string;
  styles?: ResumeStyles;
};

export const DEFAULT_TEMPLATE_KEY = "cv-en";

// CV (English) uses the project default content/styles/css
const MD_CV_EN = DEFAULT_MD_CONTENT;

// CV (Chinese)
const MD_CV_ZH = `---
---

# 张三

<span class="iconify" data-icon="charm:person"></span> [example.com](https://example.com/)
  : <span class="iconify" data-icon="tabler:brand-github"></span> [github.com/example](https://github.com/example)
  : <span class="iconify" data-icon="tabler:phone"></span> [(+86) 138-0000-0000](tel:8613800000000)

<span class="iconify" data-icon="ic:outline-location-on"></span> 北京市海淀区
  : <span class="iconify" data-icon="tabler:brand-linkedin"></span> [linkedin.com/in/example](https://linkedin.com/in/example/)
  : <span class="iconify" data-icon="tabler:mail"></span> [email@example.com](mailto:email@example.com)

## 工作/实习经历

**算法工程师实习生**
  : **某科技公司**
  : **2023.07 - 至今**

- 负责XXX算法的实现与优化，性能提升XX%
- 参与XXX项目的数据清洗、建模与上线

## 教育经历

**计算机科学 硕士**
  : **XX大学**
  : **2021.09 - 2023.06**

## 技能

- 编程：Python, JavaScript/TypeScript, HTML/CSS, Java
- 工具：Git, PyTorch, scikit-learn, Linux, Vue, React, $\\LaTeX$
`;

// Personal Statement (English)
const MD_PS_EN = `---
---

# Personal Statement

Introduce your background, motivations, and long-term goals. Explain why the target program fits you, and highlight key experiences that shaped your interests and capabilities.

## Academic Preparation

Summarize your relevant coursework, projects, and research.

## Professional Experience

Describe internships or jobs that prepared you for further study.

## Future Goals

State your short-term and long-term objectives.
`;

// Personal Statement (Chinese)
const MD_PS_ZH = `---
---

# 个人陈述

简要说明个人背景、兴趣动机及长期目标，阐述为何选择目标项目，并突出相关经历如何塑造了你的能力与方向。

## 学术准备

概述相关课程、项目与科研经历。

## 实践/实习

描述与目标方向相关的实习/工作经历。

## 未来规划

说明近期与长期的发展目标。
`;

// PS Outline (English)
const MD_PS_OUTLINE_EN = `---
---

# PS Outline

Use numbered sections and concise bullet points only. Do NOT write body paragraphs.

## 1. Motivation
- 
- 

## 2. Academic Preparation
- 
- 

## 3. Experiences
- 
- 

## 4. Why Master's / Why This Program
- 
- 

## 5. Career Plan
- 
- 
`;

// PS Outline (Chinese)
const MD_PS_OUTLINE_ZH = `---
---

# PS 大纲

仅输出结构与要点列表，请勿撰写正文段落。

## 1. 动机
- 
- 

## 2. 学术准备
- 
- 

## 3. 经历
- 
- 

## 4. 为何读研 / 为何该项目
- 
- 

## 5. 职业规划
- 
- 
`;

// PS Body (English)
const MD_PS_BODY_EN = `---
---

# Personal Statement (Body)

Write concise paragraphs strictly following the finalized outline. Avoid inventing facts.

## [Heading from Outline]

Paragraph...

## [Next Heading]

Paragraph...
`;

// PS Body (Chinese)
const MD_PS_BODY_ZH = `---
---

# 个人陈述（正文）

严格依据已完成的大纲撰写简洁段落，避免虚构信息。

## 【来自大纲的标题】

正文段落……

## 【下一个标题】

正文段落……
`;

// Recommendation Letter (English)
const MD_REC_EN = `---
---

# Recommendation Letter

To whom it may concern,

I am writing to strongly recommend <Candidate Name> for <program/position>. In the capacity of <your title>, I have known the candidate for <duration> and can attest to their <qualities>.

<Provide specific examples illustrating strengths and achievements.>

Sincerely,
<Recommender Name>
<Title / Institution>
<Email / Phone>
`;

// Recommendation Letter (Chinese)
const MD_REC_ZH = `---
---

# 推荐信

尊敬的相关负责人：

我谨推荐<Candidate Name>申请<项目/职位>。作为<你的职位>，我与其相识<时间>，对其<优点>有充分了解。

<举例说明候选人的优势与成就。>

此致
敬礼！

<推荐人姓名>
<职务 / 机构>
<邮箱 / 电话>
`;

export const buildTemplateKey = (docType: DocumentType, lang: LanguageKey) =>
  `${docType}-${lang}`;

export const buildPsTemplateKey = (lang: LanguageKey, sub: PsSubtype) =>
  `ps-${sub}-${lang}`;

export const TEMPLATE_LIST: ResumeTemplate[] = [
  // CV
  { key: buildTemplateKey("cv", "en"), docType: "cv", lang: "en", name: DEFAULT_NAME, markdown: MD_CV_EN, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildTemplateKey("cv", "zh"), docType: "cv", lang: "zh", name: "我的简历", markdown: MD_CV_ZH, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  // Personal Statement
  { key: buildTemplateKey("ps", "en"), docType: "ps", lang: "en", name: "Personal Statement", markdown: MD_PS_EN, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildTemplateKey("ps", "zh"), docType: "ps", lang: "zh", name: "个人陈述", markdown: MD_PS_ZH, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  // Personal Statement Subtypes (Outline / Body)
  { key: buildPsTemplateKey("en", "outline"), docType: "ps", lang: "en", name: "PS Outline", markdown: MD_PS_OUTLINE_EN, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildPsTemplateKey("zh", "outline"), docType: "ps", lang: "zh", name: "PS 大纲", markdown: MD_PS_OUTLINE_ZH, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildPsTemplateKey("en", "body"), docType: "ps", lang: "en", name: "PS Body", markdown: MD_PS_BODY_EN, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildPsTemplateKey("zh", "body"), docType: "ps", lang: "zh", name: "PS 正文", markdown: MD_PS_BODY_ZH, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  // Recommendation Letter
  { key: buildTemplateKey("rec", "en"), docType: "rec", lang: "en", name: "Recommendation Letter", markdown: MD_REC_EN, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES },
  { key: buildTemplateKey("rec", "zh"), docType: "rec", lang: "zh", name: "推荐信", markdown: MD_REC_ZH, css: DEFAULT_CSS_CONTENT, styles: DEFAULT_STYLES }
];

export const TEMPLATE_MAP = TEMPLATE_LIST.reduce(
  (acc, t) => {
    acc[t.key] = t;
    return acc;
  },
  {} as Record<string, ResumeTemplate>
);

export const getTemplateByKey = (key: string | undefined): ResumeTemplate =>
  TEMPLATE_MAP[key || DEFAULT_TEMPLATE_KEY] || TEMPLATE_MAP[DEFAULT_TEMPLATE_KEY];

export const getTemplatesByDocType = (docType: DocumentType): ResumeTemplate[] =>
  TEMPLATE_LIST.filter((t) => t.docType === docType);


