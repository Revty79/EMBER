import { NextResponse } from "next/server";
import {
  getMinecraftDesiredSettingsSnapshot,
  toMinecraftServiceSettings,
} from "@/lib/minecraft/settings";
import { validateBridgeToken } from "@/lib/minecraft/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = validateBridgeToken(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const snapshot = await getMinecraftDesiredSettingsSnapshot();

    return NextResponse.json({
      source: "ember",
      mode: "settings",
      settingsVersion: snapshot.settingsVersion,
      updatedAt: snapshot.updatedAt,
      settings: toMinecraftServiceSettings(snapshot.settings),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not load settings.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
