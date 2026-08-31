const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();

const SEED_IOCS = [
  { id: "ioc_1", type: "deepfake_url", value: "https://malicious-deepfake-site.example.com", threat: "deepfake", severity: "critical", confidence: 0.92, reports: 15, region: "NA", first_seen: "2025-01-10T00:00:00Z", last_seen: "2025-08-01T00:00:00Z", reporter: "community", verified: true, reported_by: "[]" },
  { id: "ioc_2", type: "fake_voice_hash", value: "a1b2c3d4e5f6...", threat: "voice_clone", severity: "high", confidence: 0.85, reports: 8, region: "EU", first_seen: "2025-03-15T00:00:00Z", last_seen: "2025-07-20T00:00:00Z", reporter: "verified", verified: true, reported_by: "[]" },
  { id: "ioc_3", type: "deepfake_domain", value: "face-swap-app.net", threat: "deepfake", severity: "medium", confidence: 0.78, reports: 4, region: "APAC", first_seen: "2025-06-01T00:00:00Z", last_seen: "2025-07-28T00:00:00Z", reporter: "community", verified: false, reported_by: "[]" },
];

async function ensureSeeded() {
  const tbl = await table("ioc_indicators");
  const count = await tbl.count();
  if (count === 0) {
    for (const ioc of SEED_IOCS) await tbl.insert(ioc);
  }
}

// Get all IOCs
router.get("/iocs", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const { type, threat, severity, region } = req.query;
    const tbl = await table("ioc_indicators");
    let results = await tbl.all();
    if (type) results = results.filter(i => i.type === type);
    if (threat) results = results.filter(i => i.threat === threat);
    if (severity) results = results.filter(i => i.severity === severity);
    if (region) results = results.filter(i => i.region === region);
    return success(res, { iocs: results, total: results.length });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Report new IOC
router.post("/iocs", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, value, threat, severity, region } = req.body;
    if (!type || !value || !threat) return error(res, "type, value, and threat required", 400);

    const tbl = await table("ioc_indicators");
    const ioc = {
      id: "ioc_" + Date.now(),
      user_id: userId,
      type,
      value,
      threat,
      severity: severity || "medium",
      confidence: 0.5,
      reports: 1,
      region: region || "GLOBAL",
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      reporter: userId,
      verified: false,
      reported_by: JSON.stringify([userId]),
    };
    await tbl.insert(ioc);

    const usersTbl = await table("users");
    const user = await usersTbl.find({ id: userId });
    if (user) {
      await usersTbl.update({ id: userId }, { threat_reports: (user.threat_reports || 0) + 1 });
    }

    return success(res, { message: "IOC reported", ioc }, "Created", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Corroborate existing IOC
router.post("/iocs/:iocId/corroborate", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("ioc_indicators");
    const ioc = await tbl.find({ id: req.params.iocId });
    if (!ioc) return error(res, "IOC not found", 404);

    const reportedBy = typeof ioc.reported_by === 'string' ? JSON.parse(ioc.reported_by) : (ioc.reported_by || []);
    if (reportedBy.includes(userId)) return error(res, "Already corroborated", 400);

    reportedBy.push(userId);
    const newReports = (ioc.reports || 0) + 1;
    const newVerified = newReports >= 3 ? true : ioc.verified;
    const newConfidence = newReports >= 3 && !ioc.verified ? Math.min(0.95, (ioc.confidence || 0.5) + 0.1) : ioc.confidence;

    await tbl.update({ id: req.params.iocId }, {
      reports: newReports,
      last_seen: new Date().toISOString(),
      reported_by: JSON.stringify(reportedBy),
      verified: newVerified,
      confidence: newConfidence,
    });

    return success(res, { message: "IOC corroborated" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Regional threat heatmap
router.get("/heatmap", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const tbl = await table("ioc_indicators");
    const allIOCs = await tbl.all();
    const regions = ["NA", "EU", "APAC", "LATAM", "AF", "ME", "GLOBAL"];

    const heatmap = regions.map(region => {
      const regionIOCs = allIOCs.filter(i => i.region === region || i.region === "GLOBAL");
      const critical = regionIOCs.filter(i => i.severity === "critical").length;
      const high = regionIOCs.filter(i => i.severity === "high").length;
      const medium = regionIOCs.filter(i => i.severity === "medium").length;
      const total = regionIOCs.length;
      return {
        region, total, critical, high, medium,
        threatLevel: total > 10 ? "severe" : total > 5 ? "high" : total > 2 ? "moderate" : "low",
      };
    });
    return success(res, { heatmap });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Threat feed
router.get("/feed", async (req, res) => {
  try {
    await ensureSeeded();
    const { format } = req.query;
    const tbl = await table("ioc_indicators");
    const allIOCs = await tbl.all();
    const verified = allIOCs.filter(i => i.verified);

    if (format === "stix") {
      const objects = verified.map(i => ({
        type: "indicator", spec_version: "2.1", id: `indicator--${i.id}`,
        created: i.first_seen, modified: i.last_seen,
        name: `${i.threat} indicator`,
        pattern: `[artifact:payload_bin = '${i.value}']`,
        pattern_type: "stix", valid_from: i.first_seen,
        labels: [i.severity, i.threat],
      }));
      return success(res, { type: "bundle", objects });
    }

    return success(res, { feed: verified, generated: new Date().toISOString(), count: verified.length });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Reputation system
router.get("/reputation/:userId", authenticate, async (req, res) => {
  try {
    const usersTbl = await table("users");
    const user = await usersTbl.find({ id: req.params.userId });
    if (!user) return error(res, "User not found", 404);

    const reports = user.threat_reports || 0;
    const iocTbl = await table("ioc_indicators");
    const allIOCs = await iocTbl.all();
    const verified = allIOCs.filter(i => i.reporter === req.params.userId && i.verified).length;

    return success(res, {
      userId: req.params.userId,
      reports, verified,
      reputation: Math.min(100, reports * 10 + verified * 20),
      level: reports >= 50 ? "expert" : reports >= 20 ? "trusted" : reports >= 5 ? "contributor" : "newcomer",
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
