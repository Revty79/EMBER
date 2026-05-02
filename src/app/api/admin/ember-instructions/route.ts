import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  type EmberIdentityProfile,
  getEmberIdentityProfile,
  updateEmberIdentityProfile,
} from "@/lib/ember-profile";

export const runtime = "nodejs";

type EmberProfileRequestBody = Partial<EmberIdentityProfile>;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildProfileFromBody(body: EmberProfileRequestBody): EmberIdentityProfile {
  return {
    name: readString(body.name),
    acronym: readString(body.acronym),
    tone: readString(body.tone),
    familyAssistantRole: readString(body.familyAssistantRole),
    privacyBoundaries: readString(body.privacyBoundaries),
    responseStyle: readString(body.responseStyle),
    allowedInitiative: readString(body.allowedInitiative),
    forbiddenActions: readString(body.forbiddenActions),
    uncertaintyBehavior: readString(body.uncertaintyBehavior),
    memoryBehavior: readString(body.memoryBehavior),
    additionalInstructions: typeof body.additionalInstructions === "string" ? body.additionalInstructions.trim() : "",
  };
}

function validateProfile(profile: EmberIdentityProfile) {
  const requiredFields: Array<{ key: keyof EmberIdentityProfile; label: string }> = [
    { key: "name", label: "Name" },
    { key: "acronym", label: "Acronym" },
    { key: "tone", label: "Tone" },
    { key: "familyAssistantRole", label: "Family assistant role" },
    { key: "privacyBoundaries", label: "Privacy boundaries" },
    { key: "responseStyle", label: "Response style" },
    { key: "allowedInitiative", label: "Allowed initiative" },
    { key: "forbiddenActions", label: "Forbidden actions" },
    { key: "uncertaintyBehavior", label: "Uncertainty behavior" },
    { key: "memoryBehavior", label: "Memory behavior" },
  ];

  for (const field of requiredFields) {
    if (!profile[field.key] || profile[field.key].trim().length === 0) {
      return `${field.label} is required.`;
    }
  }

  return null;
}

async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "Only admins can edit EMBER instructions." }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdminUser();

  if (auth.error) {
    return auth.error;
  }

  const profile = await getEmberIdentityProfile();
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const auth = await requireAdminUser();

  if (auth.error) {
    return auth.error;
  }

  let body: EmberProfileRequestBody;

  try {
    body = (await request.json()) as EmberProfileRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestedProfile = buildProfileFromBody(body);
  const validationError = validateProfile(requestedProfile);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const profile = await updateEmberIdentityProfile(requestedProfile, auth.user.id);
  return NextResponse.json({ profile });
}
