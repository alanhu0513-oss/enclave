const express = require("express");
const { success, error } = require("../utils/response");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const modelRegistry = [
  {
    id: "model_v1",
    name: "Deepfake Detection v1",
    version: "1.0.0",
    type: "image",
    accuracy: 0.89,
    precision: 0.91,
    recall: 0.87,
    f1Score: 0.89,
    trainedAt: "2025-01-15T00:00:00Z",
    status: "production",
    dataset: "FaceForensics++",
    parameters: "12M",
    inferenceTime: "45ms",
  },
  {
    id: "model_v2",
    name: "Deepfake Detection v2",
    version: "2.0.0",
    type: "image",
    accuracy: 0.94,
    precision: 0.96,
    recall: 0.92,
    f1Score: 0.94,
    trainedAt: "2025-06-01T00:00:00Z",
    status: "staging",
    dataset: "FaceForensics++ + Celeb-DF",
    parameters: "24M",
    inferenceTime: "62ms",
  },
  {
    id: "voice_v1",
    name: "Voice Clone Detection v1",
    version: "1.0.0",
    type: "audio",
    accuracy: 0.82,
    precision: 0.85,
    recall: 0.79,
    f1Score: 0.82,
    trainedAt: "2025-03-20T00:00:00Z",
    status: "production",
    dataset: "ASVspoof 2021",
    parameters: "8M",
    inferenceTime: "120ms",
  },
];

const benchmarks = [
  { id: "bench_1", modelId: "model_v1", dataset: "FaceForensics++", samples: 10000, accuracy: 0.89, date: "2025-01-20" },
  { id: "bench_2", modelId: "model_v1", dataset: "Celeb-DF", samples: 5000, accuracy: 0.86, date: "2025-02-10" },
  { id: "bench_3", modelId: "model_v2", dataset: "FaceForensics++", samples: 10000, accuracy: 0.94, date: "2025-06-10" },
  { id: "bench_4", modelId: "model_v2", dataset: "WildDeepfake", samples: 3000, accuracy: 0.91, date: "2025-07-01" },
  { id: "bench_5", modelId: "voice_v1", dataset: "ASVspoof 2021", samples: 8000, accuracy: 0.82, date: "2025-03-25" },
];

router.get("/models", authenticate, (req, res) => {
  return success(res, { models: modelRegistry });
});

router.get("/models/:modelId", authenticate, (req, res) => {
  const { modelId } = req.params;
  const model = modelRegistry.find(m => m.id === modelId);
  if (!model) return error(res, "Model not found", 404);
  const modelBenchmarks = benchmarks.filter(b => b.modelId === modelId);
  return success(res, { model, benchmarks: modelBenchmarks });
});

router.post("/models/:modelId/deploy", authenticate, (req, res) => {
  const { modelId } = req.params;
  const model = modelRegistry.find(m => m.id === modelId);
  if (!model) return error(res, "Model not found", 404);

  const currentProd = modelRegistry.find(m => m.status === "production" && m.type === model.type);
  if (currentProd) currentProd.status = "archived";

  model.status = "production";
  model.deployedAt = new Date().toISOString();

  const db = req.app.get("db");
  db.get("audit_logs").push({
    id: "audit_" + Date.now(),
    userId: req.user.userId,
    action: "model_deployed",
    detail: `Deployed ${model.name} v${model.version}`,
    timestamp: new Date().toISOString(),
  }).write();

  return success(res, { message: `Deployed ${model.name}`, model });
});

router.post("/models/:modelId/rollback", authenticate, (req, res) => {
  const { modelId } = req.params;
  const model = modelRegistry.find(m => m.id === modelId);
  if (!model) return error(res, "Model not found", 404);

  model.status = "staging";
  model.rollbackAt = new Date().toISOString();

  return success(res, { message: `Rolled back ${model.name}`, model });
});

router.get("/benchmarks", authenticate, (req, res) => {
  const { modelId } = req.query;
  let results = benchmarks;
  if (modelId) {
    results = benchmarks.filter(b => b.modelId === modelId);
  }
  return success(res, { benchmarks: results });
});

router.get("/compare", authenticate, (req, res) => {
  const comparison = modelRegistry.map(model => ({
    id: model.id,
    name: model.name,
    version: model.version,
    accuracy: model.accuracy,
    f1Score: model.f1Score,
    inferenceTime: model.inferenceTime,
    status: model.status,
  }));
  return success(res, { comparison });
});

router.get("/ab-tests", authenticate, (req, res) => {
  const db = req.app.get("db");
  const tests = db.get("ab_tests").value() || [];
  return success(res, { tests });
});

router.post("/ab-tests", authenticate, (req, res) => {
  const { name, modelA, modelB, trafficSplit } = req.body;
  const db = req.app.get("db");

  if (!name || !modelA || !modelB) {
    return error(res, "name, modelA, and modelB required", 400);
  }

  const test = {
    id: "ab_" + Date.now(),
    name,
    modelA,
    modelB,
    trafficSplit: trafficSplit || 50,
    status: "running",
    results: { modelA: { requests: 0, correct: 0 }, modelB: { requests: 0, correct: 0 } },
    createdAt: new Date().toISOString(),
  };

  db.get("ab_tests").push(test).write();
  return success(res, { message: "A/B test created", test }, "OK", 201);
});

router.delete("/ab-tests/:testId", authenticate, (req, res) => {
  const { testId } = req.params;
  const db = req.app.get("db");
  db.get("ab_tests").remove({ id: testId }).write();
  return success(res, { message: "A/B test deleted" });
});

module.exports = router;
