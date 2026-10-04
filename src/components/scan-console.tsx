"use client";

import { useState, useTransition } from "react";
import { ScanSearch, Terminal } from "lucide-react";
import { runScanAction } from "@/app/actions/scan";
import type { ScanLogLine } from "@/server/scan";

function stamp() {
  return new Date().toISOString().slice(11, 19);
}

type Line = ScanLogLine & { ts: string };

export function ScanConsole({ assetCount }: { assetCount: number }) {
  const [lines, setLines] = useState<Line[]>([
    { level: "info", text: `Ready. ${assetCount} asset(s) queued. Press Run scan.`, ts: "--:--:--" },
  ]);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      setLines([{ level: "info", text: "Connecting to leak index and breach catalog...", ts: stamp() }]);
      const result = await runScanAction();
      for (const l of result.log) {
        await new Promise((r) => setTimeout(r, 110));
        setLines((prev) => [...prev, { ...l, ts: stamp() }]);
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          <Terminal size={16} aria-hidden /> Breach scanner
        </h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={pending} data-testid="run-scan">
          <ScanSearch size={14} aria-hidden />
          {pending ? "Scanning..." : "Run scan"}
        </button>
      </div>
      <div className="panel-body">
        <div className="console">
          <div className="console-head">
            <i /> <i /> <i /> <span>bw-scan --all-assets</span>
          </div>
          <div className="console-body" aria-live="polite" data-testid="scan-log">
            {lines.map((l, i) => (
              <div key={i} className={`console-line ln-${l.level}`}>
                <span className="ts">[{l.ts}]</span>
                {l.text}
              </div>
            ))}
            {pending ? <div className="console-line cursor" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
