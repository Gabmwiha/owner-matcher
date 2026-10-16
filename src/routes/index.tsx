import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { suggestMatches, type Match } from "@/lib/match.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Owner Matcher — Assign ownerless accounts" },
      { name: "description", content: "Match ownerless account records to owner profiles with AI and export to CSV." },
      { property: "og:title", content: "Owner Matcher" },
      { property: "og:description", content: "AI-suggested owners for ownerless accounts, with CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SAMPLE_ACCOUNTS = `id,name,email,team
a1,billing-bot,billing@acme.io,Finance
a2,ci-runner,devops@acme.io,Platform
a3,old-marketing,jane.d@acme.io,Marketing`;
const SAMPLE_OWNERS = `id,name,email,team
o1,Jane Doe,jane.doe@acme.io,Marketing
o2,Sam Lee,sam@acme.io,Platform
o3,Priya K,priya@acme.io,Finance`;

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).filter(Boolean).map((l) => l.split(",").map((c) => c.trim()));
}
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function Index() {
  const [accounts, setAccounts] = useState(SAMPLE_ACCOUNTS);
  const [owners, setOwners] = useState(SAMPLE_OWNERS);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ownerName = (id: string | null) => {
    if (!id) return "—";
    const row = parseCsv(owners).slice(1).find((r) => r[0] === id);
    return row ? `${row[1] ?? id} (${id})` : id;
  };

  async function run() {
    setLoading(true);
    setError("");
    try {
      setMatches(await suggestMatches({ data: { accounts, owners } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const rows = parseCsv(accounts);
    const header = rows[0] ?? ["id"];
    const byId = new Map(matches.map((m) => [m.account_id, m]));
    const lines = [
      [...header, "suggested_owner_id", "confidence", "reason"].map(esc).join(","),
      ...rows.slice(1).map((r) => {
        const m = byId.get(r[0] ?? "");
        return [...r, m?.owner_id ?? "", m ? m.confidence.toFixed(2) : "", m?.reason ?? ""].map(esc).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ownerless-accounts.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Owner Matcher</h1>
          <p className="text-muted-foreground mt-1">
            Paste ownerless accounts and owner profiles as CSV (first column is the id). AI suggests likely owners.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Ownerless accounts</span>
            <Textarea rows={8} value={accounts} onChange={(e) => setAccounts(e.target.value)} className="font-mono text-xs" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Owner profiles</span>
            <Textarea rows={8} value={owners} onChange={(e) => setOwners(e.target.value)} className="font-mono text-xs" />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={run} disabled={loading}>{loading ? "Matching…" : "Suggest matches"}</Button>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {matches.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Account</th><th className="p-3">Suggested owner</th><th className="p-3">Confidence</th><th className="p-3">Reason</th></tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.account_id} className="border-t">
                    <td className="p-3 font-mono">{m.account_id}</td>
                    <td className="p-3">{ownerName(m.owner_id)}</td>
                    <td className="p-3">{Math.round(m.confidence * 100)}%</td>
                    <td className="p-3 text-muted-foreground">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
