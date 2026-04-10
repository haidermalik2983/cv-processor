import {
  applyPromptTemplate,
  buildPromptTemplateWithRequiredContext,
  DEFAULT_PROMPT_TEMPLATE,
} from "@/lib/prompt-template";

type EnhanceSectionInput = {
  sectionName: string;
  sectionContent: string;
  jobDescription: string;
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

const redactProviderErrorBody = (value: string) =>
  value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9]+\b/g, "sk-[REDACTED]")
    .replace(
      /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|key)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"',
    );

const logProviderFailure = ({
  status,
  attempt,
  errorBody,
}: {
  status: number;
  attempt: number;
  errorBody: string;
}) => {
  console.error("[OpenAIProvider] Request failed", {
    status,
    attempt,
    errorBody: redactProviderErrorBody(errorBody || "Unknown provider error"),
  });
};

class OpenAIProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async _request(systemMessage: string, userPrompt: string): Promise<string> {
    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.4,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userPrompt },
            ],
          }),
        });
      } catch (error) {
        console.error("[OpenAIProvider] Network or fetch error", {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 429 && attempt < MAX_429_RETRIES) {
          await sleep(extractRetryDelayMs(errorBody));
          continue;
        }
        logProviderFailure({
          status: response.status,
          attempt,
          errorBody,
        });
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!content) {
        console.error("[OpenAIProvider] Empty response content", { attempt });
        throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
      }

      return content;
    }

    throw new Error(CLIENT_SAFE_PROVIDER_ERROR);
  }

  async enhanceSection(input: EnhanceSectionInput): Promise<string> {
    const prompt = buildPrompt(input);
    return this._request(
      "You are a CV optimization assistant. You only return polished section text.",
      prompt,
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
}: EnhanceSectionInput) =>
  applyPromptTemplate(
    buildPromptTemplateWithRequiredContext(promptTemplate?.trim() || DEFAULT_PROMPT_TEMPLATE),
    {
    sectionName,
    sectionContent,
    jobDescription,
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

