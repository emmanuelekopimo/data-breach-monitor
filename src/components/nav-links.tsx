"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, KeyRound, LayoutDashboard, Radar, ShieldAlert } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/assets", label: "Monitored assets", icon: Radar },
  { href: "/exposures", label: "Exposures", icon: ShieldAlert, countKey: true },
  { href: "/breaches", label: "Breach intel", icon: Database },
  { href: "/password-check", label: "Password check", icon: KeyRound },
];

export function NavLinks({ openCount }: { openCount: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <span className="nav-label">Console</span>
      {LINKS.map(({ href, label, icon: Icon, countKey }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={16} aria-hidden />
            {label}
            {countKey && openCount > 0 ? <span className="count" aria-label={`${openCount} unresolved`}>{openCount}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
