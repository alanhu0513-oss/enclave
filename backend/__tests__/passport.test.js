const request = require("supertest");
const path = require("path");
const fs = require("fs");

const origEnv = { ...process.env };
process.env.DATABASE_URL = "";
process.env.DATABASE_PATH = path.join(__dirname, "..", "data", "test-passport.json");
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
    .send({ email: "passport@test.com", password: "TestPass123!", fullName: "Passport Test" });
  token = res.body.data.token;
});

afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe("Passport Routes", () => {
  describe("GET /api/passport", () => {
    it("returns no passport when not enrolled", async () => {
      const res = await request(app)
        .get("/api/passport")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enrolled).toBe(false);
      expect(res.body.data.passport).toBeNull();
    });
  });

  describe("POST /api/passport/enroll", () => {
    it("creates a new passport", async () => {
      const res = await request(app)
        .post("/api/passport/enroll")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.passport).toBeDefined();
      expect(res.body.data.passport.id).toBeDefined();
      expect(res.body.data.passport.holderName).toBe("Passport Test");
    });

    it("rejects if passport already active", async () => {
      const res = await request(app)
        .post("/api/passport/enroll")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/passport (after enroll)", () => {
    it("returns active passport", async () => {
      const res = await request(app)
        .get("/api/passport")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enrolled).toBe(true);
      expect(res.body.data.passport.status).toBe("active");
      expect(res.body.data.passport.holderName).toBe("Passport Test");
    });
  });

  describe("GET /api/passport/verify/:passportId", () => {
    it("verifies a valid passport", async () => {
      const passportRes = await request(app)
        .get("/api/passport")
        .set("Authorization", `Bearer ${token}`);
      const passportId = passportRes.body.data.passport.id;

      const res = await request(app)
        .get(`/api/passport/verify/${passportId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it("rejects invalid passport ID", async () => {
      const res = await request(app)
        .get("/api/passport/verify/invalid-id");
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
    });
  });

  describe("POST /api/passport/qr", () => {
    it("generates QR data", async () => {
      const res = await request(app)
        .post("/api/passport/qr")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.qrData).toBeDefined();
      expect(res.body.data.expiresIn).toBe(300);
    });
  });

  describe("POST /api/passport/qr/verify", () => {
    it("verifies valid QR data", async () => {
      const qrRes = await request(app)
        .post("/api/passport/qr")
        .set("Authorization", `Bearer ${token}`);
      const qrData = qrRes.body.data.qrData;

      const res = await request(app)
        .post("/api/passport/qr/verify")
        .send({ qrData });
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it("rejects invalid QR data", async () => {
      const res = await request(app)
        .post("/api/passport/qr/verify")
        .send({ qrData: "invalid-qr-data" });
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
    });

    it("rejects missing qrData", async () => {
      const res = await request(app)
        .post("/api/passport/qr/verify")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/passport/revoke", () => {
    it("revokes the passport", async () => {
      const res = await request(app)
        .post("/api/passport/revoke")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);

      const verify = await request(app)
        .get("/api/passport")
        .set("Authorization", `Bearer ${token}`);
      expect(verify.body.data.passport.status).toBe("revoked");
    });

    it("rejects if no passport", async () => {
      const res2 = await request(app)
        .post("/api/auth/register")
        .send({ email: "nopal@test.com", password: "TestPass123!", fullName: "No Pal" });
      const token2 = res2.body.data.token;

      const res = await request(app)
        .post("/api/passport/revoke")
        .set("Authorization", `Bearer ${token2}`);
      expect(res.status).toBe(404);
    });
  });
});
