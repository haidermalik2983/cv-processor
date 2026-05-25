"use server";

import { createAIProvider } from "@/lib/ai-provider";
import { CV_SECTION_KEYS, CV_SECTION_LABELS, type CVSectionKey } from "@/lib/cv-schema";
import { detectSectionType, ENHANCE_EDUCATION_PROMPT_TEMPLATE, ENHANCE_EDUCATION_SYSTEM_PROMPT, ReviewedSection } from "@/lib/enhance";
import { truncateExperienceBullets } from "@/lib/experience-bullets";
import { truncateProjectBullets } from "@/lib/project-bullets";
import {
  ANALYZE_SYSTEM_PROMPT,
  applyPromptTemplate,
  DEFAULT_PROMPT_TEMPLATE,
  GAP_ANALYSIS_PROMPT_TEMPLATE,
  normalizeEditablePromptTemplate,
  REVIEW_PROMPT_TEMPLATE,
  REVIEW_SKILLS_PROMPT_TEMPLATE,
  REVIEW_TITLE_PROMPT_TEMPLATE,
  SCORE_SYSTEM_PROMPT,
} from "@/lib/prompt-template";

const getReviewPromptTemplate = (sectionName: string): string => {
  const sectionType = detectSectionType(sectionName);
  if (sectionType === "professional_title") return REVIEW_TITLE_PROMPT_TEMPLATE;
  if (sectionType === "skills") return REVIEW_SKILLS_PROMPT_TEMPLATE;
  return REVIEW_PROMPT_TEMPLATE;
};

type HolisticContext = {
  note?: string;
  fix?: string;
  crossSectionIssues?: Array<{ issue: string; fix: string }>;
};

type EnhanceSingleSectionInput = {
  sectionKey: CVSectionKey;
  sectionName?: string;
  sectionContent: string;
  jobDescription: string;
  previousReview?: ReviewedSection | null;
  promptTemplate?: string;
  holisticContext?: HolisticContext | null;
};

type EnhanceSingleSectionResult = {
  sectionKey: CVSectionKey;
  enhancedContent: string;
  improvements: ReviewedSection | null;
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

const formatHolisticContext = (holistic: HolisticContext | null | undefined): string => {
  if (!holistic) return "";

  const note = holistic.note?.trim();
  const fix = holistic.fix?.trim();
  const issues = (holistic.crossSectionIssues ?? [])
    .map((issue, idx) => `- [C${idx + 1}] ${issue.issue}\n  Fix: ${issue.fix}`)
    .join("\n");

  if (!note && !fix && !issues) return "";

  return `
## HOLISTIC REVIEW CONTEXT (from full-CV review)

A reviewer scanned the entire CV against the JD and flagged the following for THIS section. Treat these as high-priority gaps and address them in this enhancement pass, alongside the previous-review feedback below.

${note ? `Section note: ${note}` : ""}
${fix ? `Section fix: ${fix}` : ""}
${issues ? `Cross-section issues that involve this section:\n${issues}` : ""}
`.trim();
};

const formatPreviousReview = (previousReview: ReviewedSection): string => {
  const weakCriteria = previousReview.criteria
    .filter((c) => c.score < 2)
    .map((c) => {
      const label = c.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      return `- ${label} (${c.score}/2): ${c.reason}\n  Suggested fix: ${c.suggestion}`;
    })
    .join("\n");

  return `
## PREVIOUS REVIEW (from prior iteration)

The current section content above is the result of a previous enhancement pass. The previous version scored as follows. Use this to drive your gap analysis — but verify against the current content, since some issues may have been fixed.

Previous overall score: ${previousReview.total_score}/10
Top priority fix from last round: ${previousReview.top_priority_fix}

Weak criteria (scored 0 or 1):
${weakCriteria || "(none — all criteria scored 2)"}

Focus rules for this iteration:
1. The first positioning gap [P1] MUST address the previous top_priority_fix, UNLESS the current content has already resolved it. If resolved, state that explicitly in [P1] Issue and use [P1] for the next-most-important gap.
2. For each weak criterion above, verify against the current content. If still weak, surface a concrete gap. If fixed, do not re-flag.
3. Do not introduce new low-severity nitpicks while high-severity gaps from the previous round remain unaddressed.
`.trim();
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
  const promptTemplate = normalizeEditablePromptTemplate(DEFAULT_PROMPT_TEMPLATE);
  const sectionName = input.sectionName?.trim() || CV_SECTION_LABELS[sectionKey];
  let pass1Result = ""; 
  let improvements: ReviewedSection | null = null;

  if (!jobDescription) {
    throw new Error(`Failed to enhance ${sectionName}: job description is required.`);
  }

  if (["workExperience", "education", "projects"].includes(sectionKey) && !sectionContent) {
    throw new Error(`Failed to enhance ${sectionName}: section content is empty.`);
  }

  if (jobDescription.length > MAX_INPUT_LENGTH || sectionContent.length > MAX_INPUT_LENGTH) {
    throw new Error(`Failed to enhance ${sectionName}: input is too long.`);
  }

  try {
    const provider = createAIProvider();
    if (sectionKey === "education") {
      pass1Result = await provider.complete({
        systemMessage: ENHANCE_EDUCATION_SYSTEM_PROMPT,
        userPrompt: applyPromptTemplate(ENHANCE_EDUCATION_PROMPT_TEMPLATE, {
          sectionContent,
        }),
      });

    } else {
      const previousReviewBlock = input.previousReview ? formatPreviousReview(input.previousReview) : "";
      const holisticBlock = formatHolisticContext(input.holisticContext);
      const previousReview = [previousReviewBlock, holisticBlock].filter(Boolean).join("\n\n");

      const positioningAnalysis = await provider.complete({
        systemMessage: ANALYZE_SYSTEM_PROMPT,
        userPrompt: applyPromptTemplate(GAP_ANALYSIS_PROMPT_TEMPLATE, {
          sectionName,
          sectionContent,
          jobDescription,
          previousReview,
        }),
      });
  
      pass1Result = await provider.enhanceSection({
        sectionName,
        sectionContent,
        jobDescription,
        promptTemplate,
        positioningAnalysis,
      });
  
      const iterationContext = input.previousReview
        ? `
            ## ITERATION CONTEXT
  
            This is a re-score after an enhancement pass. Previous total: ${input.previousReview.total_score}/10.
            Previous top_priority_fix: "${input.previousReview.top_priority_fix}"
  
            Scoring rule for this re-score:
            - If the current content addresses the previous top_priority_fix, the criterion that fix targeted MUST score higher than last round, unless a regression elsewhere offsets it.
            - If you score a criterion the same as or lower than last round, the "reason" field MUST name specifically what is still missing or what regressed. Vague reasons are not acceptable on re-review.
          `.trim()
        : "";
  
      const reviewPrompt = applyPromptTemplate(getReviewPromptTemplate(sectionName), {
        sectionName,
        sectionContent: pass1Result,
        jobDescription,
        iterationContext,
      });
      const pass2Result = await provider.complete({
        systemMessage: SCORE_SYSTEM_PROMPT,
        userPrompt: reviewPrompt,
      });
      
      try {
        improvements = JSON.parse(pass2Result) as ReviewedSection;
      } catch {
        improvements = null;
      }
    }

    const sanitizedContent = sanitizeEnhancedContent(sectionKey, sectionName, pass1Result);

    return {
      sectionKey,
      enhancedContent: sanitizedContent || pass1Result,
      improvements,
    };
  } catch {
    throw new Error(`Failed to enhance ${sectionName}. ${CLIENT_SAFE_ENHANCEMENT_ERROR}`);
  }
}

