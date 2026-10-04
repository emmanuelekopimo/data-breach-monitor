/**
 * Builds docs/BreachWatch-Documentation.pdf.
 *
 *   npm run build      (once, the docs use the production build)
 *   npm run docs:pdf
 *
 * Steps: reseed the breachwatch_docs database with BREACHWATCH_TODAY pinned,
 * start the app, capture annotated screenshots, render the HTML below with
 * embedded fonts and images, and print it to PDF with Chromium.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createDb } from "../../src/db";
import { readCatalogFile } from "../../src/server/catalog";
import { DEMO_EMAIL, DEMO_PASSWORD, resetDatabase, seedDemo } from "../../src/server/seed";
import { SLA_DAYS, SEVERITY_WEIGHT } from "../../src/lib/severity";
import { captureAll, type Shot } from "./screenshots";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "build", "out");
const PDF = join(ROOT, "docs", "BreachWatch-Documentation.pdf");
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const TODAY = "2026-10-04";
const DB_URL = process.env.DOCS_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/breachwatch_docs";
const LIVE_URL = "https://breachwatch-production.up.railway.app";

const TESTS = { unit: 47, integration: 17, e2eDesktop: 14, e2eMobile: 1 };

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

async function waitForHealth(url: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become healthy at ${url}`);
}

function dataUri(path: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

function fontFaces(): string {
  const fonts: [string, string, number][] = [
    ["Inter", "@fontsource/inter/files/inter-latin-400-normal.woff2", 400],
    ["Inter", "@fontsource/inter/files/inter-latin-500-normal.woff2", 500],
    ["Inter", "@fontsource/inter/files/inter-latin-600-normal.woff2", 600],
    ["Inter", "@fontsource/inter/files/inter-latin-700-normal.woff2", 700],
    ["JetBrains Mono", "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", 400],
    ["JetBrains Mono", "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", 700],
  ];
  return fonts
    .map(([family, file, weight]) => `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(${dataUri(join(ROOT, "node_modules", file), "font/woff2")}) format("woff2");}`)
    .join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shotBlock(s: Shot): string {
  return `
  <figure class="shot">
    <h3>${esc(s.title)}</h3>
    ${s.intro ? `<p>${esc(s.intro)}</p>` : ""}
    <img src="${dataUri(s.file, "image/png")}" alt="${esc(s.title)}">
    <ol class="callouts">${s.callouts.map((c) => `<li value="${c.n}"><span class="n">${c.n}</span>${esc(c.text)}</li>`).join("")}</ol>
  </figure>`;
}

function mobileBlock(shots: Shot[]): string {
  return `
  <div class="mobile-pair">
    ${shots.map((s) => `<figure><img src="${dataUri(s.file, "image/png")}" alt="${esc(s.title)}"><figcaption>${esc(s.title)}</figcaption></figure>`).join("")}
  </div>
  <ol class="callouts">${shots.flatMap((s) => s.callouts).map((c) => `<li value="${c.n}"><span class="n">${c.n}</span>${esc(c.text)}</li>`).join("")}</ol>`;
}

const ARCH_SVG = `
<svg viewBox="0 0 760 330" xmlns="http://www.w3.org/2000/svg" font-family="Inter" font-size="12">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#4b5d73"/></marker></defs>
  <g stroke="#4b5d73" stroke-width="1.5" fill="none" marker-end="url(#a)">
    <line x1="120" y1="60" x2="198" y2="60"/>
    <line x1="380" y1="60" x2="448" y2="60"/>
    <line x1="290" y1="88" x2="290" y2="128"/>
    <line x1="290" y1="188" x2="290" y2="228"/>
    <line x1="380" y1="158" x2="448" y2="158"/>
    <line x1="380" y1="258" x2="448" y2="258"/>
    <line x1="540" y1="186" x2="540" y2="228"/>
  </g>
  <g fill="#0f1b2a" stroke="#22d3ee" stroke-width="1.5">
    <rect x="10" y="35" width="110" height="50" rx="8"/>
    <rect x="200" y="35" width="180" height="50" rx="8"/>
    <rect x="200" y="130" width="180" height="56" rx="8"/>
    <rect x="200" y="230" width="180" height="56" rx="8"/>
    <rect x="450" y="35" width="180" height="50" rx="8"/>
    <rect x="450" y="130" width="180" height="56" rx="8"/>
    <rect x="450" y="230" width="180" height="56" rx="8"/>
  </g>
  <g fill="#e3ebf5" text-anchor="middle">
    <text x="65" y="57" font-weight="600">Browser</text><text x="65" y="73" fill="#9fb0c4" font-size="10">desktop or phone</text>
    <text x="290" y="57" font-weight="600">proxy.ts</text><text x="290" y="73" fill="#9fb0c4" font-size="10">JWT cookie check, redirects</text>
    <text x="290" y="152" font-weight="600">App Router</text><text x="290" y="168" fill="#9fb0c4" font-size="10">Server Components, Server Actions</text>
    <text x="290" y="252" font-weight="600">src/server</text><text x="290" y="268" fill="#9fb0c4" font-size="10">queries (user scoped), scan, seed</text>
    <text x="540" y="57" font-weight="600">api.pwnedpasswords.com</text><text x="540" y="73" fill="#9fb0c4" font-size="10">5 char SHA-1 prefix only</text>
    <text x="540" y="152" font-weight="600">src/lib (pure rules)</text><text x="540" y="168" fill="#9fb0c4" font-size="10">severity, deadlines, risk, today</text>
    <text x="540" y="252" font-weight="600">PostgreSQL</text><text x="540" y="268" fill="#9fb0c4" font-size="10">via Drizzle ORM</text>
  </g>
  <text x="390" y="52" fill="#6b7f96" font-size="10">password check</text>
  <text x="390" y="150" fill="#6b7f96" font-size="10">calls</text>
  <text x="390" y="250" fill="#6b7f96" font-size="10">SQL</text>
  <text x="10" y="318" fill="#6b7f96" font-size="10">Offline: scripts/sync-breaches.ts downloads the public HIBP breach list into data/breaches.json, which the seed loads into the breaches table.</text>
</svg>`;

function html(shots: Shot[], logo: string): string {
  const deskShots = shots.filter((s) => !s.mobile);
  const mobile = shots.filter((s) => s.mobile);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BreachWatch Documentation</title>
<style>
${fontFaces()}
@page { size: A4; margin: 16mm 15mm 18mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
body { font-family: Inter, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1b2430; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 6pt; color: #0b1622; }
h2 { font-size: 15pt; margin: 0 0 10pt; padding-bottom: 6pt; border-bottom: 2px solid #22d3ee; color: #0b1622; break-after: avoid; }
h3 { font-size: 12pt; margin: 14pt 0 6pt; color: #0b1622; break-after: avoid; }
p { margin: 0 0 8pt; }
code, .mono { font-family: "JetBrains Mono", monospace; font-size: 9pt; }
code { background: #eef3f8; padding: 1px 4px; border-radius: 3px; }
pre { font-family: "JetBrains Mono", monospace; font-size: 8.8pt; background: #0b1622; color: #d6e2ef; padding: 10pt 12pt; border-radius: 6px; white-space: pre-wrap; break-inside: avoid; margin: 0 0 10pt; }
table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; font-size: 9.5pt; break-inside: avoid; }
th, td { text-align: left; padding: 5pt 7pt; border-bottom: 1px solid #d5dee8; vertical-align: top; }
th { background: #eef3f8; font-weight: 600; }
ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
li { margin-bottom: 3pt; }
section { break-before: page; }
.cover { height: 296mm; display: flex; flex-direction: column; justify-content: center; gap: 14pt; background: #070b11; color: #e3ebf5; margin: 0; padding: 0 24mm; }
.cover h1 { color: #fff; font-size: 34pt; font-family: "JetBrains Mono", monospace; letter-spacing: 1pt; }
.cover .sub { font-size: 14pt; color: #9fb0c4; }
.cover .meta { font-family: "JetBrains Mono", monospace; font-size: 10pt; color: #9fb0c4; line-height: 1.9; }
.cover .meta b { color: #22d3ee; font-weight: 400; }
.cover img { width: 80px; }
.toc li { margin-bottom: 4pt; }
.note { border-left: 3px solid #22d3ee; background: #f1f8fb; padding: 8pt 10pt; margin: 0 0 10pt; break-inside: avoid; }
.shot { margin: 0 0 14pt; break-inside: avoid-page; }
.shot img { width: 100%; border: 1px solid #c5d0dc; border-radius: 6px; display: block; margin-bottom: 8pt; }
.callouts { list-style: none; padding: 0; margin: 0; }
.callouts li { display: flex; gap: 8pt; margin-bottom: 4pt; font-size: 9.8pt; }
.callouts .n { flex: none; width: 17pt; height: 17pt; border-radius: 50%; background: #e040fb; color: #fff; font-weight: 700; font-size: 9pt; display: inline-grid; place-items: center; }
.mobile-pair { display: flex; gap: 16pt; justify-content: center; margin-bottom: 10pt; }
.mobile-pair figure { margin: 0; width: 46%; text-align: center; }
.mobile-pair img { width: 100%; border: 1px solid #c5d0dc; border-radius: 10px; }
.mobile-pair figcaption { font-size: 9pt; color: #5b6b7d; margin-top: 4pt; }
.arch { background: #070b11; border-radius: 8px; padding: 10pt; margin: 0 0 12pt; }
.script { font-size: 8.8pt; line-height: 1.4; }
.script td { padding: 3pt 6pt; }
.qa li { font-size: 9pt; margin-bottom: 1pt; line-height: 1.4; }
.script td:first-child { white-space: nowrap; font-family: "JetBrains Mono", monospace; font-size: 9pt; }
.sev { display: inline-block; padding: 0 6pt; border-radius: 8pt; font-size: 8.5pt; font-weight: 600; color: #fff; }
.critical { background: #d03b3b; } .high { background: #c8643c; } .medium { background: #b07c00; } .low { background: #3b78d8; }
</style></head><body>

<div class="cover">
  <img src="${logo}" alt="">
  <h1>BREACHWATCH</h1>
  <div class="sub">A data breach monitor for email addresses and company domains.<br>Project documentation and presentation guide.</div>
  <div class="meta">
    Live app <b>${LIVE_URL}</b><br>
    Demo login <b>${DEMO_EMAIL}</b> / <b>${DEMO_PASSWORD}</b><br>
    Stack <b>Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Railway</b><br>
    Screenshots taken with BREACHWATCH_TODAY=<b>${TODAY}</b>
  </div>
</div>

<section>
<h2>Contents</h2>
<ol class="toc">
  <li>Overview</li><li>How the core logic works</li><li>Architecture and data model</li><li>Screen walkthrough</li>
  <li>Mobile view</li><li>Running locally</li><li>Testing</li><li>Deployment</li><li>Five-minute presentation script</li>
</ol>

<h2 style="margin-top:18pt">1. Overview</h2>
<p>BreachWatch tells a person or a small company when their email addresses show up in a known data breach, how serious each exposure is, and what to do about it before a deadline. It looks and works like a small security operations console.</p>
<h3>The problem</h3>
<p>Billions of account records have leaked from breached services. Leaked passwords are tried on other sites (credential stuffing), and leaked names, phone numbers and dates of birth make phishing and identity fraud easier. Most people never find out which of their accounts were affected, and when they do, nothing tracks whether they acted on it.</p>
<h3>What the app does</h3>
<ul>
  <li><b>Monitors assets.</b> A user adds email addresses, or a whole domain to cover every address at a company.</li>
  <li><b>Scans a leak index.</b> Each scan matches the assets against an index of leaked addresses (stored only as SHA-256 hashes) and records new findings, called exposures.</li>
  <li><b>Scores and schedules.</b> Each exposure gets a severity from the data types that leaked and a remediation deadline from that severity. The dashboard turns open and overdue findings into a 0 to 100 risk score.</li>
  <li><b>Guides the response.</b> Each finding has a checklist built from the leaked data types (change password, enable MFA, contact the bank, and so on), notes, and a resolve button.</li>
  <li><b>Breach intel.</b> A searchable catalog of ${"885"} real, verified breaches from the public Have I Been Pwned breach list.</li>
  <li><b>Password check.</b> A live check of any password against the Pwned Passwords corpus using k-anonymity, so the password never leaves the server.</li>
</ul>
<h3>Real data and demo data</h3>
<div class="note">The breach catalog and the password check use <b>real</b> public data. The per-email leak index is <b>demo data</b>: the real per-address lookup (HIBP breachedaccount API) needs a paid key. The app supports that API through the optional <code>HIBP_API_KEY</code> variable; without it, scans use the seeded leak index. All demo addresses use reserved <code>.example</code> domains.</div>
</section>

<section>
<h2>2. How the core logic works</h2>
<p>All business rules are pure functions in <code>src/lib/</code>. They take "today" as an argument and never read the clock themselves, so demos and tests are deterministic. <code>getToday()</code> returns <code>BREACHWATCH_TODAY</code> when it is set (format YYYY-MM-DD) and the real UTC date otherwise.</p>
<h3>Severity (src/lib/severity.ts)</h3>
<p>A breach takes the severity of the most dangerous data type it exposed. The same severity is copied onto every exposure from that breach.</p>
<table>
<tr><th>Severity</th><th>Triggered by (examples)</th><th>Deadline</th><th>Risk points</th></tr>
<tr><td><span class="sev critical">CRITICAL</span></td><td>Passwords, auth tokens, credit cards, bank accounts, government IDs, security answers</td><td>${SLA_DAYS.critical} days</td><td>${SEVERITY_WEIGHT.critical}</td></tr>
<tr><td><span class="sev high">HIGH</span></td><td>Dates of birth, phone numbers, addresses, partial card data, health data, private messages</td><td>${SLA_DAYS.high} days</td><td>${SEVERITY_WEIGHT.high}</td></tr>
<tr><td><span class="sev medium">MEDIUM</span></td><td>Names, usernames, IP addresses, locations, employers</td><td>${SLA_DAYS.medium} days</td><td>${SEVERITY_WEIGHT.medium}</td></tr>
<tr><td><span class="sev low">LOW</span></td><td>Only the email address or other low-risk data</td><td>${SLA_DAYS.low} days</td><td>${SEVERITY_WEIGHT.low}</td></tr>
</table>
<h3>Status (src/lib/exposure.ts)</h3>
<pre>dueOn = detectedOn + deadline days for the severity

status(exposure, today):
  resolvedOn is set            -> RESOLVED
  today is after dueOn         -> OVERDUE
  dueOn is 0 to 2 days away    -> DUE SOON
  otherwise                    -> OPEN</pre>
<p>A finding resolved after its deadline still counts as resolved, but the detail page labels it "resolved late".</p>
<h3>Risk score and threat level</h3>
<pre>score = sum over unresolved exposures of
          risk points for its severity  x 1.5 if overdue
score = min(100, round(score))

threat level: 0-14 LOW, 15-44 GUARDED, 45-74 ELEVATED, 75-100 SEVERE</pre>
<p>Example from the demo data: 3 critical (2 overdue), 2 high (1 overdue) and 2 medium gives 18 + 18 + 12 + 9 + 6 + 2 + 2 = 67, which is ELEVATED. After the demo scan adds four findings the score passes 75 and the level becomes SEVERE.</p>
<h3>Remediation queue order</h3>
<p>Overdue first, then due soon, then open, then resolved. Inside each group: critical before high before medium before low, then earliest deadline first.</p>
<h3>Scanning (src/server/scan.ts)</h3>
<ol>
  <li>Load the user's assets. Email assets go before domain assets.</li>
  <li>Email asset: hash the normalized address with SHA-256 and look it up in <code>leak_records.email_hash</code>. If <code>HIBP_API_KEY</code> is set, the live HIBP API is also asked and its breach names are matched to the catalog.</li>
  <li>Domain asset: find every leak record whose <code>email_domain</code> equals the domain.</li>
  <li>Insert one exposure per (user, breach, address hash) with <code>ON CONFLICT DO NOTHING</code>, so repeated scans never create duplicates and an address monitored directly owns its findings.</li>
  <li>Write a row to <code>scans</code> and return a log that the dashboard console prints line by line.</li>
</ol>
<h3>Password check (src/lib/password.ts)</h3>
<pre>sha1("password123") = CBFDAC6008F9CAB4083784CBD1874F76618D2A97
send:     GET https://api.pwnedpasswords.com/range/CBFDA   (prefix, 5 chars)
receive:  ~800 lines of "SUFFIX:COUNT" (padded)
compare:  find C6008F9CAB4083784CBD1874F76618D2A97 locally -> count</pre>
<p>Any count above zero means "compromised, do not use". If the API cannot be reached, only the strength estimate is shown and the page says so.</p>
</section>

<section>
<h2>3. Architecture and data model</h2>
<div class="arch">${ARCH_SVG}</div>
<h3>Request flow</h3>
<ul>
  <li><b>proxy.ts</b> (Next.js 16 replaces middleware with proxy) reads the session cookie and redirects signed-out visitors to /sign-in, and signed-in users away from it. It does not touch the database.</li>
  <li><b>Pages</b> are async Server Components. Each one calls <code>requireUser()</code>, which verifies the JWT and loads the user, then reads data through <code>src/server/queries.ts</code>.</li>
  <li><b>Mutations</b> are Server Actions in <code>src/app/actions/</code>. Forms validate with Zod and return field errors that render inline. Selects are uncontrolled (<code>defaultValue</code>) because React 19 resets forms after an action.</li>
  <li><b>Every query that touches user data takes userId and filters on it.</b> Integration tests check that a second user cannot read, change or delete the demo user's data.</li>
</ul>
<h3>Authentication</h3>
<p>Passwords are hashed with bcryptjs (cost 10). On sign in the server signs an HS256 JWT with <code>jose</code> (subject = user id, 8 hour expiry) and stores it in an HTTP-only, SameSite=Lax cookie, marked Secure in production. Unknown email and wrong password give the same message. Responses also carry security headers: X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy and Permissions-Policy.</p>
<h3>Tables (src/db/schema.ts, migration drizzle/0000_init.sql)</h3>
<table>
<tr><th>Table</th><th>Purpose</th><th>Key columns</th></tr>
<tr><td>users</td><td>Accounts</td><td>email (unique), password_hash</td></tr>
<tr><td>breaches</td><td>Public breach catalog, shared</td><td>name (unique), breach_date, pwn_count, data_classes text[], severity</td></tr>
<tr><td>leak_records</td><td>Threat intel index, shared</td><td>email_hash (SHA-256), email_masked, email_domain, breach_id</td></tr>
<tr><td>assets</td><td>What a user monitors</td><td>user_id, kind (email or domain), value, label, last_scanned_on; unique (user_id, kind, value)</td></tr>
<tr><td>exposures</td><td>Findings</td><td>user_id, asset_id, breach_id, severity, detected_on, due_on, resolved_on, steps_done text[], notes; unique (user_id, breach_id, email_hash)</td></tr>
<tr><td>scans</td><td>Scan audit log</td><td>user_id, ran_on, assets_checked, records_matched, new_exposures</td></tr>
</table>
<p>Deleting a user cascades to assets, exposures and scans. Deleting an asset cascades to its exposures. The leak index stores no plain email addresses, only a hash and a masked form such as <code>ad********@example.com</code>.</p>
<h3>Project layout</h3>
<table>
<tr><td><code>src/lib/</code></td><td>Pure rules: dates, today, severity, exposure status and risk, remediation steps, password, identity, validation, auth tokens</td></tr>
<tr><td><code>src/server/</code></td><td>Database work: queries (user scoped), scan, catalog loader, seed, session</td></tr>
<tr><td><code>src/app/</code></td><td>Routes: (auth) sign-in and sign-up, (app) dashboard, assets, exposures, breaches, password-check, api/health</td></tr>
<tr><td><code>src/components/</code></td><td>Badges, threat gauge, severity bars, scan console, form helpers</td></tr>
<tr><td><code>scripts/</code></td><td>migrate, seed, sync-breaches</td></tr>
<tr><td><code>tests/</code></td><td>unit, integration (real Postgres) and e2e (Playwright)</td></tr>
</table>
</section>

<section>
<h2>4. Screen walkthrough</h2>
<p>Numbered pink markers on each screenshot match the numbered notes under it.</p>
${deskShots.map(shotBlock).join("\n")}
</section>

<section>
<h2>5. Mobile view</h2>
<p>The layout is a single CSS grid that collapses below 860px. Grids use <code>minmax(0, 1fr)</code> so long values cannot push the page wider than the screen, and the e2e mobile test asserts that the page never scrolls sideways on a Pixel 7.</p>
<p>These two captures were taken after the demo scan, so the dashboard shows the SEVERE level.</p>
${mobileBlock(mobile)}
</section>

<section>
<h2>6. Running locally</h2>
<p>Requirements: Node.js 22 and PostgreSQL 14 or newer.</p>
<pre>service postgresql start
sudo -u postgres createdb breachwatch
sudo -u postgres createdb breachwatch_test

cp .env.example .env          # set DATABASE_URL and SESSION_SECRET
npm install
npm run db:migrate            # apply drizzle/ migrations
npm run db:seed               # reset and load demo data
npm run dev                   # http://localhost:3000</pre>
<table>
<tr><th>Variable</th><th>Required</th><th>Meaning</th></tr>
<tr><td>DATABASE_URL</td><td>yes</td><td>Postgres connection string</td></tr>
<tr><td>SESSION_SECRET</td><td>in production</td><td>Signs session cookies (16+ characters)</td></tr>
<tr><td>BREACHWATCH_TODAY</td><td>no</td><td>Pins "today" (YYYY-MM-DD) for demos and tests</td></tr>
<tr><td>HIBP_API_KEY</td><td>no</td><td>Enables live per-email lookups during scans</td></tr>
</table>
<h3>Scripts</h3>
<table>
<tr><td><code>npm run dev / build / start</code></td><td>Next.js development server, production build, production server</td></tr>
<tr><td><code>npm run start:prod</code></td><td>Migrate, seed only if empty, then start (used by Railway)</td></tr>
<tr><td><code>npm run db:generate</code></td><td>Create a new SQL migration from schema changes (drizzle-kit)</td></tr>
<tr><td><code>npm run breaches:sync</code></td><td>Refresh data/breaches.json from the public HIBP breach list</td></tr>
<tr><td><code>npm test</code></td><td>Unit and integration tests (Vitest)</td></tr>
<tr><td><code>npm run test:e2e</code></td><td>Playwright tests (builds and starts the app on port 3100)</td></tr>
<tr><td><code>npm run docs:pdf</code></td><td>Rebuild this PDF (needs a prior npm run build)</td></tr>
</table>
</section>

<section>
<h2>7. Testing</h2>
<table>
<tr><th>Suite</th><th>Tool</th><th>Tests</th><th>What it covers</th></tr>
<tr><td>Unit</td><td>Vitest</td><td>${TESTS.unit}</td><td>Dates and today, severity, deadlines, status, risk score and levels, queue order, k-anonymity parsing, password strength, email hashing and masking, Zod schemas, remediation steps, text cleaning, JWT sign and verify (including expiry and wrong secret)</td></tr>
<tr><td>Integration</td><td>Vitest + real Postgres (breachwatch_test)</td><td>${TESTS.integration}</td><td>Seed produces every status, dashboard summary, catalog search, scan finds pending records, scan is idempotent, live lookup used and its failure tolerated, user scoping on every read and write, duplicate assets, resolve and reopen, cascade delete, demo reset restores the starting state and leaves other users alone</td></tr>
<tr><td>End to end, desktop</td><td>Playwright, Chromium 1440x900</td><td>${TESTS.e2eDesktop}</td><td>Redirects, pre-filled demo login, wrong password, sign-up inline errors, new user isolation (404 on another user's finding), sign out, dashboard, scan, reset demo data, add asset with validation, delete asset, filters, checklist, notes, resolve, catalog, live password check</td></tr>
<tr><td>End to end, mobile</td><td>Playwright, Pixel 7</td><td>${TESTS.e2eMobile}</td><td>Sign in, dashboard, navigation, finding detail, no horizontal overflow</td></tr>
<tr><th>Total</th><th></th><th>${TESTS.unit + TESTS.integration + TESTS.e2eDesktop + TESTS.e2eMobile}</th><th>All passing before deployment</th></tr>
</table>
<p>The integration suite drops and recreates the test schema from the committed migrations before running, so it also proves the migrations apply cleanly. The e2e suite reseeds the database through the same seed code before each spec and pins <code>BREACHWATCH_TODAY=${TODAY}</code>.</p>
<pre>npm test                 # ${TESTS.unit + TESTS.integration} unit + integration tests
npm run test:e2e         # ${TESTS.e2eDesktop + TESTS.e2eMobile} Playwright tests (desktop + mobile)</pre>
</section>

<section>
<h2>8. Deployment (Railway)</h2>
<p>The app runs in the Railway project <b>school-projects</b> as the service <b>breachwatch</b>, with its own database service <b>breachwatch-postgres</b>. Railway builds from the GitHub repository with Railpack (Node 22 from <code>engines</code>).</p>
<pre>{
  "build":  { "builder": "RAILPACK", "buildCommand": "npm run build" },
  "deploy": { "startCommand": "npm run start:prod",
              "healthcheckPath": "/api/health", "healthcheckTimeout": 120,
              "restartPolicyType": "ON_FAILURE" }
}</pre>
<ul>
  <li><b>Start command</b>: <code>tsx scripts/migrate.ts && tsx scripts/seed.ts --if-empty && next start -H 0.0.0.0</code>. Migrations always run; demo data is loaded only when the users table is empty, so redeploys never wipe data.</li>
  <li><b>Variables</b>: <code>DATABASE_URL=\${{breachwatch-postgres.DATABASE_URL}}</code> (a reference, resolved by Railway to the private network address), a random 64 character <code>SESSION_SECRET</code>, and <code>NODE_ENV=production</code>.</li>
  <li><b>Health check</b>: <code>GET /api/health</code> runs <code>select 1</code> against the database and returns <code>{"status":"ok","database":"ok"}</code>, or HTTP 503 if the database is unreachable, so Railway only routes traffic to a healthy deploy.</li>
  <li><b>Public URL</b>: <code>${LIVE_URL}</code></li>
</ul>
<h3>Redeploying</h3>
<p>Push to the connected branch and Railway rebuilds automatically. Redeploys keep existing data. To put the demo account back to its starting state, sign in as the demo user and press <b>Reset demo data</b> on the dashboard. It only affects the demo account.</p>
</section>

<section>
<h2>9. Five-minute presentation script</h2>
<p>Before you start: sign in on the live URL and press <b>Reset demo data</b> on the dashboard. This rebuilds the demo account relative to today, so the numbers below match. Then sign out and leave the sign-in page open. Keep this PDF open as a backup.</p>
<table class="script">
<tr><th>Time</th><th>Do</th><th>Say</th></tr>
<tr><td>0:00 - 0:40</td><td>Sign-in page.</td><td>"Billions of accounts have leaked in data breaches, and most people never find out which of theirs were affected. BreachWatch monitors your email addresses and your company domain, tells you how serious each exposure is, and tracks the fix against a deadline. The catalog on the left is real: 885 verified breaches from Have I Been Pwned."</td></tr>
<tr><td>0:40 - 1:40</td><td>Press Sign in (the demo login is pre-filled). Point at the gauge, the tiles and the queue.</td><td>"This is the analyst console. The risk score is 67, ELEVATED, because three findings are past their deadline. Severity comes from what leaked: passwords are critical and must be fixed in 3 days, dates of birth are high with 7 days. The queue puts overdue critical findings first."</td></tr>
<tr><td>1:40 - 2:20</td><td>Press Run scan. Let the log print. Reload.</td><td>"A scan hashes each address and checks it against the leak index. It found four new exposures, including a password leak from Fanlore in August 2026, and the threat level is now SEVERE. Scanning twice adds nothing, it is idempotent."</td></tr>
<tr><td>2:20 - 3:10</td><td>Exposures, filter Overdue, open Canva. Tick Turn on MFA, then Mark resolved.</td><td>"Each finding has a deadline timeline and a checklist generated from the leaked data. Canva leaked passwords, so the steps are change it, replace reused passwords and turn on MFA. I mark it resolved; it was two days late, so the app records it as resolved late."</td></tr>
<tr><td>3:10 - 3:40</td><td>Monitored assets. Add demo.user@example.net.</td><td>"I can monitor a single address or a whole domain. Adding an asset triggers a scan straight away: this address is in four breaches. Input is validated, so a bad domain or a duplicate shows an inline error."</td></tr>
<tr><td>3:40 - 4:20</td><td>Password check. Type password123.</td><td>"This one is live. The password never leaves our server: we send only the first five characters of its SHA-1 hash, CBFDA, and compare the rest ourselves. That is k-anonymity. password123 has been seen over two million times."</td></tr>
<tr><td>4:20 - 5:00</td><td>Show the phone view (or this PDF, section 5) and finish on the dashboard.</td><td>"Built with Next.js 16 Server Components and Server Actions, Drizzle and Postgres, deployed on Railway with a health check that pings the database. Every query is scoped to the signed-in user. ${TESTS.unit + TESTS.integration + TESTS.e2eDesktop + TESTS.e2eMobile} automated tests cover the rules, the database and the screens on desktop and mobile. Thank you."</td></tr>
</table>
<h3>Likely questions</h3>
<ul class="qa">
  <li><b>Is the email data real?</b> The breach catalog and password check are real. The per-email index is demo data because the real lookup API is paid; set HIBP_API_KEY to use it.</li>
  <li><b>Do you store emails or passwords?</b> Passwords checked on the password page are never stored. The leak index stores only SHA-256 hashes and masked addresses. Account passwords are bcrypt hashes.</li>
  <li><b>Why does the date say 4 Oct 2026?</b> Rules take "today" as a parameter, and BREACHWATCH_TODAY can pin it for repeatable demos and tests.</li>
</ul>
</section>
</body></html>`;
}

async function main() {
  const { db, client } = createDb(DB_URL, 1);
  const env = { ...process.env, DATABASE_URL: DB_URL, BREACHWATCH_TODAY: TODAY, SESSION_SECRET: "docs-secret-0123456789abcdef", NODE_ENV: "production" as const };
  await run("npx", ["tsx", "scripts/migrate.ts"], env);
  await resetDatabase(db);
  await seedDemo(db, readCatalogFile(), TODAY);
  await client.end();

  let server: ChildProcess | undefined;
  try {
    server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
    await waitForHealth(`${BASE}/api/health`);
    const shots = await captureAll(BASE, OUT);
    copyFileSync(join(OUT, "readme-dashboard.png"), join(ROOT, "docs", "screenshots", "dashboard.png"));

    const page = html(shots, dataUri(join(ROOT, "public", "logo.svg"), "image/svg+xml"));
    const htmlPath = join(OUT, "documentation.html");
    writeFileSync(htmlPath, page);
    const banned = page.replace(/data:[^"')]+/g, "").match(/[\u2013\u2014\u2018\u2019\u201C\u201D]/g);
    if (banned) throw new Error(`Typographic characters found in documentation: ${banned.join(" ")}`);

    const browser = await chromium.launch();
    const p = await browser.newPage();
    await p.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({
      path: PDF,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7f96;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>BreachWatch documentation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      preferCSSPageSize: true,
    });
    await browser.close();
    console.log(`Wrote ${PDF}`);
  } finally {
    if (server?.pid) process.kill(-server.pid);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
