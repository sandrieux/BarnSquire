import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { TagsManager } from "@/components/tags/TagsManager";

export const dynamic = "force-dynamic";

export default async function TagsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { barnId } = await params;
  const t = await getTranslations("tags");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <TagsManager barnId={barnId} />
    </div>
  );
}
