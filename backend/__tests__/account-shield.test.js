const request = require("supertest");
const path = require("path");
const fs = require("fs");

const origEnv = { ...process.env };
process.env.DATABASE_URL = "";
process.env.DATABASE_PATH = path.join(__dirname, "..", "data", "test-account-shield.json");
process.env.JWT_SECRET = "test-secret-for-ci";
process.env.PORT = "0";
process.env.STRIPE_SECRET_KEY = "";
process.env.HIBP_API_KEY = "";

const testDb = process.env.DATABASE_PATH;
try { fs.unlinkSync(testDb); } catch (_) {}

const app = require("../src/index");
const { resetEngine } = require("../src/db/adapter");

let token;

beforeAll(async () => {
  resetEngine();
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "shield@test.com", password: "TestPass123!", fullName: "Shield Test" });
  token = res.body.data.token;
});

afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe("Account Shield Routes", () => {
  describe("GET /api/account-shield/sites", () => {
    it("returns available sites", async () => {
      const res = await request(app)
        .get("/api/account-shield/sites")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.sites)).toBe(true);
      expect(res.body.data.sites).toContain("google");
      expect(res.body.data.sites).toContain("steam");
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(app).get("/api/account-shield/sites");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/account-shield/accounts", () => {
    it("adds a watched account", async () => {
      const res = await request(app)
        .post("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`)
        .send({ site: "google", identifier: "shield.user@gmail.com", label: "Main Google" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.site).toBe("google");
      expect(res.body.data.account.identifier).toBe("shield.user@gmail.com");
    });

    it("rejects invalid site", async () => {
      const res = await request(app)
        .post("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`)
        .send({ site: "not-a-site", identifier: "x@y.com" });
      expect(res.status).toBe(400);
    });

    it("rejects missing identifier", async () => {
      const res = await request(app)
        .post("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`)
        .send({ site: "bank" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/account-shield/accounts", () => {
    it("lists watched accounts", async () => {
      const res = await request(app)
        .get("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
      expect(res.body.data.accounts.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/account-shield/accounts/:id/scan", () => {
    it("runs a scan and returns a security score", async () => {
      const list = await request(app)
        .get("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`);
      const accountId = list.body.data.accounts[0].id;

      const res = await request(app)
        .post(`/api/account-shield/accounts/${accountId}/scan`)
        .set("Authorization", `Bearer ${token}`)
        .timeout(60000);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.score).toBe("number");
      expect(res.body.data.score).toBeGreaterThanOrEqual(0);
      expect(res.body.data.score).toBeLessThanOrEqual(100);
    }, 60000);

    it("rejects scan for nonexistent account", async () => {
      const res = await request(app)
        .post("/api/account-shield/accounts/nonexistent/scan")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/account-shield/breaches", () => {
    it("returns breach list (possibly empty)", async () => {
      const res = await request(app)
        .get("/api/account-shield/breaches")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.breaches)).toBe(true);
    });
  });

  describe("GET /api/account-shield/summary", () => {
    it("returns summary with score and counts", async () => {
      const res = await request(app)
        .get("/api/account-shield/summary")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.securityScore).toBe("number");
      expect(typeof res.body.data.accounts).toBe("number");
      expect(res.body.data.status).toBeDefined();
    });
  });

  describe("DELETE /api/account-shield/accounts/:id", () => {
    it("removes a watched account", async () => {
      const add = await request(app)
        .post("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`)
        .send({ site: "steam", identifier: "steamuser123" });
      const accountId = add.body.data.account.id;

      const res = await request(app)
        .delete(`/api/account-shield/accounts/${accountId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(true);

      const list = await request(app)
        .get("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`);
      expect(list.body.data.accounts.find((a) => a.id === accountId)).toBeUndefined();
    });
  });
});