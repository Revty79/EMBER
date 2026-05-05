import {
  type MinecraftSupervisedActionType,
} from "@/lib/minecraft/types";
import {
  buildEmberIdentityInstruction,
  type EmberIdentityProfile,
} from "@/lib/ember-profile";

export function buildMinecraftShadowPrompt(
  profile: EmberIdentityProfile,
  observationSummary: string,
) {
  const identityInstruction = buildEmberIdentityInstruction(profile);

  return [
    identityInstruction,
    "",
    "Minecraft Shadow Rules (authoritative):",
    "You are EMBER observing your Minecraft body.",
    "You are not controlling the body yet.",
    "You may say what you would do next.",
    "You must prioritize safety, staying near home, avoiding danger, hunger, and not getting stuck.",
    "You should reason in terms of known safe body skills:",
    "- report status",
    "- look around",
    "- eat if hungry",
    "- go home",
    "- flee",
    "- follow Brannan",
    "- wander yard",
    "You must not suggest combat, building, containers, crafting, cave diving, or free roaming yet.",
    "You must not claim you performed an action.",
    "Reply in 1-2 short sentences.",
    "Use practical Minecraft language, not roleplay or storytelling.",
    "Do not include code blocks, lists, or long follow-up questions.",
    "Do not imply any action was executed.",
    "Keep reply text useful for logging display.",
    `Observation Summary: ${observationSummary}`,
  ].join("\n");
}

export function buildMinecraftSupervisedPrompt(
  profile: EmberIdentityProfile,
  observationSummary: string,
  allowedActions: MinecraftSupervisedActionType[],
) {
  const identityInstruction = buildEmberIdentityInstruction(profile);
  const allowed = allowedActions.join(", ");

  return [
    identityInstruction,
    "",
    "Minecraft Supervised Rules (authoritative):",
    "You are EMBER requesting actions for your Minecraft body.",
    "The body remains the final safety gate and may reject your request.",
    "Return at most one safe action unless explicitly asked for more.",
    "Prioritize immediate safety and staying near home.",
    "Never request combat, building, crafting, container, mining, harvesting, or cave diving actions.",
    `Allowed action types in this request: ${allowed}`,
    "Confidence must be low, medium, or high.",
    "If danger is present, prefer FLEE_DANGER or GO_HOME when available.",
    "Return strict JSON with this shape and no extra text:",
    '{"reply":"...","wouldDo":"...","confidence":"low|medium|high","actions":[{"type":"GO_HOME","reason":"..."}]}',
    `Observation Summary: ${observationSummary}`,
  ].join("\n");
}
