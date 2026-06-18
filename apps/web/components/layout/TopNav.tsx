"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarnSwitcher } from "./BarnSwitcher";

interface TopNavProps {
  userName?: string | null;
  barns: Array<{ id: string; name: string; role: string }>;
  currentBarnId?: string;
}

export function TopNav({ userName, barns, currentBarnId }: TopNavProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-10">
      <div className="flex-1">
        <BarnSwitcher barns={barns} currentBarnId={currentBarnId} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">{userName}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => signOut({ callbackUrl: "/login" })}
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
