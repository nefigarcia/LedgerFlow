import { redirect } from "next/navigation";
import { getSession, getUserOrganizations } from "@/lib/auth/session";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { new: isNewOrg } = await searchParams;
  const orgs = await getUserOrganizations(session.user.id);
  if (orgs.length > 0 && !isNewOrg) {
    redirect(`/app/${orgs[0].organization.slug}/dashboard`);
  }

  return <OnboardingWizard userName={session.user.name ?? "there"} />;
}
