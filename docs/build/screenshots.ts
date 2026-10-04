/**
 * Captures documentation screenshots with numbered callouts drawn on key elements.
 * Expects the app to be running at `baseUrl` with freshly seeded demo data.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

export type Callout = { n: number; selector: string; text: string };
export type Shot = { id: string; title: string; intro: string; file: string; mobile?: boolean; callouts: Callout[] };

const ANNOTATION = "#e040fb";

/** Draws a numbered badge and outline on each callout target. */
async function annotate(page: Page, callouts: Callout[]) {
  await page.evaluate(
    ({ items, color }) => {
      document.querySelectorAll("[data-doc-callout]").forEach((n) => n.remove());
      for (const { n, selector } of items) {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Callout target not found: ${selector}`);
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        const left = r.left + window.scrollX;
        const box = document.createElement("div");
        box.setAttribute("data-doc-callout", "");
        Object.assign(box.style, {
          position: "absolute", top: `${top - 4}px`, left: `${left - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px`,
          border: `2px solid ${color}`, borderRadius: "8px", zIndex: "9998", pointerEvents: "none",
        });
        const badge = document.createElement("div");
        badge.setAttribute("data-doc-callout", "");
        badge.textContent = String(n);
        Object.assign(badge.style, {
          position: "absolute", top: `${Math.max(2, top - 14)}px`, left: `${Math.max(2, left - 14)}px`, width: "26px", height: "26px",
          borderRadius: "50%", background: color, color: "#fff", font: "700 14px/26px Inter, sans-serif", textAlign: "center",
          zIndex: "9999", boxShadow: "0 0 0 3px #070b11", pointerEvents: "none",
        });
        document.body.append(box, badge);
      }
    },
    { items: callouts.map(({ n, selector }) => ({ n, selector })), color: ANNOTATION },
  );
}

async function signIn(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/sign-in`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

export async function captureAll(baseUrl: string, outDir: string): Promise<Shot[]> {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const shots: Shot[] = [];
  const desk = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 });
  const page = await desk.newPage();

  async function take(shot: Omit<Shot, "file">, opts: { fullPage?: boolean; clipHeight?: number; p?: Page } = {}) {
    const p = opts.p ?? page;
    await p.evaluate(() => document.fonts.ready);
    await annotate(p, shot.callouts);
    const file = join(outDir, `${shot.id}.png`);
    if (opts.clipHeight) {
      const width = p.viewportSize()!.width;
      await p.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height: opts.clipHeight } });
    } else {
      await p.screenshot({ path: file, fullPage: opts.fullPage ?? true });
    }
    await p.evaluate(() => document.querySelectorAll("[data-doc-callout]").forEach((n) => n.remove()));
    shots.push({ ...shot, file });
  }

  // README screenshot without callouts
  await signIn(page, baseUrl);
  await page.screenshot({ path: join(outDir, "readme-dashboard.png"), fullPage: false });
  await desk.clearCookies();

  await page.goto(`${baseUrl}/sign-in`);
  await take(
    {
      id: "sign-in",
      title: "Sign in",
      intro: "The entry point. Every other page redirects here until a valid session cookie is present.",
      callouts: [
        { n: 1, selector: ".auth-art .facts", text: "Live catalog totals read from the database: verified breaches and accounts covered." },
        { n: 2, selector: ".demo-note", text: "The demo credentials are shown and already filled in, so the presenter only presses Sign in." },
        { n: 3, selector: ".auth-card form button[type=submit]", text: "Submits a Server Action. Input is validated with Zod and errors appear inline under each field. A wrong password shows one generic message so accounts cannot be enumerated." },
        { n: 4, selector: ".auth-card p a", text: "New users can create an account. A new account starts with no assets and cannot see anyone else's data." },
      ],
    },
    { fullPage: false },
  );

  await signIn(page, baseUrl);
  await take({
    id: "dashboard",
    title: "Overview dashboard",
    intro: "The landing page after sign in. It answers one question: how exposed am I right now, and what should I fix first?",
    callouts: [
      { n: 1, selector: "[data-testid=statusbar]", text: "Status bar: the business date in use (BREACHWATCH_TODAY), asset count, unresolved findings and the current threat level." },
      { n: 2, selector: "[data-testid=threat-gauge]", text: "Risk score from 0 to 100 and the threat level it maps to (low, guarded, elevated, severe)." },
      { n: 3, selector: "[data-testid=stat-overdue]", text: "Stat tiles: assets, unresolved, overdue (past the remediation deadline) and resolved findings." },
      { n: 4, selector: ".sevbars", text: "Unresolved findings by severity. Every bar carries its label and count, so color is never the only signal." },
      { n: 5, selector: "[data-testid=queue]", text: "Remediation queue: overdue first, then by severity, then by deadline. Each row links to the finding." },
      { n: 6, selector: "[data-testid=run-scan]", text: "Run scan checks every monitored asset against the leak index and records new findings." },
      { n: 7, selector: "form:has(button[aria-label='Reset demo data'])", text: "Reset demo data (demo account only) rebuilds the account's assets and findings relative to today, so every presentation starts from the same state." },
    ],
  });

  await page.getByTestId("run-scan").click();
  await page.getByTestId("scan-log").getByText("Scan complete").waitFor();
  await page.getByTestId("scan-log").scrollIntoViewIfNeeded();
  await take(
    {
      id: "scan",
      title: "Running a scan",
      intro: "The demo data contains leak records that earlier scans have not seen yet, so the first scan in a demo always finds something.",
      callouts: [
        { n: 1, selector: "[data-testid=scan-log]", text: "Scan log. Red lines are new findings with their severity, masked address and breach. The summary line counts new exposures." },
        { n: 2, selector: "[data-testid=run-scan]", text: "Scanning is idempotent: running it again adds nothing until the leak index changes." },
      ],
    },
    { fullPage: false },
  );

  await page.goto(`${baseUrl}/assets`);
  await take({
    id: "assets",
    title: "Monitored assets",
    intro: "The user's attack surface: email addresses and whole domains.",
    callouts: [
      { n: 1, selector: "[data-testid=add-asset-form] .form-row", text: "Add an email or a domain. Values are normalized (lowercased, trimmed) and validated with Zod. A scan runs immediately after adding." },
      { n: 2, selector: "[data-testid=assets-table] tbody tr:nth-child(5)", text: "A domain asset (*@northwind.example) matches every leaked address at that domain, which is how a company watches its staff." },
      { n: 3, selector: "[data-testid=assets-table] tbody tr:nth-child(4) td:nth-child(3)", text: "Worst status per asset. The recovery address is clean: it appears in no breach." },
      { n: 4, selector: "[data-testid=assets-table] tbody tr:first-child td:last-child button", text: "Stop monitoring. Asks for confirmation, then deletes the asset and its findings (scoped to the signed-in user)." },
    ],
  });

  await page.goto(`${baseUrl}/exposures?status=active`);
  await take({
    id: "exposures",
    title: "Exposures",
    intro: "Every finding, one row per identity per breach. Filters live in the URL, so a filtered view can be bookmarked.",
    callouts: [
      { n: 1, selector: "[data-testid=exposure-filters]", text: "Filter by status, severity or free text. This view shows all unresolved findings." },
      { n: 2, selector: "[data-testid=exposure-count]", text: "How many findings match out of the total." },
      { n: 3, selector: "[data-testid=exposures-table] tbody tr:first-child td:nth-child(3)", text: "Status computed from today's date: overdue, due soon (2 days or less), open or resolved." },
      { n: 4, selector: "[data-testid=exposures-table] tbody tr:first-child td:last-child", text: "Deadline column: days overdue in red, otherwise the time left and the due date." },
    ],
  });

  const canva = page.getByRole("link", { name: "Canva" });
  await canva.click();
  await page.waitForURL(/\/exposures\/\d+$/);
  await take({
    id: "exposure-detail",
    title: "Finding detail",
    intro: "Where the analyst works a finding to resolution.",
    callouts: [
      { n: 1, selector: ".page-head .row", text: "Severity and status badges, plus the asset that produced this finding." },
      { n: 2, selector: ".timeline", text: "Deadline timeline: detected date, deadline (detected + SLA days) and today. Overdue deadlines are outlined in red." },
      { n: 3, selector: ".steps", text: "Response checklist generated from the data types exposed. Passwords lead to password change, reuse check and MFA steps." },
      { n: 4, selector: "[data-testid=resolve]", text: "Mark resolved stamps today's date. Resolved after the deadline is reported as resolved late." },
      { n: 5, selector: ".chips", text: "Data exposed in the breach, each tagged with the severity that data type carries." },
    ],
  });

  await page.goto(`${baseUrl}/breaches`);
  await take(
    {
      id: "breaches",
      title: "Breach intel catalog",
      intro: "A searchable copy of the public Have I Been Pwned breach list, newest breach first.",
      callouts: [
        { n: 1, selector: ".page-head p", text: "Catalog size and source. The list is refreshed with npm run breaches:sync." },
        { n: 2, selector: "form.filters", text: "Search by service name or domain and filter by severity." },
        { n: 3, selector: ".breach-card", text: "Breach card: date, accounts affected, domain and severity derived from the exposed data types." },
      ],
    },
    { clipHeight: 860 },
  );

  await page.goto(`${baseUrl}/breaches/LinkedIn`);
  await take({
    id: "breach-detail",
    title: "Breach detail",
    intro: "Everything known about one breach, and whether it affects the signed-in user.",
    callouts: [
      { n: 1, selector: ".grid-4", text: "Key facts: accounts, breach date, date made public and number of data types." },
      { n: 2, selector: ".desc", text: "Description of the incident from the catalog." },
      { n: 3, selector: "[data-testid=your-exposure]", text: "Your exposure: the user's own findings in this breach, with status. Other users' data is never shown." },
    ],
  });

  await page.goto(`${baseUrl}/password-check`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Check password" }).click();
  await page.getByTestId("password-result").getByText("times seen").waitFor({ timeout: 20_000 });
  await take({
    id: "password-check",
    title: "Password check",
    intro: "A live check against Pwned Passwords. This is real data, not seed data.",
    callouts: [
      { n: 1, selector: "form.stack", text: "The password is posted to a Server Action. It is never stored or logged." },
      { n: 2, selector: "[data-testid=password-result] .callout", text: "Verdict: the number of times this password appears in breach corpora. Any appearance means do not use it." },
      { n: 3, selector: ".meter", text: "Local strength estimate (length and character variety), with hints." },
      { n: 4, selector: "[data-testid=password-result] .console", text: "k-anonymity in action: only the first 5 characters of the SHA-1 hash were sent to the API. The rest was compared on the server." },
    ],
  });
  await desk.close();

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mob.newPage();
  await signIn(mp, baseUrl);
  await take(
    {
      id: "mobile-dashboard",
      title: "Mobile: overview",
      mobile: true,
      intro: "",
      callouts: [
        { n: 1, selector: ".nav", text: "The sidebar becomes a top bar with a horizontally scrolling menu." },
        { n: 2, selector: "[data-testid=threat-gauge]", text: "Panels stack into one column." },
      ],
    },
    { clipHeight: 844, p: mp },
  );
  await mp.goto(`${baseUrl}/exposures`);
  await take(
    {
      id: "mobile-exposures",
      title: "Mobile: exposures",
      mobile: true,
      intro: "",
      callouts: [{ n: 3, selector: "[data-testid=exposures-table] tbody tr:first-child .show-sm", text: "On phones, severity and status move under the breach name so the table fits without sideways scrolling." }],
    },
    { clipHeight: 844, p: mp },
  );
  await mob.close();
  await browser.close();
  return shots;
}
