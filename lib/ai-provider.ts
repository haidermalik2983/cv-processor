import {
  applyPromptTemplate,
  buildPromptTemplateWithRequiredContext,
  DEFAULT_PROMPT_TEMPLATE,
} from "@/lib/prompt-template";
import { detectSectionType, ENHANCE_SYSTEM_PROMPT, getEnhancePromptTemplate } from "./enhance";

type EnhanceSectionInput = {
  sectionName: string;
  sectionContent: string;
  jobDescription: string;
  positioningAnalysis: string;
  promptTemplate?: string;
};

export interface AIProvider {
  enhanceSection(input: EnhanceSectionInput): Promise<string>;
  complete(input: { systemMessage: string; userPrompt: string }): Promise<string>;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const MAX_429_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 8_000;
const CLIENT_SAFE_PROVIDER_ERROR = "AI provider request failed. Please try again.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractRetryDelayMs = (errorBody: string) => {
  const retryInSecondsMatch = errorBody.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
  if (retryInSecondsMatch) {
    const seconds = Number.parseFloat(retryInSecondsMatch[1] ?? "");
    if (Number.isFinite(seconds) && seconds > 0) {
      // Add a small buffer to reduce repeated 429s around the exact cutoff.
      return Math.ceil(seconds * 1000) + 300;
    }
  }

  return DEFAULT_RETRY_DELAY_MS;
};

class OpenAIProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async _request(systemMessage: string, userPrompt: string, modelOption?: Record<string, unknown>): Promise<string> {
    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
      let response: Response;
      const extraModelOptions = {temperature: 0.4, ...modelOption};
      try {
        response = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userPrompt },
            ],
            ...extraModelOptions,
          }),
        });
      } catch {
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 429 && attempt < MAX_429_RETRIES) {
          await sleep(extractRetryDelayMs(errorBody));
          continue;
        }
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!content) {
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      return content;
    }

    throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
  }

  async enhanceSection(input: EnhanceSectionInput): Promise<string> {
    const { sectionName, sectionContent, jobDescription, positioningAnalysis } = input;
    // const prompt = buildPrompt(input);
    const sectionType = detectSectionType(sectionName);
      const template = getEnhancePromptTemplate(sectionType);
    
      const prompt = applyPromptTemplate(template, {
        sectionName,
        sectionContent,
        jobDescription,
        analysis: positioningAnalysis,
      });
       const maxTokens =
    sectionType === "professional_title"
      ? 60
      : sectionType === "summary"
        ? 250
        : sectionType === "skills"
          ? 500
          : undefined;
    return this._request(
      ENHANCE_SYSTEM_PROMPT,
      prompt,
       { max_completion_tokens: maxTokens }
    );
  }

  async complete(input: { systemMessage: string; userPrompt: string }): Promise<string> {
    return this._request(input.systemMessage, input.userPrompt);
  }
}

const buildPrompt = ({
  sectionName,
  sectionContent,
  jobDescription,
  promptTemplate,
  positioningAnalysis,
}: EnhanceSectionInput) => 
  applyPromptTemplate(
    buildPromptTemplateWithRequiredContext(DEFAULT_PROMPT_TEMPLATE),
    {
    sectionName,
    sectionContent,
    jobDescription,
    positioningAnalysis
    },
  );

export const createAIProvider = (): AIProvider => {
  const provider = process.env.AI_PROVIDER ?? "openai";
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  if (provider !== "openai") {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  return new OpenAIProvider(apiKey, model);
};

