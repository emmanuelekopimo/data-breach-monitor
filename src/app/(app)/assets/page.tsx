import type { Metadata } from "next";
import { AtSign, Globe, Trash2 } from "lucide-react";
import { deleteAssetAction } from "@/app/actions/assets";
import { StatusBadge } from "@/components/badges";
import { ConfirmButton } from "@/components/confirm-button";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { MAX_ASSETS, listAssets } from "@/server/queries";
import { getToday } from "@/lib/today";
import { requireUser } from "@/server/session";
import { AddAssetForm } from "./add-asset-form";

export const metadata: Metadata = { title: "Monitored assets" };

export default async function AssetsPage() {
  const user = await requireUser();
  const today = getToday();
  const list = await listAssets(getDb(), user.id, today);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attack surface</div>
          <h1>Monitored assets</h1>
          <p>
            Email addresses are matched by SHA-256 hash against the leak index. A domain matches every leaked address at that domain, so you can watch a whole team. Up to {MAX_ASSETS} assets.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Add an asset</h2>
          <span className="hint">a scan runs as soon as it is added</span>
        </div>
        <div className="panel-body">
          <AddAssetForm />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{list.length} asset(s)</h2>
        </div>
        <div className="table-wrap">
          <table className="data" data-testid="assets-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Findings</th>
                <th>Worst status</th>
                <th className="hide-sm">Last scanned</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const s = a.summary;
                const worst = s.overdue ? "overdue" : s.dueSoon ? "due-soon" : s.unresolved ? "open" : null;
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <span className="asset-icon" aria-hidden>
                          {a.kind === "email" ? <AtSign size={16} /> : <Globe size={16} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <span className="row-link mono" style={{ overflowWrap: "anywhere" }}>
                            {a.kind === "domain" ? `*@${a.value}` : a.value}
                          </span>
                          <span className="cell-sub">
                            {a.kind}
                            {a.label ? ` / ${a.label}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="nowrap mono">
                      {s.unresolved} open / {s.total}
                    </td>
                    <td>{worst ? <StatusBadge status={worst} /> : <span className="badge st-resolved">{s.total ? "All resolved" : "Clean"}</span>}</td>
                    <td className="hide-sm nowrap text-2">{a.lastScannedOn ? formatDate(a.lastScannedOn) : "Never"}</td>
                    <td>
                      <form action={deleteAssetAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <ConfirmButton className="icon-btn" label={`Stop monitoring ${a.value}`} message={`Stop monitoring ${a.value}? Its ${s.total} finding(s) will be deleted.`}>
                          <Trash2 size={14} aria-hidden />
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
