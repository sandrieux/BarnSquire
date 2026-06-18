import { StallForm } from "@/components/locations/LocationForms";

export default async function NewStallPage({
  params,
}: {
  params: Promise<{ barnId: string; buildingId: string }>;
}) {
  const { barnId, buildingId } = await params;
  return <StallForm barnId={barnId} buildingId={buildingId} />;
}
