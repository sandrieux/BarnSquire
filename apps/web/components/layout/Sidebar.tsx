"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MapPin, User2, Settings, ShieldCheck, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  barnId?: string;
  isGlobalAdmin?: boolean;
}

export function Sidebar({ barnId, isGlobalAdmin }: SidebarProps) {
  const pathname = usePathname();

  const mainNav = [
    { href: "/today", label: "Today", icon: Home },
  ];

  const barnNav = barnId
    ? [
        { href: `/barns/${barnId}/animals`, label: "Animals", icon: User2 },
        { href: `/barns/${barnId}/locations`, label: "Locations", icon: MapPin },
        { href: `/barns/${barnId}/schedule`, label: "Schedule", icon: CalendarDays },
        { href: `/barns/${barnId}/stock`, label: "Stock", icon: Package },
        { href: `/barns/${barnId}/settings`, label: "Settings", icon: Settings },
      ]
    : [];

  const adminNav = isGlobalAdmin
    ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }]
    : [];

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-card h-screen sticky top-0">
      <div className="p-4 border-b">
        <Link href="/today" className="text-xl font-bold text-primary">
          BarnSquire
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNav.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} icon={<Icon className="h-4 w-4" />} active={pathname === href} />
        ))}
        {barnNav.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Barn</p>
            </div>
            {barnNav.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href} label={label} icon={<Icon className="h-4 w-4" />} active={pathname.startsWith(href)} />
            ))}
          </>
        )}
        {adminNav.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} icon={<Icon className="h-4 w-4" />} active={pathname.startsWith(href)} />
        ))}
      </nav>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
