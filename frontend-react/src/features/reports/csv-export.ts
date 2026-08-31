import type { Alert } from "@/lib/api";

export function exportAlertsCSV(alerts: Alert[]) {
  const headers = ["Date", "Type", "URL", "Description", "Confidence", "Status"];
  const rows = alerts.map((a) => [
    (a.created_at ? new Date(a.created_at) : new Date()).toISOString(),
    a.type || "",
    a.url || "",
    (a.description || "").replace(/"/g, '""'),
    String(Math.round(a.confidence ?? 0)),
    a.status || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `enclave-alerts-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
