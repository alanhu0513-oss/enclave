const request = require("supertest");
const path = require("path");
const fs = require("fs");

const origEnv = { ...process.env };
process.env.DATABASE_URL = "";
process.env.DATABASE_PATH = path.join(__dirname, "..", "data", "test-bounty.json");
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
    .send({ email: "bounty@test.com", password: "TestPass123!", fullName: "Bounty Test" });
  token = res.body.data.token;
});

afterAll(() => {
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

describe("Bounty Routes", () => {
  describe("GET /api/bounty/profile", () => {
    it("returns no profile when not enrolled", async () => {
      const res = await request(app)
        .get("/api/bounty/profile")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.profile.enrolled).toBe(false);
    });
  });

  describe("POST /api/bounty/enroll", () => {
    it("enrolls with face images and bounty amount", async () => {
      const res = await request(app)
        .post("/api/bounty/enroll")
        .set("Authorization", `Bearer ${token}`)
        .send({
          faceImages: ["img1.jpg", "img2.jpg", "img3.jpg"],
          bountyAmount: 25
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects with less than 3 face images", async () => {
      const res = await request(app)
        .post("/api/bounty/enroll")
        .set("Authorization", `Bearer ${token}`)
        .send({
          faceImages: ["img1.jpg", "img2.jpg"],
          bountyAmount: 25
        });
      expect(res.status).toBe(400);
    });

    it("rejects invalid bounty amount", async () => {
      const res = await request(app)
        .post("/api/bounty/enroll")
        .set("Authorization", `Bearer ${token}`)
        .send({
          faceImages: ["img1.jpg", "img2.jpg", "img3.jpg"],
          bountyAmount: 0
        });
      expect(res.status).toBe(400);
    });

    it("updates existing profile", async () => {
      const res = await request(app)
        .post("/api/bounty/enroll")
        .set("Authorization", `Bearer ${token}`)
        .send({
          faceImages: ["new1.jpg", "new2.jpg", "new3.jpg"],
          bountyAmount: 50
        });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/bounty/profile (after enroll)", () => {
    it("returns enrolled profile", async () => {
      const res = await request(app)
        .get("/api/bounty/profile")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.profile.status).toBe("active");
      expect(res.body.data.profile.bountyAmount).toBe(50);
    });
  });

  describe("POST /api/bounty/scan", () => {
    it("scans an image for matches", async () => {
      const res = await request(app)
        .post("/api/bounty/scan")
        .set("Authorization", `Bearer ${token}`)
        .send({
          imageUrl: "https://example.com/suspicious.jpg",
          source: "web",
          sourceUrl: "https://example.com"
        });
      expect(res.status).toBe(200);
      expect(res.body.data.scan).toBeDefined();
      expect(res.body.data.scan.id).toBeDefined();
      expect(res.body.data.scan.status).toBe("completed");
    });

    it("rejects scan without imageUrl", async () => {
      const res = await request(app)
        .post("/api/bounty/scan")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/bounty/matches", () => {
    it("returns matches array", async () => {
      const res = await request(app)
        .get("/api/bounty/matches")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.matches)).toBe(true);
    });
  });

  describe("GET /api/bounty/leaderboard", () => {
    it("returns leaderboard array", async () => {
      const res = await request(app)
        .get("/api/bounty/leaderboard")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
    });
  });

  describe("GET /api/bounty/stats", () => {
    it("returns platform stats", async () => {
      const res = await request(app)
        .get("/api/bounty/stats")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("activeProfiles");
      expect(res.body.data).toHaveProperty("totalScans");
      expect(res.body.data).toHaveProperty("totalMatches");
      expect(res.body.data).toHaveProperty("totalPayouts");
    });
  });
});
