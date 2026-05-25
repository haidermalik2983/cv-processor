"use server";

import { createAIProvider } from "@/lib/ai-provider";
import { CV_SECTION_LABELS, CV_SECTION_KEYS, type CVSectionKey, type CVSectionsMap } from "@/lib/cv-schema";
import type { FullCVReview } from "@/lib/enhance";
import {
  applyPromptTemplate,
  REVIEW_FULL_CV_PROMPT_TEMPLATE,
  SCORE_SYSTEM_PROMPT,
} from "@/lib/prompt-template";

type ReviewFullCvInput = {
  sections: CVSectionsMap;
  jobDescription: string;
  previousReview?: FullCVReview | null;
  changedSectionKeys?: CVSectionKey[];
};

type ReviewFullCvResult = {
  review: FullCVReview | null;
};

const SECTION_LABEL_FOR_PROMPT: Record<CVSectionKey, string> = {
  headline: "headline",
  summary: "summary",
  workExperience: "workExperience",
  skills: "skills",
  education: "education",
  projects: "projects",
};

const formatIterationContext = (
  previousReview: FullCVReview | null | undefined,
  changedSectionKeys: CVSectionKey[] | undefined,
): string => {
  if (!previousReview) return "";

  const changed = (changedSectionKeys ?? []).filter((key) => SECTION_LABEL_FOR_PROMPT[key]);
  const changedList = changed.length > 0 ? changed.join(", ") : "(none specified)";
  const unchanged = (Object.keys(SECTION_LABEL_FOR_PROMPT) as CVSectionKey[])
    .filter((k) => !changed.includes(k));
  const unchangedList = unchanged.join(", ");

  const priorPerSection = (Object.keys(previousReview.per_section_notes ?? {}) as CVSectionKey[])
    .map((key) => {
      const note = previousReview.per_section_notes[key];
      if (!note) return null;
      return `- ${key} (${note.score}/2): ${note.note}\n  Prior fix: ${note.fix}`;
    })
    .filter(Boolean)
    .join("\n");

  const priorCrossSection = (previousReview.cross_section_issues ?? [])
    .map((issue, idx) => `- [X${idx + 1}] ${issue.issue}\n  Sections: ${(issue.sections_involved ?? []).join(", ")}\n  Prior fix: ${issue.fix}`)
    .join("\n");

  return `
## ITERATION CONTEXT (this is a re-review after a targeted enhancement)

Previous overall score: ${previousReview.overall_score}/10
Previous top priority fix: ${previousReview.top_priority_fix}

Sections changed since the last review: ${changedList}
Sections unchanged (byte-identical to the previously-reviewed version): ${unchangedList}

Previous per-section notes:
${priorPerSection || "(none)"}

Previous cross-section issues:
${priorCrossSection || "(none)"}

Rules for this re-review:
1. For UNCHANGED sections, your per_section_notes entry MUST preserve the prior score, note, and fix verbatim unless re-reading reveals a clear factual error in the prior assessment. Do not invent new advice for unchanged sections.
2. For CHANGED sections, re-judge normally against the JD. If the change resolved the previous fix, the score MUST go up unless a regression elsewhere offsets it. Note specifically what was resolved.
3. For cross-section issues, walk the previous list. Drop an issue only if the change resolved it. Keep an issue if it still applies. Only INTRODUCE a new cross-section issue if it directly involves a changed section.
4. Adjust overall_score based on the actual changes. If the previous top priority fix is resolved and no regressions, overall_score MUST be higher than the previous score.
5. Set top_priority_fix to whatever is now the single most impactful next change. If nothing material remains, set it to "none".
`.trim();
};

const MAX_INPUT_LENGTH = 30_000;
const CLIENT_SAFE_REVIEW_ERROR = "Please try again in a moment.";

const ORDER: CVSectionKey[] = [
  "headline",
  "summary",
  "skills",
  "workExperience",
  "education",
  "projects",
];

const assembleFullCv = (sections: CVSectionsMap): string => {
  const parts: string[] = [];
  for (const key of ORDER) {
    const content = sections[key]?.trim();
    if (!content) continue;

    const heading = CV_SECTION_LABELS[key];
    if (heading) {
      parts.push(`## ${heading}\n\n${content}`);
    } else {
      parts.push(content);
    }
  }
  return parts.join("\n\n");
};

export async function reviewFullCvAction(
  input: ReviewFullCvInput,
): Promise<ReviewFullCvResult> {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request payload.");
  }

  const jobDescription = input.jobDescription?.trim();
  if (!jobDescription) {
    throw new Error("Failed to review CV: job description is required.");
  }

  const sections = input.sections;
  if (!sections || typeof sections !== "object") {
    throw new Error("Failed to review CV: sections are required.");
  }

  for (const key of CV_SECTION_KEYS) {
    if (typeof sections[key] !== "string") {
      throw new Error("Failed to review CV: sections are malformed.");
    }
  }

  const fullCv = assembleFullCv(sections);
  if (!fullCv) {
    throw new Error("Failed to review CV: no section content provided.");
  }

  if (jobDescription.length > MAX_INPUT_LENGTH || fullCv.length > MAX_INPUT_LENGTH) {
    throw new Error("Failed to review CV: input is too long.");
  }

  try {
    const provider = createAIProvider();
    const iterationContext = formatIterationContext(input.previousReview, input.changedSectionKeys);
    const userPrompt = applyPromptTemplate(REVIEW_FULL_CV_PROMPT_TEMPLATE, {
      jobDescription,
      fullCv,
      iterationContext,
    });

    const raw = await provider.complete({
      systemMessage: SCORE_SYSTEM_PROMPT,
      userPrompt,
    });

    let review: FullCVReview | null = null;
    try {
      review = JSON.parse(raw) as FullCVReview;
    } catch {
      review = null;
    }

    return { review };
  } catch {
    throw new Error(`Failed to review CV. ${CLIENT_SAFE_REVIEW_ERROR}`);
  }
}
