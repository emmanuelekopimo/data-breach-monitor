import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-form" style={{ minHeight: "100vh" }}>
      <div className="auth-card" style={{ textAlign: "center", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/radar-empty.svg" width={120} height={96} alt="" />
        <div className="eyebrow">Error 404</div>
        <h1>Nothing on the radar</h1>
        <p className="text-2">This page does not exist, or it belongs to another account.</p>
        <Link className="btn" href="/dashboard">
          Back to overview
        </Link>
      </div>
    </main>
  );
}
