"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, PlusCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BarnSwitcherProps {
  barns: Array<{ id: string; name: string; role: string }>;
  currentBarnId?: string;
}

export function BarnSwitcher({ barns, currentBarnId }: BarnSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = barns.find((b) => b.id === currentBarnId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
      >
        <span className="truncate max-w-[200px]">
          {current?.name ?? "Select a barn"}
        </span>
        <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 min-w-[200px] rounded-md border bg-popover shadow-md">
            {barns.map((barn) => (
              <button
                key={barn.id}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm hover:bg-accent text-left",
                  barn.id === currentBarnId && "font-semibold text-primary"
                )}
                onClick={() => {
                  router.push(`/barns/${barn.id}/animals`);
                  setOpen(false);
                }}
              >
                {barn.name}
              </button>
            ))}
            <div className="border-t">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-muted-foreground"
                onClick={() => {
                  router.push("/barns/new");
                  setOpen(false);
                }}
              >
                <PlusCircle className="h-4 w-4" />
                New barn
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
