import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { getCurrentUser, hasAnyUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const setupOpen = !(await hasAnyUsers());

  return <LoginForm setupOpen={setupOpen} />;
}
