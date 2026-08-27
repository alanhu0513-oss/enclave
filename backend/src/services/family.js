/**
 * Family Protection Plan (Phase 5.1)
 * Owner manages up to 5 family members with per-member protection profiles.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const MAX_MEMBERS = 5;
const PROFILES = ['full', 'monitoring-only', 'alerts-only'];
const ROLES = ['owner', 'member'];

async function listMembers(ownerId) {
  const members = await table('family_members');
  const all = await members.filter({ owner_id: ownerId });
  return (Array.isArray(all) ? all : all ? [all] : []).map((m) => ({
    id: m.id,
    email: m.member_email,
    name: m.member_name,
    role: m.role,
    profile: m.profile,
    status: m.status,
    createdAt: m.created_at,
  }));
}

async function addMember(ownerId, data) {
  const { email, name = '', role = 'member', profile = 'full' } = data;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, reason: 'invalid_email' };
  }
  if (!PROFILES.includes(profile)) return { success: false, reason: 'invalid_profile' };
  if (!ROLES.includes(role)) return { success: false, reason: 'invalid_role' };

  const members = await table('family_members');
  const existing = await members.filter({ owner_id: ownerId });
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  if (list.length >= MAX_MEMBERS) {
    return { success: false, reason: 'family_limit_reached' };
  }
  if (list.some((m) => m.member_email === email)) {
    return { success: false, reason: 'already_added' };
  }

  const id = uuidv4();
  await members.insert({
    id,
    owner_id: ownerId,
    member_email: email,
    member_name: name,
    role,
    profile,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  return { success: true, id, member: { id, email, name, role, profile, status: 'pending' } };
}

async function updateMember(ownerId, memberId, updates) {
  const allowed = {};
  if (updates.name !== undefined) allowed.member_name = updates.name;
  if (updates.role !== undefined) {
    if (!ROLES.includes(updates.role)) return { success: false, reason: 'invalid_role' };
    allowed.role = updates.role;
  }
  if (updates.profile !== undefined) {
    if (!PROFILES.includes(updates.profile)) return { success: false, reason: 'invalid_profile' };
    allowed.profile = updates.profile;
  }
  if (updates.status !== undefined) allowed.status = updates.status;
  if (!Object.keys(allowed).length) return { success: false, reason: 'no_changes' };

  const members = await table('family_members');
  const updated = await members.update({ id: memberId, owner_id: ownerId }, allowed);
  if (!updated) return { success: false, reason: 'not_found' };
  return { success: true, member: { id: updated.id, email: updated.member_email, name: updated.member_name, role: updated.role, profile: updated.profile, status: updated.status } };
}

async function removeMember(ownerId, memberId) {
  const members = await table('family_members');
  const removed = await members.remove({ id: memberId, owner_id: ownerId });
  return { success: removed > 0 };
}

async function getMemberAlerts(email) {
  const users = await table('users');
  const user = await users.find({ email });
  if (!user) return { success: false, reason: 'member_not_registered', alerts: [] };
  const alerts = await table('alerts');
  const all = await alerts.filter({ user_id: user.id });
  return {
    success: true,
    memberId: user.id,
    alerts: (Array.isArray(all) ? all : all ? [all] : []).map((a) => ({
      id: a.id,
      source: a.source_url,
      confidence: a.confidence,
      status: a.status,
      timestamp: a.created_at,
    })),
  };
}

module.exports = {
  MAX_MEMBERS,
  listMembers,
  addMember,
  updateMember,
  removeMember,
  getMemberAlerts,
};
