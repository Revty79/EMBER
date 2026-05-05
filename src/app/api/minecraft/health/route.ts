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
    ok: true,
    service: "EMBER Minecraft Bridge",
    shadowEnabled: config.shadowEnabled,
    supervisedEnabled: config.supervisedEnabled,
    actionsEnabled: config.actionsEnabled,
    timestamp: new Date().toISOString(),
  });
}
