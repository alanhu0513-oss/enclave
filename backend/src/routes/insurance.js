const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();
router.use(authenticate);

const CLAIM_STATUS = { PENDING: "pending", UNDER_REVIEW: "under_review", APPROVED: "approved", DENIED: "denied", PAID: "paid" };

const SEED_PLANS = [
  { id: "basic", name: "Basic Shield", monthly_price: 2.99, coverage_amount: 10000, features: JSON.stringify(["Deepfake damage coverage up to $10,000", "Legal consultation (1 hour)", "Evidence preservation", "Takedown assistance"]) },
  { id: "pro", name: "Pro Shield", monthly_price: 4.99, coverage_amount: 25000, features: JSON.stringify(["Deepfake damage coverage up to $25,000", "Legal consultation (3 hours)", "PR crisis support", "Evidence preservation", "Priority takedown", "Reputation monitoring"]) },
  { id: "max", name: "Max Shield", monthly_price: 9.99, coverage_amount: 50000, features: JSON.stringify(["Deepfake damage coverage up to $50,000", "Unlimited legal consultation", "Full PR crisis management", "Evidence preservation", "Priority takedown", "Reputation monitoring", "Identity restoration", "Lost wages compensation"]) },
];

async function ensureSeeded() {
  const tbl = await table("insurance_plans");
  const count = await tbl.count();
  if (count === 0) {
    for (const p of SEED_PLANS) await tbl.insert({ ...p, active: true });
  }
}

async function getPlans() {
  await ensureSeeded();
  const tbl = await table("insurance_plans");
  const plans = await tbl.all();
  const map = {};
  for (const p of plans) map[p.id] = p;
  return map;
}

router.get("/plans", async (req, res) => {
  try {
    const plansRaw = await getPlans();
    const plans = {};
    for (const [k, v] of Object.entries(plansRaw)) {
      plans[k] = {
        id: v.id,
        name: v.name,
        monthlyPrice: v.monthly_price,
        coverageAmount: v.coverage_amount,
        features: typeof v.features === 'string' ? JSON.parse(v.features) : v.features,
      };
    }
    return success(res, { plans });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/status", async (req, res) => {
  try {
    const userId = req.user.userId;
    const polTbl = await table("insurance_policies");
    const policy = await polTbl.find({ user_id: userId });
    const claimsTbl = await table("insurance_claims");
    const claims = await claimsTbl.filter({ user_id: userId });
    return success(res, {
      policy: policy || { plan: null, active: false },
      claimsCount: claims.length,
      totalPaid: claims.filter(c => c.status === CLAIM_STATUS.PAID).reduce((sum, c) => sum + (c.damages || 0), 0),
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/subscribe", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;
    const plans = await getPlans();
    if (!planId || !plans[planId]) return error(res, "Invalid plan", 400);

    const plan = plans[planId];
    const polTbl = await table("insurance_policies");
    const existing = await polTbl.find({ user_id: userId });

    if (existing) {
      await polTbl.update({ user_id: userId }, { plan: planId, coverage_amount: plan.coverage_amount, updated_at: new Date().toISOString() });
    } else {
      await polTbl.insert({
        id: "ins_" + Date.now(),
        user_id: userId,
        plan: planId,
        coverage_amount: plan.coverage_amount,
        monthly_price: plan.monthly_price,
        status: "active",
      });
    }
    return success(res, { message: "Insurance activated", plan });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/unsubscribe", async (req, res) => {
  try {
    const userId = req.user.userId;
    const polTbl = await table("insurance_policies");
    await polTbl.remove({ user_id: userId });
    return success(res, { message: "Insurance cancelled" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/claim", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { alertId, description, damages, evidenceUrls } = req.body;

    const polTbl = await table("insurance_policies");
    const policy = await polTbl.find({ user_id: userId });
    if (!policy || policy.status !== "active") return error(res, "No active insurance policy", 400);
    if (!alertId || !description) return error(res, "alertId and description required", 400);

    const claim = {
      id: "claim_" + Date.now(),
      user_id: userId,
      policy_id: policy.id,
      alert_id: alertId,
      description,
      damages: damages || 0,
      evidence_urls: JSON.stringify(evidenceUrls || []),
      coverage_amount: policy.coverage_amount,
      status: CLAIM_STATUS.PENDING,
    };

    const claimsTbl = await table("insurance_claims");
    await claimsTbl.insert(claim);
    return success(res, { claim }, "Claim submitted", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/claims", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("insurance_claims");
    const claims = await tbl.filter({ user_id: userId });
    return success(res, { claims });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/claims/:claimId", async (req, res) => {
  try {
    const userId = req.user.userId;
    const tbl = await table("insurance_claims");
    const claim = await tbl.find({ id: req.params.claimId, user_id: userId });
    if (!claim) return error(res, "Claim not found", 404);
    return success(res, { claim });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.patch("/claims/:claimId/status", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, notes } = req.body;

    if (!Object.values(CLAIM_STATUS).includes(status)) return error(res, "Invalid status", 400);

    const tbl = await table("insurance_claims");
    const claim = await tbl.find({ id: req.params.claimId, user_id: userId });
    if (!claim) return error(res, "Claim not found", 404);

    await tbl.update({ id: req.params.claimId, user_id: userId }, { status, notes: notes || claim.notes, updated_at: new Date().toISOString() });
    return success(res, { message: "Claim updated", status });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
