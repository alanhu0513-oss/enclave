const express = require('express');
const { table } = require('../db/query');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

router.get('/data', async (req, res) => {
  try {
    const uid = req.user.userId;
    const users = await table('users');
    const faceprints = await table('faceprints');
    const voiceprints = await table('voiceprints');
    const signatures = await table('signatures');
    const alertsTbl = await table('alerts');
    const documentsTbl = await table('documents');

    const [user, faceprint, voiceprint, signature, alerts, documents] = await Promise.all([
      users.find({ id: uid }),
      faceprints.find({ user_id: uid }),
      voiceprints.find({ user_id: uid }),
      signatures.find({ user_id: uid }),
      alertsTbl.filter({ user_id: uid }),
      documentsTbl.filter({ user_id: uid })
    ]);

    if (alerts) alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (documents) documents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return success(res, { user, faceprint, voiceprint, signature, alerts, documents });
  } catch (e) {
    return error(res, e.message);
  }
});

router.delete('/data', async (req, res) => {
  try {
    const uid = req.user.userId;
    await Promise.all([
      (await table('auth_attempts')).remove({ user_id: uid }),
      (await table('documents')).remove({ user_id: uid }),
      (await table('alerts')).remove({ user_id: uid }),
      (await table('signatures')).remove({ user_id: uid }),
      (await table('voiceprints')).remove({ user_id: uid }),
      (await table('faceprints')).remove({ user_id: uid }),
      (await table('users')).remove({ id: uid })
    ]);
    return success(res, null, 'All user data deleted');
  } catch (e) {
    return error(res, e.message);
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const { fullName } = req.body;
    if (!fullName) return error(res, 'Full name required', 400);
    const users = await table('users');
    const updated = await users.update(
      { id: req.user.userId },
      { full_name: fullName, updated_at: new Date().toISOString() }
    );
    return success(res, { id: updated.id, email: updated.email, fullName: updated.full_name }, 'Profile updated');
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
