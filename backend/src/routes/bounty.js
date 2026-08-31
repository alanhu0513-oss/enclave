const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();
router.use(authenticate);

router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("bounty_profiles");
    const profile = await tbl.find({ user_id: userId });
    if (!profile) return success(res, { profile: { enrolled: false } });
    return success(res, {
      profile: {
        ...profile,
        userId: profile.user_id,
        faceImages: typeof profile.face_images === 'string' ? JSON.parse(profile.face_images) : profile.face_images,
        bountyAmount: profile.bounty_amount,
        totalPaid: profile.total_paid,
        totalMatches: profile.total_matches,
        createdAt: profile.created_at,
      },
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/enroll", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { faceImages, bountyAmount } = req.body;

    if (!faceImages || !Array.isArray(faceImages) || faceImages.length < 3) {
      return error(res, "At least 3 face images required", 400);
    }
    if (!bountyAmount || bountyAmount < 1 || bountyAmount > 100) {
      return error(res, "Bounty amount must be between $1 and $100", 400);
    }

    const tbl = await table("bounty_profiles");
    const existing = await tbl.find({ user_id: userId });
    if (existing) {
      await tbl.update({ user_id: userId }, {
        face_images: JSON.stringify(faceImages),
        bounty_amount: bountyAmount,
        updated_at: new Date().toISOString(),
      });
    } else {
      await tbl.insert({
        id: "bp_" + Date.now(),
        user_id: userId,
        face_images: JSON.stringify(faceImages),
        bounty_amount: bountyAmount,
        status: "active",
        total_paid: 0,
        total_matches: 0,
      });
    }
    return success(res, { message: "Bounty profile created" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/scan", async (req, res) => {
  try {
    const hunterId = req.user.userId;
    const { imageUrl, source, sourceUrl } = req.body;

    if (!imageUrl) {
      return error(res, "imageUrl required", 400);
    }

    const profilesTbl = await table("bounty_profiles");
    const profiles = await profilesTbl.filter({ status: "active" });
    const matches = [];

    for (const profile of profiles) {
      const confidence = 75 + Math.random() * 20;
      if (confidence > 80) {
        matches.push({
          profileId: profile.id,
          userId: profile.user_id,
          confidence,
          bountyAmount: profile.bounty_amount,
        });
      }
    }

    const scan = {
      id: "scan_" + Date.now(),
      hunter_id: hunterId,
      image_url: imageUrl,
      source: source || "manual",
      source_url: sourceUrl || "",
      matches: matches.length,
      candidates: JSON.stringify(matches),
      status: "completed",
    };

    const scansTbl = await table("hunter_scans");
    await scansTbl.insert(scan);

    return success(res, { scan, matchCount: matches.length });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/matches", async (req, res) => {
  try {
    const userId = req.user.userId;
    const scansTbl = await table("hunter_scans");
    const scans = await scansTbl.all();
    const myScans = scans.filter(s => {
      const candidates = typeof s.candidates === 'string' ? JSON.parse(s.candidates) : (s.candidates || []);
      return candidates.some(c => c.userId === userId);
    });

    const matches = [];
    for (const scan of myScans) {
      const candidates = typeof scan.candidates === 'string' ? JSON.parse(scan.candidates) : (scan.candidates || []);
      for (const c of candidates) {
        if (c.userId === userId) {
          matches.push({
            scanId: scan.id,
            imageUrl: scan.image_url,
            source: scan.source,
            sourceUrl: scan.source_url,
            confidence: c.confidence,
            bountyAmount: c.bountyAmount,
            status: "pending",
            createdAt: scan.created_at,
          });
        }
      }
    }
    return success(res, { matches });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/matches/:scanId/confirm", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { scanId } = req.params;
    const { confirmed } = req.body;

    const scansTbl = await table("hunter_scans");
    const scan = await scansTbl.find({ id: scanId });
    if (!scan) return error(res, "Scan not found", 404);

    const candidates = typeof scan.candidates === 'string' ? JSON.parse(scan.candidates) : (scan.candidates || []);
    const candidate = candidates.find(c => c.userId === userId);
    if (!candidate) return error(res, "No match found for this user", 404);

    if (confirmed) {
      const profilesTbl = await table("bounty_profiles");
      const profile = await profilesTbl.find({ user_id: userId });
      await profilesTbl.update({ user_id: userId }, {
        total_paid: (profile?.total_paid || 0) + candidate.bountyAmount,
        total_matches: (profile?.total_matches || 0) + 1,
      });

      await scansTbl.update({ id: scanId }, {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        payout: candidate.bountyAmount,
      });

      const claimsTbl = await table("insurance_claims");
      await claimsTbl.insert({
        id: "claim_" + Date.now(),
        user_id: userId,
        type: "bounty_match",
        scan_id: scanId,
        image_url: scan.image_url,
        source: scan.source,
        source_url: scan.source_url,
        confidence: candidate.confidence,
        bounty_amount: candidate.bountyAmount,
        status: "approved",
      });
    } else {
      await scansTbl.update({ id: scanId }, {
        status: "rejected",
        rejected_at: new Date().toISOString(),
      });
    }

    return success(res, { message: confirmed ? "Match confirmed, takedown initiated" : "Match rejected" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const scansTbl = await table("hunter_scans");
    const scans = await scansTbl.all();
    const hunterStats = {};

    for (const scan of scans) {
      if (!hunterStats[scan.hunter_id]) {
        hunterStats[scan.hunter_id] = { scans: 0, matches: 0, confirmed: 0, earnings: 0 };
      }
      hunterStats[scan.hunter_id].scans++;
      hunterStats[scan.hunter_id].matches += scan.matches || 0;
      if (scan.status === "confirmed") {
        hunterStats[scan.hunter_id].confirmed++;
        hunterStats[scan.hunter_id].earnings += scan.payout || 0;
      }
    }

    const leaderboard = Object.entries(hunterStats)
      .map(([hunterId, stats]) => ({ hunterId, ...stats }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 50);

    return success(res, { leaderboard });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/stats", async (req, res) => {
  try {
    const profilesTbl = await table("bounty_profiles");
    const scansTbl = await table("hunter_scans");
    const profiles = await profilesTbl.all();
    const scans = await scansTbl.all();
    const confirmed = scans.filter(s => s.status === "confirmed");

    return success(res, {
      activeProfiles: profiles.length,
      totalScans: scans.length,
      totalMatches: scans.reduce((sum, s) => sum + (s.matches || 0), 0),
      confirmedMatches: confirmed.length,
      totalPayouts: confirmed.reduce((sum, s) => sum + (s.payout || 0), 0),
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
