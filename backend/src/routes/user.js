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

    const safeUser = user ? { id: user.id, email: user.email, fullName: user.full_name, provider: user.provider, avatar_url: user.avatar_url, created_at: user.created_at, updated_at: user.updated_at } : null;

    return success(res, { user: safeUser, faceprint, voiceprint, signature, alerts, documents });
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
      (await table('takedowns')).remove({ user_id: uid }),
      (await table('notifications')).remove({ user_id: uid }),
      (await table('usage_tracking')).remove({ user_id: uid }),
      (await table('monitoring_state')).remove({ user_id: uid }),
      (await table('scan_sessions')).remove({ user_id: uid }),
      (await table('users')).remove({ id: uid })
    ]);
    return success(res, null, 'All user data deleted');
  } catch (e) {
    return error(res, e.message);
  }
});

/** GDPR Art. 20 export — complete machine-readable dump as a download. */
router.get('/export', async (req, res) => {
  try {
    const uid = req.user.userId;
    const [
      users, faceprints, voiceprints, signatures, alertsTbl,
      documentsTbl, takedownsTbl, notificationsTbl, usageTbl
    ] = await Promise.all([
      table('users'), table('faceprints'), table('voiceprints'),
      table('signatures'), table('alerts'), table('documents'),
      table('takedowns'), table('notifications'), table('usage_tracking')
    ]);

    const [user, faceprintsRows, voiceprintsRows, signaturesRows,
      alerts, documents, takedowns, notifications, usage] = await Promise.all([
      users.find({ id: uid }),
      faceprints.filter({ user_id: uid }),
      voiceprints.filter({ user_id: uid }),
      signatures.filter({ user_id: uid }),
      alertsTbl.filter({ user_id: uid }),
      documentsTbl.filter({ user_id: uid }),
      takedownsTbl.filter({ user_id: uid }),
      notificationsTbl.filter({ user_id: uid }),
      usageTbl.filter({ user_id: uid })
    ]);

    // Strip secrets from the account record
    const { password_hash, ...safeUser } = user || {};

    const dump = {
      exportedAt: new Date().toISOString(),
      format: 'enclave-gdpr-export/1.0',
      account: safeUser,
      biometrics: {
        faceprints: faceprintsRows.map(({ embedding_file, ...rest }) => ({ ...rest, embedding_file: embedding_file ? '<file on disk>' : null })),
        voiceprints: voiceprintsRows,
        signatures: signaturesRows,
      },
      alerts,
      documents,
      takedowns,
      notifications,
      usageHistory: usage,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="enclave-export-${uid.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.send(JSON.stringify(dump, null, 2));
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
