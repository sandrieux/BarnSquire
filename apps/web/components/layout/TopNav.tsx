"use client";

import { BarnSwitcher } from "./BarnSwitcher";
import { UserMenu } from "./UserMenu";

interface TopNavProps {
  userName?: string | null;
  userEmail?: string | null;
  barns: Array<{ id: string; name: string; role: string }>;
  currentBarnId?: string;
}

export function TopNav({ userName, userEmail, barns, currentBarnId }: TopNavProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-10">
      <div className="flex-1">
        <BarnSwitcher barns={barns} currentBarnId={currentBarnId} />
      </div>
      <UserMenu userName={userName} userEmail={userEmail} />
    </header>
  );
}
