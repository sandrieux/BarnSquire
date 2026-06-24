"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FeedingManager } from "@/components/feeding/FeedingManager";
import { AppointmentManager } from "@/components/appointments/AppointmentManager";
import { TurnoutManager } from "@/components/turnout/TurnoutManager";
import { ExerciseManager } from "@/components/exercise/ExerciseManager";
import { cn } from "@/lib/utils";

// Minimal structural type matching what the server page passes (avoids the
// Date-vs-string mismatch of using RouterOutputs across the client boundary).
type Capacity = {
  buildings: Array<{ id: string; name: string; stalls: Array<{ id: string; name: string }> }>;
  pastures: Array<{ id: string; name: string }>;
  arenas: Array<{ id: string; name: string }>;
};

const TABS = ["Feeding", "Appointments", "Turnout", "Exercise"] as const;
type Tab = (typeof TABS)[number];

export function AnimalTabs({
  barnId,
  animalId,
  capacity,
}: {
  barnId: string;
  animalId: string;
  capacity: Capacity;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = TABS.find((t) => t.toLowerCase() === searchParams.get("tab"));
  const [active, setActive] = useState<Tab>(tabFromUrl ?? "Feeding");

  function selectTab(tab: Tab) {
    setActive(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab.toLowerCase());
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 border-b overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            onClick={() => selectTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {active === "Feeding" && <FeedingManager animalId={animalId} />}
        {active === "Appointments" && <AppointmentManager barnId={barnId} animalId={animalId} />}
        {active === "Turnout" && <TurnoutManager animalId={animalId} capacity={capacity} />}
        {active === "Exercise" && (
          <ExerciseManager
            animalId={animalId}
            locations={{ pastures: capacity.pastures, arenas: capacity.arenas }}
          />
        )}
      </div>
    </div>
  );
}
