import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StockManager } from "@/components/stock/StockManager";

export default async function StockPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feed stock</h1>
        <p className="text-muted-foreground text-sm">
          Track on-hand feed and get a refill reminder before you run out.
        </p>
      </div>
      <StockManager barnId={barnId} />
    </div>
  );
}
