import { redirect } from "next/navigation";
import MinecraftControlPanel from "@/components/minecraft-control-panel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MinecraftAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  return <MinecraftControlPanel editorName={user.name} />;
}
