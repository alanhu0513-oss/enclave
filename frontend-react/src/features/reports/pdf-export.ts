import jsPDF from "jspdf";
import type { UserData } from "@/lib/api";

export function generateScanReport(data: UserData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(4, 6, 10);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(0, 255, 136);
  doc.setFontSize(24);
  doc.text("ENCLAVE", 20, 25);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text("Identity Protection Report", 20, 33);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 20, 33, { align: "right" });

  // Summary
  let y = 55;
  doc.setTextColor(0, 191, 255);
  doc.setFontSize(14);
  doc.text("Summary", 20, y);
  y += 10;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  const alerts = data.alerts || [];
  const critical = alerts.filter((a) => (a.confidence ?? 0) >= 80).length;
  const elevated = alerts.filter((a) => (a.confidence ?? 0) >= 50 && (a.confidence ?? 0) < 80).length;
  const safe = alerts.filter((a) => (a.confidence ?? 0) < 50).length;

  doc.text(`Total Alerts: ${alerts.length}`, 20, y); y += 7;
  doc.text(`Critical: ${critical}`, 20, y); y += 7;
  doc.text(`Elevated: ${elevated}`, 20, y); y += 7;
  doc.text(`Safe: ${safe}`, 20, y); y += 15;

  // Alerts Table
  doc.setTextColor(0, 191, 255);
  doc.setFontSize(14);
  doc.text("Alert Details", 20, y);
  y += 10;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Date", 20, y);
  doc.text("Type", 60, y);
  doc.text("Confidence", 100, y);
  doc.text("Status", 140, y);
  y += 5;
  doc.line(20, y, pageWidth - 20, y);
  y += 5;

  doc.setTextColor(60, 60, 60);
  for (const alert of alerts.slice(0, 20)) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const conf = alert.confidence ?? 0;
    const date = alert.created_at ? new Date(alert.created_at) : new Date();
    doc.text(date.toLocaleDateString(), 20, y);
    doc.text(alert.type || "detection", 60, y);
    doc.text(`${Math.round(conf)}%`, 100, y);
    doc.text(alert.status || "open", 140, y);
    y += 7;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `ENCLAVE Identity Protection — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" },
    );
  }

  doc.save(`enclave-report-${new Date().toISOString().split("T")[0]}.pdf`);
}
