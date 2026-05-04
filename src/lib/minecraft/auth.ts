import { type AuthenticatedUser, getCurrentUser } from "@/lib/auth";
import { validateBridgeToken } from "@/lib/minecraft/validation";

export type MinecraftBridgeAccessResult =
  | {
      ok: true;
      via: "token" | "admin";
      user?: AuthenticatedUser;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function authorizeMinecraftBridgeOrAdmin(
  request: Request,
): Promise<MinecraftBridgeAccessResult> {
  const tokenCheck = validateBridgeToken(request);

  if (tokenCheck.ok) {
    return {
      ok: true,
      via: "token",
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return tokenCheck;
  }

  if (user.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Forbidden.",
    };
  }

  return {
    ok: true,
    via: "admin",
    user,
  };
}
