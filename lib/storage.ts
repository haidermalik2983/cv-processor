import {
  CV_SECTION_KEYS,
  type CVSectionKey,
  type CVSectionsMap,
  type CVSectionTitlesMap,
  MASTER_CV_SECTIONS,
  MASTER_CV_SECTION_TITLES,
} from "@/lib/cv-schema";
import { DEFAULT_PROMPT_TEMPLATE, normalizeEditablePromptTemplate } from "@/lib/prompt-template";

const JOB_DESCRIPTION_KEY = "cvp:jobDescription";
const PROMPT_TEMPLATE_KEY = "cvp:promptTemplate";
const HEADER_KEY = "cvp:header";

const getSectionKey = (sectionKey: CVSectionKey) => `cvp:section:${sectionKey}`;
const getSectionTitleKey = (sectionKey: CVSectionKey) => `cvp:section-title:${sectionKey}`;

const canUseStorage = () => typeof window !== "undefined";

export const storage = {
  loadJobDescription(): string {
    if (!canUseStorage()) return "";
    return window.localStorage.getItem(JOB_DESCRIPTION_KEY) ?? "";
  },

  saveJobDescription(jobDescription: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(JOB_DESCRIPTION_KEY, jobDescription);
  },

  clearJobDescription() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(JOB_DESCRIPTION_KEY);
  },

  loadPromptTemplate(): string {
    if (!canUseStorage()) return DEFAULT_PROMPT_TEMPLATE;
    const storedTemplate = window.localStorage.getItem(PROMPT_TEMPLATE_KEY);
    return normalizeEditablePromptTemplate(storedTemplate ?? DEFAULT_PROMPT_TEMPLATE);
  },

  savePromptTemplate(promptTemplate: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(
      PROMPT_TEMPLATE_KEY,
      normalizeEditablePromptTemplate(promptTemplate),
    );
  },

  clearPromptTemplate() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(PROMPT_TEMPLATE_KEY);
  },

  loadSections(): CVSectionsMap {
    if (!canUseStorage()) return MASTER_CV_SECTIONS;

    const sections = { ...MASTER_CV_SECTIONS };
    for (const sectionKey of CV_SECTION_KEYS) {
      const storedValue = window.localStorage.getItem(getSectionKey(sectionKey));
      if (storedValue !== null) {
        sections[sectionKey] = storedValue;
      }
    }

    return sections;
  },

  loadSectionTitles(): CVSectionTitlesMap {
    if (!canUseStorage()) return MASTER_CV_SECTION_TITLES;

    const titles = { ...MASTER_CV_SECTION_TITLES };
    for (const sectionKey of CV_SECTION_KEYS) {
      const storedValue = window.localStorage.getItem(getSectionTitleKey(sectionKey));
      if (storedValue !== null) {
        titles[sectionKey] = storedValue;
      }
    }

    return titles;
  },

  saveSection(sectionKey: CVSectionKey, value: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(getSectionKey(sectionKey), value);
  },

  resetSection(sectionKey: CVSectionKey) {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(getSectionKey(sectionKey));
    window.localStorage.removeItem(getSectionTitleKey(sectionKey));
  },

  saveSectionTitle(sectionKey: CVSectionKey, value: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(getSectionTitleKey(sectionKey), value);
  },

  resetAllSections() {
    if (!canUseStorage()) return;
    for (const sectionKey of CV_SECTION_KEYS) {
      window.localStorage.removeItem(getSectionKey(sectionKey));
      window.localStorage.removeItem(getSectionTitleKey(sectionKey));
    }
  },

  loadHeader<T>(defaultValue: T): T {
    if (!canUseStorage()) return defaultValue;
    const stored = window.localStorage.getItem(HEADER_KEY);
    if (!stored) return defaultValue;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  },

  saveHeader<T>(header: T) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(HEADER_KEY, JSON.stringify(header));
  },

  clearHeader() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(HEADER_KEY);
  },
};

