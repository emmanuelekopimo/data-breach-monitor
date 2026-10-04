/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { NavLinks } from "@/components/nav-links";
import { getDb } from "@/db";
import { getToday } from "@/lib/today";
import { getDashboard } from "@/server/queries";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const today = getToday();
  const { summary, assetCount } = await getDashboard(getDb(), user.id, today);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <div>
            <div className="brand-name">BREACHWATCH</div>
            <div className="brand-sub">SOC console</div>
          </div>
        </Link>
        <NavLinks openCount={summary.unresolved} />
        <div className="user-card">
          <Avatar seed={user.email} size={34} />
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <form action={signOut}>
            <button className="icon-btn" type="submit" aria-label="Sign out" title="Sign out">
              <LogOut size={15} aria-hidden />
            </button>
          </form>
        </div>
      </aside>
      <div className="main">
        <div className="statusbar" data-testid="statusbar">
          <span>
            <span className="live-dot" aria-hidden />
            <b>MONITORING</b>
          </span>
          <span>
            DATE <b>{today}</b> UTC
          </span>
          <span>
            ASSETS <b>{assetCount}</b>
          </span>
          <span>
            OPEN <b>{summary.unresolved}</b>
          </span>
          <span>
            THREAT <b className={`level-${summary.level}`}>{summary.level.toUpperCase()}</b>
          </span>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
