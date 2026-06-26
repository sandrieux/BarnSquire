import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Edit, ImageIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { AnimalTabs } from "./AnimalTabs";

type Capacity = {
  buildings: Array<{ id: string; name: string; stalls: Array<{ id: string; name: string }> }>;
  pastures: Array<{ id: string; name: string }>;
  arenas: Array<{ id: string; name: string }>;
};

type Animal = {
  id: string;
  name: string;
  breed?: string | null;
  size: string;
  color?: string | null;
  birthDate?: Date | string | null;
  markings?: string | null;
  microchipId?: string | null;
  registrationId?: string | null;
  notes?: string | null;
  profilePhotoUrl?: string | null;
  homeStall?: { name: string; building?: { name: string } | null } | null;
  homePasture?: { name: string } | null;
};

// Shared animal detail view used by the staff page (editable) and the owner
// portal (readOnly hides the Edit/Photos buttons and all tab edit controls).
export function AnimalProfile({
  animal,
  barnId,
  capacity,
  readOnly = false,
}: {
  animal: Animal;
  barnId: string;
  capacity: Capacity;
  readOnly?: boolean;
}) {
  const homeLocation = animal.homeStall
    ? `${animal.homeStall.building?.name} / ${animal.homeStall.name}`
    : animal.homePasture?.name ?? "No location assigned";

  return (
    <div className="space-y-6">
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
        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" asChild size="sm">
              <Link href={`/barns/${barnId}/animals/${animal.id}/photos`}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Photos
              </Link>
            </Button>
            <Button variant="outline" asChild size="sm">
              <Link href={`/barns/${barnId}/animals/${animal.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        )}
      </div>

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

      <AnimalTabs barnId={barnId} animalId={animal.id} capacity={capacity} readOnly={readOnly} />
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
