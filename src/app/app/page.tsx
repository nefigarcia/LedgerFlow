import { redirect } from "next/navigation";
import { getSession, getUserOrganizations } from "@/lib/auth/session";

export default async function AppRedirectPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const orgs = await getUserOrganizations(session.user.id);
  if (orgs.length === 0) redirect("/onboarding");
  redirect(`/app/${orgs[0].organization.slug}/dashboard`);
}
