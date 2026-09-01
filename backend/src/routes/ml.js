const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");
const { table } = require("../db/query");

const router = express.Router();

const SEED_MODELS = [
  { id: "model_v1", name: "Deepfake Detection v1", version: "1.0.0", type: "image", accuracy: 0.89, precision_score: 0.91, recall_score: 0.87, f1_score: 0.89, trained_at: "2025-01-15T00:00:00Z", status: "production", dataset: "FaceForensics++", parameters: "12M", inference_time: "45ms" },
  { id: "model_v2", name: "Deepfake Detection v2", version: "2.0.0", type: "image", accuracy: 0.94, precision_score: 0.96, recall_score: 0.92, f1_score: 0.94, trained_at: "2025-06-01T00:00:00Z", status: "staging", dataset: "FaceForensics++ + Celeb-DF", parameters: "24M", inference_time: "62ms" },
  { id: "voice_v1", name: "Voice Clone Detection v1", version: "1.0.0", type: "audio", accuracy: 0.82, precision_score: 0.85, recall_score: 0.79, f1_score: 0.82, trained_at: "2025-03-20T00:00:00Z", status: "production", dataset: "ASVspoof 2021", parameters: "8M", inference_time: "120ms" },
];

const SEED_BENCHMARKS = [
  { id: "bench_1", model_id: "model_v1", dataset: "FaceForensics++", samples: 10000, accuracy: 0.89, run_at: "2025-01-20T00:00:00Z" },
  { id: "bench_2", model_id: "model_v1", dataset: "Celeb-DF", samples: 5000, accuracy: 0.86, run_at: "2025-02-10T00:00:00Z" },
  { id: "bench_3", model_id: "model_v2", dataset: "FaceForensics++", samples: 10000, accuracy: 0.94, run_at: "2025-06-10T00:00:00Z" },
  { id: "bench_4", model_id: "model_v2", dataset: "WildDeepfake", samples: 3000, accuracy: 0.91, run_at: "2025-07-01T00:00:00Z" },
  { id: "bench_5", model_id: "voice_v1", dataset: "ASVspoof 2021", samples: 8000, accuracy: 0.82, run_at: "2025-03-25T00:00:00Z" },
];

async function ensureSeeded() {
  const tbl = await table("ml_models");
  const count = await tbl.count();
  if (count === 0) {
    for (const m of SEED_MODELS) await tbl.insert(m);
    const benchTbl = await table("ml_benchmarks");
    for (const b of SEED_BENCHMARKS) await benchTbl.insert(b);
  }
}

router.get("/models", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const tbl = await table("ml_models");
    const models = await tbl.all();
    return success(res, { models });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/models/:modelId", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const tbl = await table("ml_models");
    const model = await tbl.find({ id: req.params.modelId });
    if (!model) return error(res, "Model not found", 404);
    const benchTbl = await table("ml_benchmarks");
    const benchmarks = await benchTbl.filter({ model_id: req.params.modelId });
    return success(res, { model, benchmarks });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/models/:modelId/deploy", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const tbl = await table("ml_models");
    const model = await tbl.find({ id: req.params.modelId });
    if (!model) return error(res, "Model not found", 404);

    const currentProd = await tbl.find({ type: model.type, status: "production" });
    if (currentProd && currentProd.id !== model.id) {
      await tbl.update({ id: currentProd.id }, { status: "archived" });
    }

    await tbl.update({ id: model.id }, { status: "production", deployed_at: new Date().toISOString() });

    const auditTbl = await table("audit_logs");
    await auditTbl.insert({
      id: "audit_" + Date.now(),
      user_id: req.user.userId,
      action: "model_deployed",
      detail: `Deployed ${model.name} v${model.version}`,
    });

    return success(res, { message: `Deployed ${model.name}` });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/models/:modelId/rollback", authenticate, async (req, res) => {
  try {
    const tbl = await table("ml_models");
    const model = await tbl.find({ id: req.params.modelId });
    if (!model) return error(res, "Model not found", 404);
    await tbl.update({ id: model.id }, { status: "staging" });
    return success(res, { message: `Rolled back ${model.name}` });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/benchmarks", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const { modelId } = req.query;
    const tbl = await table("ml_benchmarks");
    let results = modelId ? await tbl.filter({ model_id: modelId }) : await tbl.all();
    return success(res, { benchmarks: results });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/compare", authenticate, async (req, res) => {
  try {
    await ensureSeeded();
    const tbl = await table("ml_models");
    const models = await tbl.all();
    const comparison = models.map(m => ({
      id: m.id, name: m.name, version: m.version, accuracy: m.accuracy,
      f1Score: m.f1_score, inferenceTime: m.inference_time, status: m.status,
    }));
    return success(res, { comparison });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get("/ab-tests", authenticate, async (req, res) => {
  try {
    const tbl = await table("ab_tests");
    const tests = await tbl.all();
    return success(res, { tests });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post("/ab-tests", authenticate, async (req, res) => {
  try {
    const { name, modelA, modelB, trafficSplit } = req.body;
    if (!name || !modelA || !modelB) return error(res, "name, modelA, and modelB required", 400);

    const tbl = await table("ab_tests");
    const test = {
      id: "ab_" + Date.now(),
      name,
      model_a: modelA,
      model_b: modelB,
      traffic_split: trafficSplit || 50,
      status: "running",
      results: JSON.stringify({ modelA: { requests: 0, correct: 0 }, modelB: { requests: 0, correct: 0 } }),
    };
    await tbl.insert(test);
    return success(res, { message: "A/B test created", test }, "OK", 201);
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.delete("/ab-tests/:testId", authenticate, async (req, res) => {
  try {
    const tbl = await table("ab_tests");
    await tbl.remove({ id: req.params.testId });
    return success(res, { message: "A/B test deleted" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Circuit breaker reset
router.post("/circuit-breaker/reset", authenticate, async (req, res) => {
  try {
    const mlClient = require("../services/ml-client");
    mlClient.resetCircuitBreaker();
    return success(res, { message: "Circuit breaker reset" });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

// Model swap (proxy to Python ML service)
router.post("/models/:modelId/swap", authenticate, async (req, res) => {
  try {
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";
    const { model_path } = req.body;
    const FormData = require("form-data");
    const form = new FormData();
    form.append("name", req.params.modelId);
    if (model_path) form.append("model_path", model_path);

    const resp = await fetch(`${ML_SERVICE_URL}/models/swap`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });
    const data = await resp.json();
    return success(res, data);
  } catch (e) {
    return error(res, e.message || "Model swap failed", 500);
  }
});

module.exports = router;
