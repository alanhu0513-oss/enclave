const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Community IOC (Indicators of Compromise) database
const iocDatabase = [
  {
    id: "ioc_1",
    type: "deepfake_url",
    value: "https://malicious-deepfake-site.example.com",
    threat: "deepfake",
    severity: "critical",
    confidence: 0.92,
    reports: 15,
    region: "NA",
    firstSeen: "2025-01-10T00:00:00Z",
    lastSeen: "2025-08-01T00:00:00Z",
    reporter: "community",
    verified: true,
  },
  {
    id: "ioc_2",
    type: "fake_voice_hash",
    value: "a1b2c3d4e5f6...",
    threat: "voice_clone",
    severity: "high",
    confidence: 0.85,
    reports: 8,
    region: "EU",
    firstSeen: "2025-03-15T00:00:00Z",
    lastSeen: "2025-07-20T00:00:00Z",
    reporter: "verified",
    verified: true,
  },
  {
    id: "ioc_3",
    type: "deepfake_domain",
    value: "face-swap-app.net",
    threat: "deepfake",
    severity: "medium",
    confidence: 0.78,
    reports: 4,
    region: "APAC",
    firstSeen: "2025-06-01T00:00:00Z",
    lastSeen: "2025-07-28T00:00:00Z",
    reporter: "community",
    verified: false,
  },
];

// Get all IOCs
router.get("/iocs", authenticate, (req, res) => {
  const { type, threat, severity, region } = req.query;
  let results = iocDatabase;

  if (type) results = results.filter(i => i.type === type);
  if (threat) results = results.filter(i => i.threat === threat);
  if (severity) results = results.filter(i => i.severity === severity);
  if (region) results = results.filter(i => i.region === region);

  return success(res, { iocs: results, total: results.length });
});

// Report new IOC
router.post("/iocs", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { type, value, threat, severity, region } = req.body;
  const db = req.app.get("db");

  if (!type || !value || !threat) {
    return error(res, "type, value, and threat required", 400);
  }

  const ioc = {
    id: "ioc_" + Date.now(),
    type,
    value,
    threat,
    severity: severity || "medium",
    confidence: 0.5,
    reports: 1,
    region: region || "GLOBAL",
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    reporter: userId,
    verified: false,
    reportedBy: [userId],
  };

  iocDatabase.push(ioc);

  // Update reporter reputation
  const user = db.get("users").find({ id: userId }).value();
  if (user) {
    db.get("users").find({ id: userId }).assign({
      threatReports: (user.threatReports || 0) + 1,
    }).write();
  }

  return success(res, { message: "IOC reported", ioc }, "Created", 201);
});

// Corroborate existing IOC
router.post("/iocs/:iocId/corroborate", authenticate, (req, res) => {
  const userId = req.user.userId;
  const { iocId } = req.params;
  const ioc = iocDatabase.find(i => i.id === iocId);

  if (!ioc) return error(res, "IOC not found", 404);

  if (ioc.reportedBy && ioc.reportedBy.includes(userId)) {
    return error(res, "Already corroborated", 400);
  }

  ioc.reports += 1;
  ioc.lastSeen = new Date().toISOString();
  if (!ioc.reportedBy) ioc.reportedBy = [];
  ioc.reportedBy.push(userId);

  // Auto-verify at 3 reports
  if (ioc.reports >= 3 && !ioc.verified) {
    ioc.verified = true;
    ioc.confidence = Math.min(0.95, ioc.confidence + 0.1);
  }

  return success(res, { message: "IOC corroborated", ioc });
});

// Regional threat heatmap
router.get("/heatmap", authenticate, (req, res) => {
  const regions = ["NA", "EU", "APAC", "LATAM", "AF", "ME", "GLOBAL"];

  const heatmap = regions.map(region => {
    const regionIOCs = iocDatabase.filter(i => i.region === region || i.region === "GLOBAL");
    const critical = regionIOCs.filter(i => i.severity === "critical").length;
    const high = regionIOCs.filter(i => i.severity === "high").length;
    const medium = regionIOCs.filter(i => i.severity === "medium").length;
    const total = regionIOCs.length;

    return {
      region,
      total,
      critical,
      high,
      medium,
      threatLevel: total > 10 ? "severe" : total > 5 ? "high" : total > 2 ? "moderate" : "low",
    };
  });

  return success(res, { heatmap });
});

// Threat feed (for external consumers)
router.get("/feed", (req, res) => {
  const { format } = req.query;

  if (format === "stix") {
    // STIX 2.1 format
    const objects = iocDatabase.filter(i => i.verified).map(i => ({
      type: "indicator",
      spec_version: "2.1",
      id: `indicator--${i.id}`,
      created: i.firstSeen,
      modified: i.lastSeen,
      name: `${i.threat} indicator`,
      pattern: `[artifact:payload_bin = '${i.value}']`,
      pattern_type: "stix",
      valid_from: i.firstSeen,
      labels: [i.severity, i.threat],
    }));

    return success(res, { type: "bundle", objects });
  }

  // Default JSON format
  return success(res, {
    feed: iocDatabase.filter(i => i.verified),
    generated: new Date().toISOString(),
    count: iocDatabase.filter(i => i.verified).length,
  });
});

// Reputation system
router.get("/reputation/:userId", authenticate, (req, res) => {
  const { userId } = req.params;
  const db = req.app.get("db");
  const user = db.get("users").find({ id: userId }).value();

  if (!user) return error(res, "User not found", 404);

  const reports = user.threatReports || 0;
  const verified = iocDatabase.filter(i => i.reporter === userId && i.verified).length;

  return success(res, {
    userId,
    reports,
    verified,
    reputation: Math.min(100, reports * 10 + verified * 20),
    level: reports >= 50 ? "expert" : reports >= 20 ? "trusted" : reports >= 5 ? "contributor" : "newcomer",
  });
});

module.exports = router;
