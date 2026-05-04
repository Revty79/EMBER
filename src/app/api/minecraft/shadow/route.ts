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
    const reply = await sendOllamaChatRequest(
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
