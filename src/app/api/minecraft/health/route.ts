import { NextResponse } from "next/server";
import { getMinecraftBridgeConfig } from "@/lib/minecraft/bridge";
import { validateBridgeToken } from "@/lib/minecraft/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = validateBridgeToken(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getMinecraftBridgeConfig();

  return NextResponse.json({
    ok: true,
    service: "EMBER Minecraft Bridge",
    shadowEnabled: config.shadowEnabled,
    supervisedEnabled: config.supervisedEnabled,
    actionsEnabled: config.actionsEnabled,
    timestamp: new Date().toISOString(),
  });
}
