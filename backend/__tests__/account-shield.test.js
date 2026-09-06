const request = require("supertest");
const path = require("path");
const fs = require("fs");
const { createHash } = require("crypto");

const origEnv = { ...process.env };
process.env.DATABASE_URL = "";
process.env.DATABASE_PATH = path.join(__dirname, "..", "data", "test-account-shield.json");
process.env.JWT_SECRET = "test-secret-for-ci";
process.env.PORT = "0";
process.env.STRIPE_SECRET_KEY = "";
process.env.HIBP_API_KEY = "";
process.env.SMTP_DISABLED = "1";

const testDb = process.env.DATABASE_PATH;
try { fs.unlinkSync(testDb); } catch (_) {}

const app = require("../src/index");
const { resetEngine } = require("../src/db/adapter");

let token;

// HIBP pwned-password range API is stubbed so tests are fast + deterministic.
const rangeMap = new Map();
function addPwned(password, count) {
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  rangeMap.set(sha.slice(0, 5), sha.slice(5) + ":" + count);
}
const realFetch = global.fetch;

const STRONG_PW = "Xz!9pQ#k2Lm$vR7";
const BREACHED_PW = "Tr0ub4dor&Horse";

beforeAll(async () => {
  resetEngine();
  addPwned(BREACHED_PW, 5);
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("api.pwnedpasswords.com/range/")) {
      const prefix = u.split("/").pop().split("?")[0];
      const body = rangeMap.get(prefix)
        ? rangeMap.get(prefix) + "\n"
        : "AAAAA:1\n";
      return { ok: true, status: 200, text: async () => body };
    }
    return realFetch(url, opts);
  };
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "shield@test.com", password: "TestPass123!", fullName: "Shield Test" });
  token = res.body.data.token;
});

afterAll(() => {
  global.fetch = realFetch;
  try { fs.unlinkSync(testDb); } catch (_) {}
  process.env = origEnv;
});

