import { PastureForm } from "@/components/locations/LocationForms";

export default async function NewPasturePage({ params }: { params: Promise<{ barnId: string }> }) {
  const { barnId } = await params;
  return <PastureForm barnId={barnId} />;
}
