import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OwnerHomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const caller = await createServerCaller();
  const animals = await caller.owner.listAnimals();
  const t = await getTranslations("owner");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("myAnimals")}</h1>

      {animals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          {t("noAnimals")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {animals.map((a) => (
            <Link key={a.id} href={`/owner/animals/${a.id}`}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  {a.profilePhotoUrl ? (
                    <div className="relative h-12 w-12 rounded-full overflow-hidden border shrink-0">
                      <Image src={a.profilePhotoUrl} alt={a.name} fill sizes="48px" className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.breed ?? a.species} · {a.barnName}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
