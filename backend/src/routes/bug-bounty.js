const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Vulnerability database
const vulnerabilities = [
  {
    id: "vuln_1",
    title: "SSRF in URL Scanner",
    severity: "critical",
    cvss: 9.1,
    status: "resolved",
    reporter: "researcher_1",
    reportedAt: "2025-07-01T00:00:00Z",
    resolvedAt: "2025-07-05T00:00:00Z",
    bounty: 5000,
    description: "The URL scanner endpoint allows SSRF via internal network IPs",
    impact: "Full server compromise",
    remediation: "IP allowlist + network segmentation",
  },
  {
    id: "vuln_2",
    title: "Stored XSS in Alert Descriptions",
    severity: "high",
    cvss: 7.5,
    status: "resolved",
    reporter: "researcher_2",
    reportedAt: "2025-07-10T00:00:00Z",
    resolvedAt: "2025-07-12T00:00:00Z",
    bounty: 2000,
    description: "Alert descriptions are not sanitized, allowing stored XSS",
    impact: "Session hijacking, data theft",
    remediation: "Input sanitization + CSP headers",
  },
  {
    id: "vuln_3",
    title: "Insufficient Rate Limiting on Auth Endpoints",
    severity: "medium",
    cvss: 5.3,
    status: "triaged",
    reporter: "researcher_3",
    reportedAt: "2025-07-20T00:00:00Z",
    resolvedAt: null,
    bounty: 500,
    description: "Login endpoint allows unlimited brute force attempts",
    impact: "Account compromise via brute force",
    remediation: "Implement account lockout + CAPTCHA",
  },
];

// Bounty leaderboard
const leaderboard = [
  { userId: "researcher_1", name: "Security Researcher A", reports: 12, resolved: 8, earned: 15000, rank: 1 },
  { userId: "researcher_2", name: "Security Researcher B", reports: 8, resolved: 6, earned: 8000, rank: 2 },
  { userId: "researcher_3", name: "Security Researcher C", reports: 5, resolved: 3, earned: 3500, rank: 3 },
];

// Severity tiers
const bountyTiers = {
  critical: { min: 3000, max: 10000, label: "Critical", color: "red" },
  high: { min: 1000, max: 3000, label: "High", color: "orange" },
  medium: { min: 250, max: 1000, label: "Medium", color: "yellow" },
  low: { min: 50, max: 250, label: "Low", color: "green" },
  informational: { min: 0, max: 50, label: "Informational", color: "blue" },
};

// Get all vulnerabilities
router.get("/vulnerabilities", authenticate, (req, res) => {
  const { severity, status } = req.query;
  let results = vulnerabilities;

  if (severity) results = results.filter(v => v.severity === severity);
  if (status) results = results.filter(v => v.status === status);

  return success(res, { vulnerabilities: results });
});

// Submit vulnerability
router.post("/vulnerabilities", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { title, severity, description, impact, remediation, proofOfConcept } = req.body;
  const db = req.app.get("db");

  if (!title || !severity || !description) {
    return error(res, "title, severity, and description required", 400);
  }

  const vuln = {
    id: "vuln_" + Date.now(),
    title,
    severity,
    cvss: severity === "critical" ? 9.0 : severity === "high" ? 7.5 : severity === "medium" ? 5.0 : 2.5,
    status: "submitted",
    reporter: userId,
    reportedAt: new Date().toISOString(),
    resolvedAt: null,
    bounty: bountyTiers[severity]?.min || 0,
    description,
    impact: impact || "Not specified",
    remediation: remediation || "Pending",
    proofOfConcept: proofOfConcept || null,
  };

  vulnerabilities.push(vuln);

  db.get("audit_logs").push({
    id: "audit_" + Date.now(),
    userId,
    action: "vuln_submitted",
    detail: `Submitted: ${title}`,
    timestamp: new Date().toISOString(),
  }).write();

  return success(res, { message: "Vulnerability submitted", vulnerability: vuln }, 201);
});

// Update vulnerability status
router.put("/vulnerabilities/:vulnId", authenticate, (req, res) => {
  const { vulnId } = req.params;
  const { status, bounty } = req.body;
  const vuln = vulnerabilities.find(v => v.id === vulnId);

  if (!vuln) return error(res, "Vulnerability not found", 404);

  if (status) vuln.status = status;
  if (bounty !== undefined) vuln.bounty = bounty;
  if (status === "resolved") vuln.resolvedAt = new Date().toISOString();

  return success(res, { message: "Vulnerability updated", vulnerability: vuln });
});

// Leaderboard
router.get("/leaderboard", authenticate, (req, res) => {
  return success(res, { leaderboard });
});

// Bounty tiers
router.get("/tiers", authenticate, (req, res) => {
  return success(res, { tiers: bountyTiers });
});

// Hall of fame
router.get("/hall-of-fame", authenticate, (req, res) => {
  const hallOfFame = leaderboard.map((entry, i) => ({
    ...entry,
    badge: i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "contributor",
    joinedDate: "2025-01-01",
  }));

  return success(res, { hallOfFame });
});

// Responsible disclosure policy
router.get("/policy", (req, res) => {
  return success(res, {
    policy: {
      name: "Enclave Responsible Disclosure Policy",
      version: "1.0",
      lastUpdated: "2025-01-01",
      scope: [
        "Enclave web application (enclave-react.vercel.app)",
        "Enclave API (enclave-production-d818.up.railway.app)",
        "Enclave Chrome extensions",
      ],
      outOfScope: [
        "Third-party services",
        "Social engineering",
        "Physical attacks",
      ],
      rules: [
        "Report vulnerabilities privately before public disclosure",
        "Do not access or modify data belonging to other users",
        "Do not perform denial of service attacks",
        "Allow 90 days for resolution before public disclosure",
      ],
      rewards: bountyTiers,
      contact: "security@enclave.app",
    },
  });
});

module.exports = router;
