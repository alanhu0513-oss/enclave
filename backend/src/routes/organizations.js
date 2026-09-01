const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { table } = require('../db/query');

const router = express.Router();
router.use(authenticate);

/* ─── Organization CRUD ─── */

/** Create organization. */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return error(res, 'Organization name required', 400);

    const orgs = await table('organizations');
    const users = await table('users');
    const user = await users.find({ id: req.user.userId });

    const orgId = uuidv4();
    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();

    await orgs.insert({
      id: orgId,
      name: String(name).slice(0, 100),
      owner_id: req.user.userId,
      plan: user?.plan || 'free',
      invite_code: inviteCode,
      sso_enabled: false,
      sso_provider: null,
      sso_domain: null,
      created_at: new Date().toISOString(),
    });

    // Add owner as member
    const members = await table('org_members');
    await members.insert({
      id: uuidv4(),
      org_id: orgId,
      user_id: req.user.userId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

    // Log audit event
    await _auditLog(req.user.userId, orgId, 'org_created', { name });

    return success(res, { id: orgId, inviteCode }, 'Organization created');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Get user's organizations. */
router.get('/', async (req, res) => {
  try {
    const members = await table('org_members');
    const orgs = await table('organizations');
    const userMemberships = await members.filter({ user_id: req.user.userId });

    const result = [];
    for (const m of userMemberships) {
      const org = await orgs.find({ id: m.org_id });
      if (org) {
        const allMembers = await members.filter({ org_id: m.org_id });
        result.push({
          id: org.id,
          name: org.name,
          role: m.role,
          memberCount: allMembers.length,
          plan: org.plan,
          ssoEnabled: org.sso_enabled,
          createdAt: org.created_at,
        });
      }
    }
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

/** Get organization details. */
router.get('/:id', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length) return error(res, 'Not a member', 403);

    const allMembers = await members.filter({ org_id: org.id });
    const users = await table('users');
    const memberDetails = [];
    for (const m of allMembers) {
      const user = await users.find({ id: m.user_id });
      memberDetails.push({
        userId: m.user_id,
        email: user?.email,
        name: user?.full_name,
        role: m.role,
        joinedAt: m.joined_at,
      });
    }

    return success(res, {
      ...org,
      members: memberDetails,
      role: membership[0]?.role,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

/** Update organization. */
router.patch('/:id', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length || !['owner', 'admin'].includes(membership[0].role)) {
      return error(res, 'Insufficient permissions', 403);
    }

    const { name, ssoEnabled, ssoProvider, ssoDomain } = req.body;
    const updates = {};
    if (name) updates.name = String(name).slice(0, 100);
    if (typeof ssoEnabled === 'boolean') updates.sso_enabled = ssoEnabled;
    if (ssoProvider) updates.sso_provider = ssoProvider;
    if (ssoDomain) updates.sso_domain = ssoDomain;

    if (Object.keys(updates).length > 0) {
      await orgs.update({ id: org.id }, updates);
      await _auditLog(req.user.userId, org.id, 'org_updated', updates);
    }

    return success(res, { updated: true });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Member Management ─── */

/** Invite member by email or code. */
router.post('/:id/invite', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const invites = await table('org_invites');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length || !['owner', 'admin'].includes(membership[0].role)) {
      return error(res, 'Insufficient permissions', 403);
    }

    const { email, role } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return error(res, 'Valid email required', 400);
    const validRoles = ['admin', 'member', 'viewer'];
    const assignRole = validRoles.includes(role) ? role : 'member';

    const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    await invites.insert({
      id: uuidv4(),
      org_id: org.id,
      email: String(email).toLowerCase(),
      role: assignRole,
      invited_by: req.user.userId,
      code: inviteCode,
      accepted: false,
      created_at: new Date().toISOString(),
    });

    await _auditLog(req.user.userId, org.id, 'member_invited', { email, role: assignRole });

    return success(res, { inviteCode }, 'Invitation created');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Accept invite by code. */
router.post('/invite/accept', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Invite code required', 400);

    const invites = await table('org_invites');
    const members = await table('org_members');
    const invite = await invites.find({ code: String(code).toUpperCase(), accepted: false });
    if (!invite.length) return error(res, 'Invalid or used invite code', 404);

    const inv = invite[0];
    const existing = await members.find({ org_id: inv.org_id, user_id: req.user.userId });
    if (existing.length) return error(res, 'Already a member', 400);

    await members.insert({
      id: uuidv4(),
      org_id: inv.org_id,
      user_id: req.user.userId,
      role: inv.role,
      joined_at: new Date().toISOString(),
    });

    await invites.update({ id: inv.id }, { accepted: true, accepted_at: new Date().toISOString() });
    await _auditLog(req.user.userId, inv.org_id, 'member_joined', { role: inv.role });

    return success(res, { orgId: inv.org_id, role: inv.role }, 'Joined organization');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Update member role. */
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const callerMembership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!callerMembership.length || callerMembership[0].role !== 'owner') {
      return error(res, 'Only owners can change roles', 403);
    }

    const { role } = req.body;
    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) return error(res, 'Invalid role', 400);

    await members.update(
      { org_id: org.id, user_id: req.params.userId },
      { role }
    );

    await _auditLog(req.user.userId, org.id, 'member_role_changed', { userId: req.params.userId, role });
    return success(res, { updated: true });
  } catch (e) {
    return error(res, e.message);
  }
});

/** Remove member. */
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const callerMembership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!callerMembership.length || !['owner', 'admin'].includes(callerMembership[0].role)) {
      return error(res, 'Insufficient permissions', 403);
    }

    if (req.params.userId === req.user.userId) return error(res, 'Cannot remove yourself', 400);

    await members.delete({ org_id: org.id, user_id: req.params.userId });
    await _auditLog(req.user.userId, org.id, 'member_removed', { userId: req.params.userId });

    return success(res, { removed: true });
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Audit Logs ─── */

/** Get audit logs for organization. */
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length) return error(res, 'Not a member', 403);

    const logs = await table('audit_logs');
    const orgLogs = await logs.filter({ org_id: org.id });
    const sorted = orgLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const limit = parseInt(req.query.limit) || 50;
    return success(res, sorted.slice(0, limit));
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── SSO Configuration ─── */

/** Configure SSO (SAML/OIDC stub). */
router.post('/:id/sso', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length || membership[0].role !== 'owner') {
      return error(res, 'Only owners can configure SSO', 403);
    }

    const { provider, domain, metadataUrl, clientId } = req.body;
    const validProviders = ['google', 'okta', 'azure', 'onelogin', 'custom'];
    if (!validProviders.includes(provider)) return error(res, 'Invalid SSO provider', 400);
    if (!domain) return error(res, 'Domain required', 400);

    await orgs.update({ id: org.id }, {
      sso_enabled: true,
      sso_provider: provider,
      sso_domain: String(domain).toLowerCase(),
      sso_config: JSON.stringify({ metadataUrl, clientId }),
    });

    await _auditLog(req.user.userId, org.id, 'sso_configured', { provider, domain });
    return success(res, { configured: true }, 'SSO configured');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Disable SSO. */
router.delete('/:id/sso', async (req, res) => {
  try {
    const orgs = await table('organizations');
    const members = await table('org_members');
    const org = await orgs.find({ id: req.params.id });
    if (!org) return error(res, 'Organization not found', 404);

    const membership = await members.find({ org_id: org.id, user_id: req.user.userId });
    if (!membership.length || membership[0].role !== 'owner') {
      return error(res, 'Only owners can disable SSO', 403);
    }

    await orgs.update({ id: org.id }, {
      sso_enabled: false,
      sso_provider: null,
      sso_domain: null,
      sso_config: null,
    });

    await _auditLog(req.user.userId, org.id, 'sso_disabled', {});
    return success(res, { disabled: true }, 'SSO disabled');
  } catch (e) {
    return error(res, e.message);
  }
});

/* ─── Helper ─── */

async function _auditLog(userId, orgId, action, details) {
  try {
    const logs = await table('audit_logs');
    await logs.insert({
      id: uuidv4(),
      org_id: orgId,
      user_id: userId,
      action,
      details: JSON.stringify(details),
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Audit] Log failed:', e.message);
  }
}

module.exports = router;
