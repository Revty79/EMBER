import { NextResponse } from "next/server";
import { updateMinecraftBridgeBodyResult } from "@/lib/minecraft/bridge";
import { validateBridgeToken } from "@/lib/minecraft/validation";

export const runtime = "nodejs";

type MinecraftBodyResultRequest = {
  logId?: string;
  accepted?: boolean;
  executed?: boolean;
  reason?: string;
  bodyState?: unknown;
};

export async function POST(request: Request) {
  const auth = validateBridgeToken(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: MinecraftBodyResultRequest;

  try {
    body = (await request.json()) as MinecraftBodyResultRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const logId = typeof body.logId === "string" ? body.logId.trim() : "";

  if (!logId) {
    return NextResponse.json({ error: "logId is required." }, { status: 400 });
  }

  try {
    const updated = await updateMinecraftBridgeBodyResult(logId, {
      accepted: typeof body.accepted === "boolean" ? body.accepted : undefined,
      executed: typeof body.executed === "boolean" ? body.executed : false,
      reason: typeof body.reason === "string" ? body.reason.trim() : undefined,
      bodyState: body.bodyState,
    });

    if (!updated) {
      return NextResponse.json({ error: "Bridge log not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      logId: updated.id,
      accepted: typeof body.accepted === "boolean" ? body.accepted : null,
      executed: typeof body.executed === "boolean" ? body.executed : false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
