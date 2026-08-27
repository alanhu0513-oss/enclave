const express = require('express');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const family = require('../services/family');

const router = express.Router();

router.use(authenticate);

/** List family members. */
router.get('/members', async (req, res) => {
  try {
    const members = await family.listMembers(req.user.userId);
    return success(res, { members, maxMembers: family.MAX_MEMBERS }, 'Family members');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Add a family member. */
router.post('/members', async (req, res) => {
  try {
    const result = await family.addMember(req.user.userId, req.body);
    if (!result.success) return error(res, result.reason || 'Unable to add member', 400);
    return success(res, result.member, 'Family member added');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Update a family member. */
router.patch('/members/:id', async (req, res) => {
  try {
    const result = await family.updateMember(req.user.userId, req.params.id, req.body);
    if (!result.success) return error(res, result.reason || 'Unable to update member', 400);
    return success(res, result.member, 'Family member updated');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Remove a family member. */
router.delete('/members/:id', async (req, res) => {
  try {
    const result = await family.removeMember(req.user.userId, req.params.id);
    if (!result.success) return error(res, 'Family member not found', 404);
    return success(res, null, 'Family member removed');
  } catch (e) {
    return error(res, e.message);
  }
});

/** View a member's alerts (consolidated dashboard). */
router.get('/members/:id/alerts', async (req, res) => {
  try {
    const members = await family.listMembers(req.user.userId);
    const member = members.find((m) => m.id === req.params.id);
    if (!member) return error(res, 'Family member not found', 404);
    const result = await family.getMemberAlerts(member.email);
    if (!result.success) return success(res, { alerts: [] }, 'Member has no account yet');
    return success(res, { alerts: result.alerts }, 'Member alerts');
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
