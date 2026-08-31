const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();

const BOUNTY_TIERS = {
  critical: { min: 3000, max: 10000, label: "Critical", color: "red" },
  high: { min: 1000, max: 3000, label: "High", color: "orange" },
  medium: { min: 250, max: 1000, label: "Medium", color: "yellow" },
  low: { min: 50, max: 250, label: "Low", color: "green" },
  informational: { min: 0, max: 50, label: "Informational", color: "blue" },
};

// Get all vulnerabilities
router.get("/vulnerabilities", authenticate, async (req, res) => {
  try {
    const { severity, status } = req.query;
    const tbl = await table("bug_bounty_vulns");
    let results = await tbl.all();

    if (severity) results = results.filter(v => v.severity === severity);
    if (status) results = results.filter(v => v.status === status);

    return success(res, { vulnerabilities: results });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Submit vulnerability
router.post("/vulnerabilities", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, severity, description, impact, remediation, proofOfConcept } = req.body;

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
      reported_at: new Date().toISOString(),
      resolved_at: null,
      bounty: BOUNTY_TIERS[severity]?.min || 0,
      description,
      impact: impact || "Not specified",
      remediation: remediation || "Pending",
      proof_of_concept: proofOfConcept || null,
    };

    const tbl = await table("bug_bounty_vulns");
    await tbl.insert(vuln);

    const auditTbl = await table("audit_logs");
    await auditTbl.insert({
      id: "audit_" + Date.now(),
      user_id: userId,
      action: "vuln_submitted",
      detail: `Submitted: ${title}`,
    });

    return success(res, { message: "Vulnerability submitted", vulnerability: vuln }, 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Update vulnerability status
router.put("/vulnerabilities/:vulnId", authenticate, async (req, res) => {
  try {
    const { vulnId } = req.params;
    const { status, bounty } = req.body;

    const tbl = await table("bug_bounty_vulns");
    const vuln = await tbl.find({ id: vulnId });
    if (!vuln) return error(res, "Vulnerability not found", 404);

    const updates = {};
    if (status) updates.status = status;
    if (bounty !== undefined) updates.bounty = bounty;
    if (status === "resolved") updates.resolved_at = new Date().toISOString();

    await tbl.update({ id: vulnId }, updates);
    return success(res, { message: "Vulnerability updated" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Leaderboard
router.get("/leaderboard", authenticate, async (req, res) => {
  try {
    const tbl = await table("bug_bounty_leaderboard");
    const leaderboard = await tbl.all();
    return success(res, { leaderboard });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Bounty tiers
router.get("/tiers", authenticate, (req, res) => {
  return success(res, { tiers: BOUNTY_TIERS });
});

// Hall of fame
router.get("/hall-of-fame", authenticate, async (req, res) => {
  try {
    const tbl = await table("bug_bounty_leaderboard");
    const leaderboard = await tbl.all();
    const hallOfFame = leaderboard.map((entry, i) => ({
      ...entry,
      badge: i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "contributor",
      joinedDate: "2025-01-01",
    }));
    return success(res, { hallOfFame });
  } catch (e) {
    return error(res, e.message, 500);
  }
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
      outOfScope: ["Third-party services", "Social engineering", "Physical attacks"],
      rules: [
        "Report vulnerabilities privately before public disclosure",
        "Do not access or modify data belonging to other users",
        "Do not perform denial of service attacks",
        "Allow 90 days for resolution before public disclosure",
      ],
      rewards: BOUNTY_TIERS,
      contact: "security@enclave.app",
    },
  });
});

module.exports = router;
