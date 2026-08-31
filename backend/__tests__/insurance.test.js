const request = require("supertest");
const path = require("path");
const fs = require("fs");

const origEnv = { ...process.env };
process.env.DATABASE_URL = "";
process.env.DATABASE_PATH = path.join(__dirname, "..", "data", "test-insurance.json");
process.env.JWT_SECRET = "test-secret-for-ci";
process.env.PORT = "0";
process.env.STRIPE_SECRET_KEY = "";

const testDb = process.env.DATABASE_PATH;
try { fs.unlinkSync(testDb); } catch (_) {}

const app = require("../src/index");
const { resetEngine } = require("../src/db/adapter");

let token;

beforeAll(async () => {
  resetEngine();
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "insurance@test.com", password: "TestPass123!", fullName: "Insurance Test" });
  token = res.body.data.token;
});

afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe("Insurance Routes", () => {
  describe("GET /api/insurance/plans", () => {
    it("returns 3 insurance plans", async () => {
      const res = await request(app)
        .get("/api/insurance/plans")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans).toBeDefined();
      expect(Object.keys(res.body.data.plans)).toHaveLength(3);
      expect(res.body.data.plans.basic).toBeDefined();
      expect(res.body.data.plans.pro).toBeDefined();
      expect(res.body.data.plans.max).toBeDefined();
    });

    it("each plan has required fields", async () => {
      const res = await request(app)
        .get("/api/insurance/plans")
        .set("Authorization", `Bearer ${token}`);
      const plans = res.body.data.plans;
      for (const plan of Object.values(plans)) {
        expect(plan).toHaveProperty("id");
        expect(plan).toHaveProperty("name");
        expect(plan).toHaveProperty("monthlyPrice");
        expect(plan).toHaveProperty("coverageAmount");
        expect(plan).toHaveProperty("features");
        expect(Array.isArray(plan.features)).toBe(true);
      }
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(app).get("/api/insurance/plans");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/insurance/subscribe", () => {
    it("subscribes to basic plan", async () => {
      const res = await request(app)
        .post("/api/insurance/subscribe")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: "basic" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan.id).toBe("basic");
    });

    it("updates subscription when changing plan", async () => {
      const res = await request(app)
        .post("/api/insurance/subscribe")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: "pro" });
      expect(res.status).toBe(200);
      expect(res.body.data.plan.id).toBe("pro");
    });

    it("rejects invalid plan", async () => {
      const res = await request(app)
        .post("/api/insurance/subscribe")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: "nonexistent" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/insurance/status", () => {
    it("returns active policy", async () => {
      const res = await request(app)
        .get("/api/insurance/status")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.policy).toBeDefined();
      expect(res.body.data.policy.plan).toBe("pro");
    });
  });

  describe("POST /api/insurance/claim", () => {
    it("files a claim", async () => {
      const res = await request(app)
        .post("/api/insurance/claim")
        .set("Authorization", `Bearer ${token}`)
        .send({
          alertId: "test-alert-1",
          description: "Deepfake video found on social media",
          damages: 5000,
          evidenceUrls: ["https://example.com/evidence"]
        });
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it("rejects claim without active policy", async () => {
      const res2 = await request(app)
        .post("/api/auth/register")
        .send({ email: "noclaim@test.com", password: "TestPass123!", fullName: "No Claim" });
      const token2 = res2.body.data.token;

      const res = await request(app)
        .post("/api/insurance/claim")
        .set("Authorization", `Bearer ${token2}`)
        .send({ alertId: "test-alert-2", description: "Test" });
      expect(res.status).toBe(400);
    });

    it("rejects claim missing fields", async () => {
      const res = await request(app)
        .post("/api/insurance/claim")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/insurance/claims", () => {
    it("returns user claims", async () => {
      const res = await request(app)
        .get("/api/insurance/claims")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.claims)).toBe(true);
      expect(res.body.data.claims.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/insurance/unsubscribe", () => {
    it("cancels insurance", async () => {
      const res = await request(app)
        .post("/api/insurance/unsubscribe")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);

      const status = await request(app)
        .get("/api/insurance/status")
        .set("Authorization", `Bearer ${token}`);
      expect(status.body.data.policy.active).toBe(false);
    });
  });
});
