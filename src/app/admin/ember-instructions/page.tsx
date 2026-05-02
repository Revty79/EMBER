import { redirect } from "next/navigation";
import EmberInstructionsForm from "@/components/ember-instructions-form";
import { getCurrentUser } from "@/lib/auth";
import { getEmberIdentityProfile } from "@/lib/ember-profile";

export const dynamic = "force-dynamic";

export default async function EmberInstructionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  const profile = await getEmberIdentityProfile();

  return <EmberInstructionsForm initialProfile={profile} editorName={user.name} />;
}
