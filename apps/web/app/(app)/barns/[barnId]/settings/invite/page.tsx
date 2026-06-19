import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { InviteMemberForm } from "@/components/barn/InviteMemberForm";

export default async function InviteMemberPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  return <InviteMemberForm barnId={barnId} />;
}
