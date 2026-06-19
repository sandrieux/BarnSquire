import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Edit, ChevronLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { FeedingManager } from "@/components/feeding/FeedingManager";
import { AppointmentManager } from "@/components/appointments/AppointmentManager";
import { TurnoutManager } from "@/components/turnout/TurnoutManager";

export default async function AnimalProfilePage({
  params,
}: {
  params: Promise<{ barnId: string; animalId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, animalId } = await params;
  const caller = await createServerCaller();
  const [animal, capacity] = await Promise.all([
    caller.animal.get({ id: animalId }),
    caller.location.getCapacityStatus({ barnId }),
  ]);

  const homeLocation = animal.homeStall
    ? `${animal.homeStall.building?.name} / ${animal.homeStall.name}`
    : animal.homePasture?.name ?? "No location assigned";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back to list */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/barns/${barnId}/animals`}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          All animals
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {animal.profilePhotoUrl ? (
            <div className="relative h-20 w-20 rounded-full overflow-hidden border shrink-0">
              <Image
                src={animal.profilePhotoUrl}
                alt={animal.name}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground shrink-0">
              {animal.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{animal.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {animal.breed && <span className="text-muted-foreground">{animal.breed}</span>}
              <Badge variant="secondary">{animal.size}</Badge>
              {animal.color && <Badge variant="outline">{animal.color}</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" asChild size="sm">
          <Link href={`/barns/${barnId}/animals/${animalId}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Location">
            <MapPin className="h-3.5 w-3.5 inline mr-1" />
            {homeLocation}
          </Row>
          {animal.birthDate && (
            <Row label="Born">
              <Calendar className="h-3.5 w-3.5 inline mr-1" />
              {formatDate(animal.birthDate)}
            </Row>
          )}
          {animal.markings && <Row label="Markings">{animal.markings}</Row>}
          {animal.microchipId && <Row label="Microchip">{animal.microchipId}</Row>}
          {animal.registrationId && <Row label="Registration">{animal.registrationId}</Row>}
          {animal.notes && <Row label="Notes">{animal.notes}</Row>}
        </CardContent>
      </Card>

      {/* Feeding schedules — editable table */}
      <FeedingManager animalId={animalId} />

      {/* Appointments — editable table */}
      <AppointmentManager barnId={barnId} animalId={animalId} />

      {/* Turnout — editable table */}
      <TurnoutManager animalId={animalId} capacity={capacity} />

      {/* Photos */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/barns/${barnId}/animals/${animalId}/photos`}>Photos</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}
