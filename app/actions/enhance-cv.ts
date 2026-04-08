"use server";

import { createAIProvider } from "@/lib/ai-provider";
import { CV_SECTION_KEYS, CV_SECTION_LABELS, type CVSectionKey } from "@/lib/cv-schema";
import { truncateExperienceBullets } from "@/lib/experience-bullets";
import { DEFAULT_PROMPT_TEMPLATE, normalizeEditablePromptTemplate } from "@/lib/prompt-template";

type EnhanceSingleSectionInput = {
  sectionKey: CVSectionKey;
  sectionName?: string;
  sectionContent: string;
  jobDescription: string;
  promptTemplate?: string;
};

type EnhanceSingleSectionResult = {
  sectionKey: CVSectionKey;
  enhancedContent: string;
};

const MAX_INPUT_LENGTH = 20_000;
const CLIENT_SAFE_ENHANCEMENT_ERROR = "Please try again in a moment.";

const isValidSectionKey = (value: string): value is CVSectionKey => {
  return CV_SECTION_KEYS.includes(value as CVSectionKey);
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[*_`#:\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripRepeatedSectionHeading = (sectionName: string, content: string) => {
  const lines = content.split("\n");
  if (lines.length === 0) return content.trim();

  const firstLine = lines[0]?.trim() ?? "";
  const normalizedFirstLine = normalizeLabel(firstLine);
  const normalizedSectionName = normalizeLabel(sectionName);

  if (!normalizedFirstLine || normalizedFirstLine !== normalizedSectionName) {
    return content.trim();
  }

  return lines.slice(1).join("\n").trim();
};

const isDecorativeLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Remove lines that are only decorative symbols (e.g. ----, ****, ===, ###, ```).
  return /^[\-\_=*~`#|.]{3,}$/.test(trimmed);
};

const sanitizeEnhancedContent = (
  sectionKey: CVSectionKey,
  sectionName: string,
  rawContent: string,
) => {
  const withoutHeading = stripRepeatedSectionHeading(sectionName, rawContent);
  const cleanedLines = withoutHeading
    .split("\n")
    .filter((line) => !isDecorativeLine(line));

  let cleaned = cleanedLines.join("\n").trim();

  if (sectionKey === "workExperience" && cleaned) {
    cleaned = truncateExperienceBullets(cleaned).content;
  }

  return cleaned;
};

export async function enhanceSingleSectionAction(
  input: EnhanceSingleSectionInput,
): Promise<EnhanceSingleSectionResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request payload.");
  }

  const sectionKey = input.sectionKey;
  if (!sectionKey || !isValidSectionKey(sectionKey)) {
    throw new Error("Invalid section key.");
  }

  const sectionContent = input.sectionContent?.trim();
  const jobDescription = input.jobDescription?.trim();
  const promptTemplate = normalizeEditablePromptTemplate(
    input.promptTemplate?.trim() || DEFAULT_PROMPT_TEMPLATE,
  );
  const sectionName = input.sectionName?.trim() || CV_SECTION_LABELS[sectionKey];

  if (!jobDescription) {
    throw new Error(`Failed to enhance ${sectionName}: job description is required.`);
  }

  if (!sectionContent) {
    throw new Error(`Failed to enhance ${sectionName}: section content is empty.`);
  }

  if (jobDescription.length > MAX_INPUT_LENGTH || sectionContent.length > MAX_INPUT_LENGTH) {
    throw new Error(`Failed to enhance ${sectionName}: input is too long.`);
  }

  try {
    const provider = createAIProvider();
    const enhancedContent = await provider.enhanceSection({
      sectionName,
      sectionContent,
      jobDescription,
      promptTemplate,
    });
    const sanitizedContent = sanitizeEnhancedContent(sectionKey, sectionName, enhancedContent);

    return {
      sectionKey,
      enhancedContent: sanitizedContent || enhancedContent,
    };
  } catch (error) {
    console.error("[enhanceSingleSectionAction] Enhancement failed", {
      sectionKey,
      sectionName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to enhance ${sectionName}. ${CLIENT_SAFE_ENHANCEMENT_ERROR}`);
  }
}

