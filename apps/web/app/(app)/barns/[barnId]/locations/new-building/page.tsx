import { BuildingForm } from "@/components/locations/LocationForms";

export default async function NewBuildingPage({ params }: { params: Promise<{ barnId: string }> }) {
  const { barnId } = await params;
  return <BuildingForm barnId={barnId} />;
}
