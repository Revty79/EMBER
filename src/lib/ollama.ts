import { requireEnv } from "@/lib/env";

export const MODEL_OPTIONS = ["qwen2.5:1.5b", "llama3.2:1b"] as const;
export const RESPONSE_MODE_OPTIONS = ["strict", "helpful", "deep", "free"] as const;

export type EmberModel = (typeof MODEL_OPTIONS)[number];
export type EmberResponseMode = (typeof RESPONSE_MODE_OPTIONS)[number];
export type OllamaChatRole = "system" | "user" | "assistant";
export type OllamaChatMessage = {
  role: OllamaChatRole;
  content: string;
};
export type OllamaRuntimeOptions = {
  num_ctx?: number;
  repeat_last_n?: number;
  repeat_penalty?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
};

export const FALLBACK_MODEL: EmberModel = MODEL_OPTIONS[0];
export const FALLBACK_RESPONSE_MODE: EmberResponseMode = "helpful";

const RESPONSE_MODE_PROMPTS: Record<EmberResponseMode, string> = {
  strict:
    "Mode: STRICT. Prioritize precision and restraint. Be concise, factual, and cautious about uncertain claims. Ask for clarification when necessary before making assumptions.",
  helpful:
    "Mode: HELPFUL. Be warm, clear, casual, practical, and useful. Help with writing, organizing ideas, family projects, server notes, household planning, and everyday reasoning. Avoid corporate language and stiff phrasing.",
  deep:
    "Mode: DEEP. Think in layers, surface tradeoffs, challenge weak assumptions, and offer richer reasoning. Provide structure and depth while staying readable and practical.",
  free:
    "Mode: FREE. Be bold, creative, and exploratory. Minimize boilerplate caution and avoid generic assistant phrasing. Keep answers honest and direct, but prioritize imagination and range.",
};

const RESPONSE_MODE_OPTIONS_MAP: Record<EmberResponseMode, OllamaRuntimeOptions> = {
  strict: {
    temperature: 0.35,
    top_p: 0.8,
    top_k: 40,
    repeat_penalty: 1.15,
    repeat_last_n: 96,
    min_p: 0.05,
    num_ctx: 8192,
  },
  helpful: {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    repeat_last_n: 64,
    min_p: 0.02,
    num_ctx: 8192,
  },
  deep: {
    temperature: 0.9,
    top_p: 0.95,
    top_k: 80,
    repeat_penalty: 1.06,
    repeat_last_n: 96,
    min_p: 0.01,
    num_ctx: 16384,
  },
  free: {
    temperature: 1.1,
    top_p: 0.98,
    top_k: 120,
    repeat_penalty: 1.0,
    repeat_last_n: 64,
    min_p: 0,
    num_ctx: 16384,
  },
};

export function resolveDefaultModel(modelFromEnv?: string): EmberModel {
  if (modelFromEnv && MODEL_OPTIONS.includes(modelFromEnv as EmberModel)) {
    return modelFromEnv as EmberModel;
  }

  return FALLBACK_MODEL;
}

export function resolveRequestedModel(modelFromRequest?: string | null) {
  if (modelFromRequest && MODEL_OPTIONS.includes(modelFromRequest as EmberModel)) {
    return modelFromRequest as EmberModel;
  }

  return resolveDefaultModel(process.env.OLLAMA_MODEL);
}

export function resolveRequestedResponseMode(modeFromRequest?: string | null): EmberResponseMode {
  if (modeFromRequest && RESPONSE_MODE_OPTIONS.includes(modeFromRequest as EmberResponseMode)) {
    return modeFromRequest as EmberResponseMode;
  }

  return FALLBACK_RESPONSE_MODE;
}

export function buildSystemInstruction(mode: EmberResponseMode, emberIdentityInstruction: string) {
  return `${emberIdentityInstruction}\n\nResponse Mode Guidance: ${RESPONSE_MODE_PROMPTS[mode]}`;
}

export function resolveRuntimeOptions(mode: EmberResponseMode): OllamaRuntimeOptions {
  return RESPONSE_MODE_OPTIONS_MAP[mode];
}

function extractAssistantReply(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const message = (raw as Record<string, unknown>).message;

  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as Record<string, unknown>).content;

  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function sendOllamaChatRequest(
  model: EmberModel,
  messages: OllamaChatMessage[],
  options?: OllamaRuntimeOptions,
) {
  const ollamaBaseUrl = requireEnv("OLLAMA_BASE_URL");
  const endpoint = `${ollamaBaseUrl.replace(/\/+$/, "")}/api/chat`;
  const requestBody: Record<string, unknown> = {
    model,
    stream: false,
    messages,
  };

  if (options && Object.keys(options).length > 0) {
    requestBody.options = options;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data: unknown = await response.json();
  const reply = extractAssistantReply(data);

  if (!reply) {
    throw new Error("Ollama returned an empty response.");
  }

  return reply;
}
