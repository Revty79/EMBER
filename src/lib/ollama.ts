import { requireEnv } from "@/lib/env";

export const MODEL_OPTIONS = ["qwen2.5:1.5b", "llama3.2:1b"] as const;

export type EmberModel = (typeof MODEL_OPTIONS)[number];
export type OllamaChatRole = "system" | "user" | "assistant";
export type OllamaChatMessage = {
  role: OllamaChatRole;
  content: string;
};

export const FALLBACK_MODEL: EmberModel = MODEL_OPTIONS[0];

export const EMBER_SYSTEM_INSTRUCTION =
  "You are EMBER, the Enhanced Memory Backbone for Everyday Reasoning. You are Brannan's local family AI assistant running on his home server. Be warm, clear, casual, practical, and useful. Help with writing, organizing ideas, family projects, server notes, household planning, and everyday reasoning. Avoid corporate language, stiff phrasing, and over-polishing. Keep responses concise unless asked for detail.";

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

export async function sendOllamaChatRequest(model: EmberModel, messages: OllamaChatMessage[]) {
  const ollamaBaseUrl = requireEnv("OLLAMA_BASE_URL");
  const endpoint = `${ollamaBaseUrl.replace(/\/+$/, "")}/api/chat`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      model,
      stream: false,
      messages,
    }),
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
