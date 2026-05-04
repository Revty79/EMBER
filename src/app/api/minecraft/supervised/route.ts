import { NextResponse } from "next/server";
import { getEmberIdentityProfile } from "@/lib/ember-profile";
import {
  createMinecraftBridgeLog,
  getMinecraftBridgeConfig,
  hasDangerSignals,
  parseMinecraftSupervisedModelResponse,
  resolveBridgeRuntimeOptions,
} from "@/lib/minecraft/bridge";
import { buildMinecraftSupervisedPrompt } from "@/lib/minecraft/prompt";
import { type MinecraftSupervisedResponse } from "@/lib/minecraft/types";
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

  if (!config.supervisedEnabled) {
    const disabledResponse: MinecraftSupervisedResponse = {
      mode: "supervised",
      enabled: false,
      executed: false,
      reply: "Minecraft supervised mode is disabled.",
      actions: [],
    };

    return NextResponse.json(disabledResponse);
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
  const prompt = buildMinecraftSupervisedPrompt(
    profile,
    observationSummary,
    config.supervisedAllowedActionTypes,
  );
  const systemInstruction = buildSystemInstruction(config.supervisedResponseMode, prompt);

  try {
    const rawReply = await sendOllamaChatRequest(
      config.supervisedModel,
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
      resolveBridgeRuntimeOptions(config.supervisedResponseMode),
    );

    const parsed = parseMinecraftSupervisedModelResponse(rawReply, {
      allowedActionTypes: config.supervisedAllowedActionTypes,
      maxActions: config.supervisedMaxActions,
      requiredConfidence: config.supervisedRequireConfidence,
      dangerPresent: hasDangerSignals(observation),
      debug: config.bridgeDebug,
    });

    const logId = await createMinecraftBridgeLog({
      mode: "supervised",
      observation,
      observationSummary,
      model: config.supervisedModel,
      responseMode: config.supervisedResponseMode,
      promptText: systemInstruction,
      shadowReply: parsed.reply,
      wouldDo: parsed.wouldDo,
      confidence: parsed.confidence,
      requestedActions: parsed.actions,
      error: parsed.parserError,
    });

    const response: MinecraftSupervisedResponse = {
      mode: "supervised",
      enabled: true,
      executed: false,
      reply: parsed.reply,
      wouldDo: parsed.wouldDo,
      confidence: parsed.confidence,
      allowedActionTypes: config.supervisedAllowedActionTypes,
      actions: parsed.actions,
      logId,
    };

    return NextResponse.json(response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown model error.";

    await createMinecraftBridgeLog({
      mode: "supervised",
      observation,
      observationSummary,
      model: config.supervisedModel,
      responseMode: config.supervisedResponseMode,
      promptText: systemInstruction,
      error: detail,
    });

    return NextResponse.json({ error: `Could not reach Ollama: ${detail}` }, { status: 502 });
  }
}
