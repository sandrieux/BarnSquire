import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { todayInTimeZone } from "@/lib/utils";
import { TodayClient } from "./TodayClient";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; barnId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const caller = await createServerCaller();
  const barns = await caller.barn.list();

  if (barns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <h2 className="text-xl font-semibold">No barns yet</h2>
        <p className="text-muted-foreground">Create your first barn to get started.</p>
        <a href="/barns/new" className="text-primary underline">Create a barn</a>
      </div>
    );
  }

  const barnId = params.barnId ?? barns[0]!.id;
  const barn = barns.find((b: { id: string }) => b.id === barnId);
  const barnTimeZone = barn?.timezone ?? "UTC";
  const explicit = !!params.date;
  const initialDate = params.date ?? todayInTimeZone(barnTimeZone);

  return (
    <TodayClient
      barnId={barnId}
      barns={barns}
      initialDate={initialDate}
      explicit={explicit}
      barnTimeZone={barnTimeZone}
    />
  );
}
