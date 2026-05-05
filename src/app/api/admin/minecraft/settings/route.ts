import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  MINECRAFT_DANGEROUS_SETTING_FIELDS,
  MinecraftSettingsValidationError,
  getMinecraftDesiredSettingsSnapshot,
  isDangerousMinecraftSettingsOverrideEnabled,
  updateMinecraftDesiredSettings,
} from "@/lib/minecraft/settings";

export const runtime = "nodejs";

async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  if (user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only admins can edit Minecraft bridge settings." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

function buildAdminSettingsPayload(snapshot: Awaited<ReturnType<typeof getMinecraftDesiredSettingsSnapshot>>) {
  const dangerousOverrideEnabled = isDangerousMinecraftSettingsOverrideEnabled();

  return {
    source: "ember",
    mode: "settings_admin",
    settingsVersion: snapshot.settingsVersion,
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.updatedBy,
    dangerousSettingsLocked: !dangerousOverrideEnabled,
    dangerousFields: [...MINECRAFT_DANGEROUS_SETTING_FIELDS],
    settings: snapshot.settings,
  };
}

export async function GET() {
  const auth = await requireAdminUser();

  if (auth.error) {
    return auth.error;
  }

  const snapshot = await getMinecraftDesiredSettingsSnapshot();
  return NextResponse.json(buildAdminSettingsPayload(snapshot));
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser();

  if (auth.error) {
    return auth.error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const snapshot = await updateMinecraftDesiredSettings(
      body,
      auth.user.id,
      isDangerousMinecraftSettingsOverrideEnabled(),
    );

    return NextResponse.json(buildAdminSettingsPayload(snapshot));
  } catch (error) {
    if (error instanceof MinecraftSettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const detail = error instanceof Error ? error.message : "Could not update settings.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