async function addAccount(site, identifier) {
  const res = await request(app)
    .post("/api/account-shield/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ site, identifier });
  expect(res.status).toBe(201);
  return res.body.data.account;
}

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

  describe("Credential barrier (PUT /api/account-shield/accounts/:id/credential)", () => {
    it("rejects a too-short password", async () => {
      const acc = await addAccount("discord", "barrier.short@test.com");
      const res = await request(app)
        .put(`/api/account-shield/accounts/${acc.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "short", mfaEnabled: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 8/);
    });

    it("rejects a weak password", async () => {
      const acc = await addAccount("roblox", "barrier.weak@test.com");
      const res = await request(app)
        .put(`/api/account-shield/accounts/${acc.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "aaaaaaaaaaaa", mfaEnabled: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/weak/i);
    }, 15000);

    it("rejects a password known to be pwned", async () => {
      const acc = await addAccount("steam", "barrier.pwned@test.com");
      const res = await request(app)
        .put(`/api/account-shield/accounts/${acc.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: BREACHED_PW, mfaEnabled: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/breach/);
    }, 15000);

    it("rejects a password reused on another watched account", async () => {
      const acc1 = await addAccount("bank", "barrier.reuse1@test.com");
      const r1 = await request(app)
        .put(`/api/account-shield/accounts/${acc1.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: STRONG_PW, mfaEnabled: true });
      expect(r1.status).toBe(200);

      const acc2 = await addAccount("google", "barrier.reuse2@test.com");
      const r2 = await request(app)
        .put(`/api/account-shield/accounts/${acc2.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: STRONG_PW, mfaEnabled: true });
      expect(r2.status).toBe(400);
      expect(r2.body.message).toMatch(/already in use/);
    });

    it("accepts a strong unique password and reports a fortified wall", async () => {
      const acc = await addAccount("crypto", "barrier.good@test.com");
      const res = await request(app)
        .put(`/api/account-shield/accounts/${acc.id}/credential`)
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "K!w6#xRp9Zm$cN4", mfaEnabled: true });
      expect(res.status).toBe(200);
      expect(res.body.data.fortified).toBe(true);
      expect(res.body.data.password_set).toBe(true);
      expect(res.body.data.pwned_count).toBe(0);
      expect(res.body.data.wall).toBe("fortified");

      const get = await request(app)
        .get(`/api/account-shield/accounts/${acc.id}/credential`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(get.body.data.mfa_enabled).toBe(true);
      expect(typeof get.body.data.password_strength).toBe("number");
      expect(get.body.data.credential_enc).toBeUndefined();
    });
  });

  describe("Lockdown (POST /api/account-shield/accounts/:id/lockdown)", () => {
    it("initiates a lockdown playbook with recovery steps", async () => {
      const acc = await addAccount("google", "barrier.lockdown@test.com");
      const res = await request(app)
        .post(`/api/account-shield/accounts/${acc.id}/lockdown`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.playbook).toBeDefined();
      expect(res.body.data.playbook.title).toMatch(/google/i);
      expect(Array.isArray(res.body.data.playbook.steps)).toBe(true);
      expect(res.body.data.playbook.steps.length).toBeGreaterThan(0);
      expect(res.body.data.status).toBe("active");
    });

    it("lists lockdowns and allows completing them", async () => {
      const list = await request(app)
        .get("/api/account-shield/lockdowns")
        .set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data.lockdowns)).toBe(true);
      expect(list.body.data.lockdowns.length).toBeGreaterThan(0);
      const first = list.body.data.lockdowns[0];

      const done = await request(app)
        .patch(`/api/account-shield/lockdowns/${first.id}/complete`)
        .set("Authorization", `Bearer ${token}`);
      expect(done.status).toBe(200);
      expect(done.body.data.completed).toBe(true);
    });

    it("rejects lockdown for a nonexistent account", async () => {
      const res = await request(app)
        .post("/api/account-shield/accounts/nope/lockdown")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/account-shield/summary (barrier wall counts)", () => {
    it("reports wall states and lockdown tally", async () => {
      const res = await request(app)
        .get("/api/account-shield/summary")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.walls).toBeDefined();
      expect(typeof res.body.data.walls.fortified).toBe("number");
      expect(res.body.data.lockdowns).toBeDefined();
      expect(res.body.data.lockdowns).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/account-shield/sites/:site/guide", () => {
    it("returns a provider hardening guide with steps and links", async () => {
      const res = await request(app)
        .get("/api/account-shield/sites/google/guide")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.guide.title).toMatch(/google/i);
      expect(Array.isArray(res.body.data.guide.steps)).toBe(true);
      expect(res.body.data.guide.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.guide.links)).toBe(true);
    });
  });

  describe("Hardening checklist in account listings", () => {
    it("exposes the 7-item checklist with met flags", async () => {
      const list = await request(app)
        .get("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`);
      const account = list.body.data.accounts.find((a) => a.identifier === "barrier.good@test.com");
      expect(account).toBeDefined();
      expect(Array.isArray(account.checklist)).toBe(true);
      expect(account.checklist.length).toBe(7);
      const keys = account.checklist.map((c) => c.key);
      expect(keys).toContain("credential");
      expect(keys).toContain("mfa");
      expect(keys).toContain("not_in_breach");
      const fortifiedItem = account.checklist.find((c) => c.key === "credential");
      expect(fortifiedItem.met).toBe(true);
      expect(typeof fortifiedItem.weight).toBe("number");
    });

    it("marks checklist items unmet for a fresh open-wall account", async () => {
      const acc = await addAccount("xbox", "checklist.open@test.com");
      const list = await request(app)
        .get("/api/account-shield/accounts")
        .set("Authorization", `Bearer ${token}`);
      const account = list.body.data.accounts.find((a) => a.id === acc.id);
      expect(account.wall).toBe("open");
      const cred = account.checklist.find((c) => c.key === "credential");
      const mfa = account.checklist.find((c) => c.key === "mfa");
      expect(cred.met).toBe(false);
      expect(mfa.met).toBe(false);
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