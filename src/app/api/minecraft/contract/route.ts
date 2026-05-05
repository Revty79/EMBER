import { NextResponse } from "next/server";
import { authorizeMinecraftBridgeOrAdmin } from "@/lib/minecraft/auth";
import { getMinecraftBridgeConfig } from "@/lib/minecraft/bridge";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeMinecraftBridgeOrAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getMinecraftBridgeConfig();

  return NextResponse.json({
    version: "minecraft-bridge-v1",
    endpoints: {
      health: "/api/minecraft/health",
      shadow: "/api/minecraft/shadow",
      supervised: "/api/minecraft/supervised",
      settings: "/api/minecraft/settings",
      recent: "/api/minecraft/recent",
      result: "/api/minecraft/result",
    },
    auth: "Authorization: Bearer <token>",
    shadowResponse: {
      mode: "shadow",
      executed: false,
      reply: "I would check my status and stay in the yard.",
      wouldDo: "I would check my status and stay in the yard.",
      confidence: "medium",
      allowedActionTypes: [],
      actions: [],
      logId: "optional",
    },
    supervisedResponse: {
      mode: "supervised",
      enabled: config.supervisedEnabled,
      executed: false,
      reply: "I want to move back to safety.",
      wouldDo: "I would go home because danger is present.",
      confidence: "medium",
      actions: [{ type: "GO_HOME", reason: "Danger signal detected." }],
      logId: "optional",
    },
    settingsResponse: {
      source: "ember",
      mode: "settings",
      settingsVersion: 1,
      updatedAt: "iso-date",
      settings: {
        shadowEnabled: false,
        shadowStoreObservations: true,
        shadowChatSummary: false,
        shadowObservationIntervalMs: 180000,
        shadowTimeoutMs: 180000,
        bridgeDebug: false,
        taskSystemEnabled: true,
        allowEating: true,
        allowEquip: true,
        allowFlee: true,
        allowMining: true,
        allowHarvest: true,
        allowWander: true,
        allowCropHarvest: false,
        allowCombat: false,
        allowBuilding: false,
        allowCrafting: false,
        allowContainers: false,
        supervisedEnabled: false,
        aiBridgeEnabled: false,
      },
    },
    allowedSupervisedActions: config.supervisedAllowedActionTypes,
    shadowEnabled: config.shadowEnabled,
    supervisedEnabled: config.supervisedEnabled,
    actionsEnabled: config.actionsEnabled,
  });
}
