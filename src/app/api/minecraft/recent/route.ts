import { NextResponse } from "next/server";
import { authorizeMinecraftBridgeOrAdmin } from "@/lib/minecraft/auth";
import { getMinecraftBridgeConfig, getRecentMinecraftBridgeLogs } from "@/lib/minecraft/bridge";

export const runtime = "nodejs";

function normalizeLimit(limitFromQuery: string | null, maxLimit: number) {
  if (!limitFromQuery) {
    return maxLimit;
  }

  const parsed = Number.parseInt(limitFromQuery, 10);

  if (Number.isNaN(parsed)) {
    return maxLimit;
  }

  return Math.max(1, Math.min(maxLimit, parsed));
}

export async function GET(request: Request) {
  const auth = await authorizeMinecraftBridgeOrAdmin(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getMinecraftBridgeConfig();
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get("limit"), config.shadowMaxRecent);
  try {
    const logs = await getRecentMinecraftBridgeLogs(limit);

    return NextResponse.json({
      limit,
      maxLimit: config.shadowMaxRecent,
      count: logs.length,
      logs,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to load logs.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
