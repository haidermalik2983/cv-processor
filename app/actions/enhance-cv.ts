"use server";

import { createAIProvider } from "@/lib/ai-provider";
import { CV_SECTION_KEYS, CV_SECTION_LABELS, type CVSectionKey } from "@/lib/cv-schema";
import { truncateExperienceBullets } from "@/lib/experience-bullets";
import { truncateProjectBullets } from "@/lib/project-bullets";
import {
  applyPromptTemplate,
  DEFAULT_PROMPT_TEMPLATE,
  FINAL_REVIEW_PROMPT_TEMPLATE,
  normalizeEditablePromptTemplate,
  REVIEW_PROMPT_TEMPLATE,
} from "@/lib/prompt-template";

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

const stripMarkdownBold = (line: string) =>
  line.replace(/\*\*(.+?)\*\*/g, "$1");

const sanitizeEnhancedContent = (
  sectionKey: CVSectionKey,
  sectionName: string,
  rawContent: string,
) => {
  const withoutHeading = stripRepeatedSectionHeading(sectionName, rawContent);
  const cleanedLines = withoutHeading
    .split("\n")
    .filter((line) => !isDecorativeLine(line))
    .map(stripMarkdownBold);

  let cleaned = cleanedLines.join("\n").trim();

  if (sectionKey === "workExperience" && cleaned) {
    cleaned = truncateExperienceBullets(cleaned).content;
  }

  if (sectionKey === "projects" && cleaned) {
    cleaned = truncateProjectBullets(cleaned).content;
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

    // Pass 1: Enhance the section
    const pass1Result = await provider.enhanceSection({
      sectionName,
      sectionContent,
      jobDescription,
      promptTemplate,
    });

    // Skip review passes for "Professional Title" (single-line output)
    const skipReviewPasses = sectionName === "Professional Title";

    let finalResult = pass1Result;

    if (!skipReviewPasses) {
      // Pass 2: Review and update against the job description
      const reviewPrompt = applyPromptTemplate(REVIEW_PROMPT_TEMPLATE, {
        sectionName,
        originalContent: sectionContent,
        enhancedContent: pass1Result,
        jobDescription,
      });
      const pass2Result = await provider.complete({
        systemMessage:
          "You are a CV review specialist. You compare enhanced CV content against job descriptions and make targeted improvements.",
        userPrompt: reviewPrompt,
      });

      // Pass 3: Final detailed review
      const finalReviewPrompt = applyPromptTemplate(FINAL_REVIEW_PROMPT_TEMPLATE, {
        sectionName,
        originalContent: sectionContent,
        reviewedContent: pass2Result,
        jobDescription,
      });
      finalResult = await provider.complete({
        systemMessage:
          "You are a senior CV editor performing a final quality review. You only return the final polished text.",
        userPrompt: finalReviewPrompt,
      });
    }

    const sanitizedContent = sanitizeEnhancedContent(sectionKey, sectionName, finalResult);

    return {
      sectionKey,
      enhancedContent: sanitizedContent || finalResult,
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

