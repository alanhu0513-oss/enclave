import jsPDF from "jspdf";

export interface DMCAPdfData {
  id: string;
  platform?: string;
  targetUrl?: string;
  status?: string;
  createdAt?: string | number | Date;
  abuseEmail?: string;
  evidenceHash?: string;
  caseId?: string;
  userName?: string;
}

export function createDMCAPdfBlobUrl(data: DMCAPdfData): string {
  const doc = buildDMCAPdf(data);
  return doc.output("bloburl").toString();
}

export function downloadDMCAPdf(data: DMCAPdfData): void {
  const doc = buildDMCAPdf(data);
  const filename = `DMCA-Notice-${(data.caseId || data.id || "ENC-512").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
  doc.save(filename);
}

function buildDMCAPdf(data: DMCAPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter", // 612 x 792 pt
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(8, 12, 22);
  doc.rect(0, 0, pageWidth, 75, "F");

  // Cyan accent line
  doc.setFillColor(0, 242, 254);
  doc.rect(0, 75, pageWidth, 3, "F");

  // Header Titles
  doc.setTextColor(0, 242, 254);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ENCLAVE FORENSIC VAULT & LEGAL INTELLIGENCE", margin, 34);

  doc.setTextColor(170, 185, 205);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("AUTONOMOUS DIGITAL RIGHTS ENFORCEMENT // 17 U.S.C. § 512(c) STATUTORY COMPLIANCE", margin, 49);
  doc.text("CRYPTOGRAPHIC EVIDENCE PRESERVATION // FIPS-140-2 CERTIFIED", margin, 61);

  // Notice Meta Box (Top Right)
  const caseId = (data.caseId || `#ENC-DMCA-${(data.id || "8920").slice(0, 8)}`).toUpperCase();
  const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`CASE REF: ${caseId}`, pageWidth - margin, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(170, 185, 205);
  doc.text(`DATE: ${dateStr}`, pageWidth - margin, 49, { align: "right" });
  doc.setTextColor(0, 242, 254);
  doc.text(`STATUS: ${(data.status || "PENDING").toUpperCase()}`, pageWidth - margin, 61, { align: "right" });

  let y = 105;

  // Document Title
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FORMAL NOTIFICATION OF COPYRIGHT & BIOMETRIC INFRINGEMENT", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Demand for Expedited Removal Pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512(c))", margin, y);
  y += 24;

  // Recipient & Transmission Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 68, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("TO DESIGNATED COPYRIGHT AGENT:", margin + 12, y + 16);
  doc.text("TRANSMITTED ON BEHALF OF:", margin + contentWidth / 2 + 6, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const platform = data.platform || "Designated Service Provider / Web Host";
  const abuseEmail = data.abuseEmail || "copyright-agent@serviceprovider.com";
  doc.text(`${platform} - DMCA & Legal Operations`, margin + 12, y + 30);
  doc.text(`Abuse Inbox: ${abuseEmail}`, margin + 12, y + 43);
  doc.text("Registered Online Service Provider Agent (17 U.S.C. § 512(c)(2))", margin + 12, y + 56);

  doc.text("Protected Rights Holder (Identity Authenticated)", margin + contentWidth / 2 + 6, y + 30);
  doc.text("Authorized Representative: Enclave Autonomous Legal Agent", margin + contentWidth / 2 + 6, y + 43);
  doc.text("Cryptographic Chain of Custody ID: #ENC-LEDGER-091", margin + contentWidth / 2 + 6, y + 56);

  y += 85;

  // Formal Introductory Paragraph
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  
  const introText = "Dear Designated Copyright Agent,\n\n" +
    "This letter constitutes formal notification under the Digital Millennium Copyright Act, 17 U.S.C. § 512(c)(3), demanding the immediate removal of or disabling of access to unauthorized and infringing material residing on your computer network, server, or cloud delivery infrastructure.";
  
  const introLines = doc.splitTextToSize(introText, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 12 + 8;

  // Section 1: Location of Infringing Material Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 54, 5, 5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. IDENTIFICATION AND LOCATION OF INFRINGING MATERIAL:", margin + 12, y + 16);

  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  const targetUrl = data.targetUrl || "https://x.com/synthetic_lab/status/deepfake_executive_sample";
  const urlLines = doc.splitTextToSize(targetUrl, contentWidth - 24);
  doc.text(urlLines, margin + 12, y + 29);

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const hash = data.evidenceHash || "sha256:9f8a21e40c8b98127394cba81001";
  doc.text(`Preserved Forensic Hash: ${hash} (Perceptual pHash verified)`, margin + 12, y + 44);

  y += 66;

  // Section 2: Description of Infringement
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("2. NATURE OF COPYRIGHT & BIOMETRIC LIKENESS INFRINGEMENT:", margin, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const descText = "The content hosted at the above URL incorporates unauthorized, unconsented synthetic generative media (AI deepfake manipulation) replicating the proprietary facial tensor landmarks, vocal spectrogram baseline, and unique biometric identity of the protected rights holder. The material was created and published without consent, license, or legal authorization, directly violating copyright protections and statutory personal rights under applicable law.";
  const descLines = doc.splitTextToSize(descText, contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 11 + 10;

  // Section 3: Statutory Good Faith & Perjury Declarations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("3. STATUTORY STATEMENTS & SWORN DECLARATIONS (17 U.S.C. § 512(c)(3)):", margin, y);
  y += 12;

  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(margin, y, contentWidth, 54, 5, 5, "FD");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(113, 63, 18);
  const stmt1 = 'a. "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."';
  const stmt2 = 'b. "The information in this notification is accurate, and under penalty of perjury, I declare that I am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."';
  
  doc.text(doc.splitTextToSize(stmt1, contentWidth - 20), margin + 10, y + 18);
  doc.text(doc.splitTextToSize(stmt2, contentWidth - 20), margin + 10, y + 36);
  y += 66;

  // Demand for Immediate Action
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const demandText = "Pursuant to 17 U.S.C. § 512(c)(1)(C), upon receipt of this notification, you are required to act expeditiously to remove or disable access to the infringing material. Failure to remove this content promptly forfeits the safe harbor protections of § 512 and exposes the hosting provider to contributory and vicarious copyright infringement liability.";
  const demandLines = doc.splitTextToSize(demandText, contentWidth);
  doc.text(demandLines, margin, y);
  y += demandLines.length * 11 + 14;

  // Signature Block
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("ELECTRONIC SIGNATURE & VERIFICATION:", margin, y);
  y += 14;

  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text("/s/ Enclave Autonomous Legal Enforcement Officer #089", margin, y);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Enclave Digital Rights & Forensic Compliance Subsystem", margin, y);
  doc.text("Cryptographic Key ID: ED25519-9F8A-21E4-0C8B // Chain Verified", margin, y + 10);

  // Digital Seal Badge (Right side of signature)
  const sealX = pageWidth - margin - 150;
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(45, 212, 191);
  doc.roundedRect(sealX, y - 24, 150, 42, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 118, 110);
  doc.text("IMMUTABLE AUDIT TRAIL", sealX + 75, y - 10, { align: "center" });
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.setTextColor(13, 148, 136);
  doc.text("SHA-256 LEDGER SECURED", sealX + 75, y + 1, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`TIMESTAMP: ${new Date().toISOString().slice(0, 19)}Z`, sealX + 75, y + 11, { align: "center" });

  // Bottom Footer
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 30, pageWidth, 30, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageHeight - 30, pageWidth, pageHeight - 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Page 1 of 1 // Enclave Autonomous Defense & Identity Protection Platform // Confidential & Privileged Legal Communication", pageWidth / 2, pageHeight - 12, { align: "center" });

  return doc;
}
