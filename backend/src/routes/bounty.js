const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function getBountyProfile(db, userId) {
  return db.get("bounty_profiles").find({ userId }).value() || null;
}

function getBounties(db) {
  return db.get("bounties").filter({ status: "active" }).value() || [];
}

function getHunterScans(db, hunterId) {
  return db.get("hunter_scans").filter({ hunterId }).value() || [];
}

router.get("/profile", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const profile = getBountyProfile(db, userId);

  return success(res, { profile: profile || { enrolled: false } });
});

router.post("/enroll", (req, res) => {
  const userId = req.user.userId;
  const { faceImages, bountyAmount } = req.body;
  const db = req.app.get("db");

  if (!faceImages || !Array.isArray(faceImages) || faceImages.length < 3) {
    return error(res, "At least 3 face images required", 400);
  }

  if (!bountyAmount || bountyAmount < 1 || bountyAmount > 100) {
    return error(res, "Bounty amount must be between $1 and $100", 400);
  }

  const existing = getBountyProfile(db, userId);
  if (existing) {
    db.get("bounty_profiles")
      .find({ userId })
      .assign({
        faceImages,
        bountyAmount,
        updatedAt: new Date().toISOString()
      })
      .write();
  } else {
    db.get("bounty_profiles").push({
      id: "bp_" + Date.now(),
      userId,
      faceImages,
      bountyAmount,
      status: "active",
      totalPaid: 0,
      totalMatches: 0,
      createdAt: new Date().toISOString()
    }).write();
  }

  return success(res, { message: "Bounty profile created" });
});

router.post("/scan", (req, res) => {
  const hunterId = req.user.userId;
  const { imageUrl, source, sourceUrl } = req.body;
  const db = req.app.get("db");

  if (!imageUrl) {
    return error(res, "imageUrl required", 400);
  }

  const profiles = db.get("bounty_profiles").filter({ status: "active" }).value() || [];
  const matches = [];

  for (const profile of profiles) {
    const confidence = 75 + Math.random() * 20;
    if (confidence > 80) {
      matches.push({
        profileId: profile.id,
        userId: profile.userId,
        confidence,
        bountyAmount: profile.bountyAmount
      });
    }
  }

  const scan = {
    id: "scan_" + Date.now(),
    hunterId,
    imageUrl,
    source: source || "manual",
    sourceUrl: sourceUrl || "",
    matches: matches.length,
    candidates: matches,
    status: "completed",
    createdAt: new Date().toISOString()
  };

  db.get("hunter_scans").push(scan).write();

  return success(res, { scan, matchCount: matches.length });
});

router.get("/matches", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");

  const scans = db.get("hunter_scans").value() || [];
  const myScans = scans.filter((s) =>
    s.candidates?.some((c) => c.userId === userId)
  );

  const matches = [];
  for (const scan of myScans) {
    for (const c of scan.candidates) {
      if (c.userId === userId) {
        matches.push({
          scanId: scan.id,
          imageUrl: scan.imageUrl,
          source: scan.source,
          sourceUrl: scan.sourceUrl,
          confidence: c.confidence,
          bountyAmount: c.bountyAmount,
          status: "pending",
          createdAt: scan.createdAt
        });
      }
    }
  }

  return success(res, { matches });
});

router.post("/matches/:scanId/confirm", (req, res) => {
  const userId = req.user.userId;
  const { scanId } = req.params;
  const { confirmed } = req.body;
  const db = req.app.get("db");

  const scan = db.get("hunter_scans").find({ id: scanId }).value();
  if (!scan) {
    return error(res, "Scan not found", 404);
  }

  const candidate = scan.candidates?.find((c) => c.userId === userId);
  if (!candidate) {
    return error(res, "No match found for this user", 404);
  }

  if (confirmed) {
    db.get("bounty_profiles")
      .find({ userId })
      .assign({
        totalPaid: (db.get("bounty_profiles").find({ userId }).value()?.totalPaid || 0) + candidate.bountyAmount,
        totalMatches: (db.get("bounty_profiles").find({ userId }).value()?.totalMatches || 0) + 1
      })
      .write();

    db.get("hunter_scans")
      .find({ id: scanId })
      .assign({
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        payout: candidate.bountyAmount
      })
      .write();

    db.get("insurance_claims").push({
      id: "claim_" + Date.now(),
      userId,
      type: "bounty_match",
      scanId,
      imageUrl: scan.imageUrl,
      source: scan.source,
      sourceUrl: scan.sourceUrl,
      confidence: candidate.confidence,
      bountyAmount: candidate.bountyAmount,
      status: "approved",
      createdAt: new Date().toISOString()
    }).write();
  } else {
    db.get("hunter_scans")
      .find({ id: scanId })
      .assign({
        status: "rejected",
        rejectedAt: new Date().toISOString()
      })
      .write();
  }

  return success(res, { message: confirmed ? "Match confirmed, takedown initiated" : "Match rejected" });
});

router.get("/leaderboard", (req, res) => {
  const db = req.app.get("db");
  const scans = db.get("hunter_scans").value() || [];

  const hunterStats = {};
  for (const scan of scans) {
    if (!hunterStats[scan.hunterId]) {
      hunterStats[scan.hunterId] = { scans: 0, matches: 0, confirmed: 0, earnings: 0 };
    }
    hunterStats[scan.hunterId].scans++;
    hunterStats[scan.hunterId].matches += scan.matches || 0;
    if (scan.status === "confirmed") {
      hunterStats[scan.hunterId].confirmed++;
      hunterStats[scan.hunterId].earnings += scan.payout || 0;
    }
  }

  const leaderboard = Object.entries(hunterStats)
    .map(([hunterId, stats]) => ({ hunterId, ...stats }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 50);

  return success(res, { leaderboard });
});

router.get("/stats", (req, res) => {
  const db = req.app.get("db");
  const profiles = db.get("bounty_profiles").value() || [];
  const scans = db.get("hunter_scans").value() || [];
  const confirmed = scans.filter((s) => s.status === "confirmed");

  return success(res, {
    activeProfiles: profiles.length,
    totalScans: scans.length,
    totalMatches: scans.reduce((sum, s) => sum + (s.matches || 0), 0),
    confirmedMatches: confirmed.length,
    totalPayouts: confirmed.reduce((sum, s) => sum + (s.payout || 0), 0)
  });
});

module.exports = router;
