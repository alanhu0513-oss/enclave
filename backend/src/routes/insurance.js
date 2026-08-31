const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const INSURANCE_PLANS = {
  basic: {
    id: "basic",
    name: "Basic Shield",
    monthlyPrice: 2.99,
    coverageAmount: 10000,
    features: [
      "Deepfake damage coverage up to $10,000",
      "Legal consultation (1 hour)",
      "Evidence preservation",
      "Takedown assistance"
    ]
  },
  pro: {
    id: "pro",
    name: "Pro Shield",
    monthlyPrice: 4.99,
    coverageAmount: 25000,
    features: [
      "Deepfake damage coverage up to $25,000",
      "Legal consultation (3 hours)",
      "PR crisis support",
      "Evidence preservation",
      "Priority takedown",
      "Reputation monitoring"
    ]
  },
  max: {
    id: "max",
    name: "Max Shield",
    monthlyPrice: 9.99,
    coverageAmount: 50000,
    features: [
      "Deepfake damage coverage up to $50,000",
      "Unlimited legal consultation",
      "Full PR crisis management",
      "Evidence preservation",
      "Priority takedown",
      "Reputation monitoring",
      "Identity restoration",
      "Lost wages compensation"
    ]
  }
};

const CLAIM_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  DENIED: "denied",
  PAID: "paid"
};

function getInsurance(db, userId) {
  return db.get("insurance_policies").find({ userId }).value() || null;
}

function getClaims(db, userId) {
  return db.get("insurance_claims").filter({ userId }).value() || [];
}

router.get("/plans", (req, res) => {
  return success(res, { plans: INSURANCE_PLANS });
});

router.get("/status", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const policy = getInsurance(db, userId);
  const claims = getClaims(db, userId);

  return success(res, {
    policy: policy || { plan: null, active: false },
    claimsCount: claims.length,
    totalPaid: claims.filter(c => c.status === CLAIM_STATUS.PAID)
      .reduce((sum, c) => sum + (c.amount || 0), 0)
  });
});

router.post("/subscribe", (req, res) => {
  const userId = req.user.userId;
  const { planId } = req.body;
  const db = req.app.get("db");

  if (!planId || !INSURANCE_PLANS[planId]) {
    return error(res, "Invalid plan", 400);
  }

  const plan = INSURANCE_PLANS[planId];
  const existing = getInsurance(db, userId);

  if (existing) {
    db.get("insurance_policies")
      .find({ userId })
      .assign({ plan: planId, coverageAmount: plan.coverageAmount, updatedAt: new Date().toISOString() })
      .write();
  } else {
    db.get("insurance_policies").push({
      id: "ins_" + Date.now(),
      userId,
      plan: planId,
      coverageAmount: plan.coverageAmount,
      monthlyPrice: plan.monthlyPrice,
      status: "active",
      createdAt: new Date().toISOString()
    }).write();
  }

  return success(res, { message: "Insurance activated", plan });
});

router.post("/unsubscribe", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");

  db.get("insurance_policies").remove({ userId }).write();
  return success(res, { message: "Insurance cancelled" });
});

router.post("/claim", (req, res) => {
  const userId = req.user.userId;
  const { alertId, description, damages, evidenceUrls } = req.body;
  const db = req.app.get("db");

  const policy = getInsurance(db, userId);
  if (!policy || policy.status !== "active") {
    return error(res, "No active insurance policy", 400);
  }

  if (!alertId || !description) {
    return error(res, "alertId and description required", 400);
  }

  const claim = {
    id: "claim_" + Date.now(),
    userId,
    policyId: policy.id,
    alertId,
    description,
    damages: damages || 0,
    evidenceUrls: evidenceUrls || [],
    status: CLAIM_STATUS.PENDING,
    coverageAmount: policy.coverageAmount,
    createdAt: new Date().toISOString()
  };

  db.get("insurance_claims").push(claim).write();

  return success(res, { claim }, 'Claim submitted', 201);
});

router.get("/claims", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const claims = getClaims(db, userId);
  return success(res, { claims });
});

router.get("/claims/:claimId", (req, res) => {
  const userId = req.user.userId;
  const db = req.app.get("db");
  const claim = db.get("insurance_claims")
    .find({ id: req.params.claimId, userId })
    .value();

  if (!claim) {
    return error(res, "Claim not found", 404);
  }

  return success(res, { claim });
});

router.patch("/claims/:claimId/status", (req, res) => {
  const userId = req.user.userId;
  const { status, notes } = req.body;
  const db = req.app.get("db");

  if (!Object.values(CLAIM_STATUS).includes(status)) {
    return error(res, "Invalid status", 400);
  }

  const claim = db.get("insurance_claims")
    .find({ id: req.params.claimId, userId })
    .value();

  if (!claim) {
    return error(res, "Claim not found", 404);
  }

  db.get("insurance_claims")
    .find({ id: req.params.claimId, userId })
    .assign({
      status,
      notes: notes || claim.notes,
      updatedAt: new Date().toISOString()
    })
    .write();

  return success(res, { message: "Claim updated", status });
});

module.exports = router;
module.exports.INSURANCE_PLANS = INSURANCE_PLANS;
