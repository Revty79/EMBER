import { NextResponse } from "next/server";
import { getEmberIdentityProfile } from "@/lib/ember-profile";
import {
  createMinecraftBridgeLog,
  getMinecraftBridgeConfig,
  resolveBridgeRuntimeOptions,
} from "@/lib/minecraft/bridge";
import { buildMinecraftShadowPrompt } from "@/lib/minecraft/prompt";
import {
  type MinecraftShadowResponse,
} from "@/lib/minecraft/types";
import {
  parseMinecraftObservation,
  sanitizeObservationForPrompt,
  summarizeObservation,
  validateBridgeToken,
} from "@/lib/minecraft/validation";
import {
  buildSystemInstruction,
  sendOllamaChatRequest,
} from "@/lib/ollama";

export const runtime = "nodejs";

const SHADOW_FALLBACK_REPLY =
  "I am safe near home. I would stay idle and wait for Brannan's next command.";

function normalizeShadowReply(rawReply: string) {
  const withoutCodeBlocks = rawReply.replace(/```[\s\S]*?```/g, " ");
  const withoutBackticks = withoutCodeBlocks.replace(/`+/g, " ");
  const compact = withoutBackticks.replace(/\s+/g, " ").trim();

  if (!compact) {
    return SHADOW_FALLBACK_REPLY;
  }

  const sentenceParts = compact
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const trimmedToTwoSentences =
    sentenceParts.length > 0 ? sentenceParts.slice(0, 2).join(" ") : compact;
  const normalized = trimmedToTwoSentences.trim();

  if (!normalized) {
    return SHADOW_FALLBACK_REPLY;
  }

  if (normalized.length > 280) {
    return `${normalized.slice(0, 277).trimEnd()}...`;
  }

  return normalized;
}

export async function POST(request: Request) {
  const auth = validateBridgeToken(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getMinecraftBridgeConfig();

  if (!config.shadowEnabled) {
    return NextResponse.json({ error: "Minecraft shadow mode is disabled." }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let observation;

  try {
    observation = parseMinecraftObservation(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid observation payload.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const observationSummary = summarizeObservation(observation);
  const observationForPrompt = sanitizeObservationForPrompt(observation);
  const profile = await getEmberIdentityProfile();
  const bridgePrompt = buildMinecraftShadowPrompt(profile, observationSummary);
  const systemInstruction = buildSystemInstruction(config.shadowResponseMode, bridgePrompt);

  try {
    const rawReply = await sendOllamaChatRequest(
      config.shadowModel,
      [
        {
          role: "system",
          content: systemInstruction,
        },
        {
          role: "user",
          content: `Observation snapshot (JSON):\n${JSON.stringify(observationForPrompt, null, 2)}`,
        },
      ],
      resolveBridgeRuntimeOptions(config.shadowResponseMode),
    );
    const reply = normalizeShadowReply(rawReply);

    let logId: string | undefined;

    if (config.shadowStoreObservations) {
      logId = await createMinecraftBridgeLog({
        mode: "shadow",
        observation,
        observationSummary,
        model: config.shadowModel,
        responseMode: config.shadowResponseMode,
        promptText: systemInstruction,
        shadowReply: reply,
        wouldDo: reply,
        confidence: "medium",
      });
    }

    const response: MinecraftShadowResponse = {
      mode: "shadow",
      executed: false,
      reply,
      wouldDo: reply,
      confidence: "medium",
      allowedActionTypes: [],
      actions: [],
      logId,
    };

    return NextResponse.json(response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown model error.";

    if (config.shadowStoreObservations) {
      await createMinecraftBridgeLog({
        mode: "shadow",
        observation,
        observationSummary,
        model: config.shadowModel,
        responseMode: config.shadowResponseMode,
        promptText: systemInstruction,
        error: detail,
      });
    }

    return NextResponse.json({ error: `Could not reach Ollama: ${detail}` }, { status: 502 });
  }
}
