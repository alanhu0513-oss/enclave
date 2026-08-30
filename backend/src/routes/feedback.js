const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { table } = require('../db/query');

const router = express.Router();
router.use(authenticate);

/** Submit feedback (bug report, general, idea). */
router.post('/', async (req, res) => {
  try {
    const { type, message, email, page } = req.body;
    if (!message || !String(message).trim()) return error(res, 'Message required', 400);
    const validTypes = ['bug', 'idea', 'general', 'nps'];
    const feedbackType = validTypes.includes(type) ? type : 'general';

    const tbl = await table('feedback');
    const entry = {
      id: uuidv4(),
      user_id: req.user.userId,
      type: feedbackType,
      message: String(message).slice(0, 2000),
      email: email || null,
      page: page || null,
      created_at: new Date().toISOString(),
    };
    await tbl.insert(entry);
    return success(res, { id: entry.id }, 'Feedback submitted');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Submit NPS score. */
router.post('/nps', async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (typeof score !== 'number' || score < 0 || score > 10) {
      return error(res, 'Score must be 0-10', 400);
    }
    const tbl = await table('nps_responses');
    const entry = {
      id: uuidv4(),
      user_id: req.user.userId,
      score,
      comment: comment ? String(comment).slice(0, 500) : null,
      created_at: new Date().toISOString(),
    };
    await tbl.insert(entry);
    return success(res, { id: entry.id }, 'NPS response recorded');
  } catch (e) {
    return error(res, e.message);
  }
});

/** List feature requests (with vote counts). */
router.get('/features', async (req, res) => {
  try {
    const tbl = await table('feature_requests');
    const votesTbl = await table('feature_votes');
    const features = await tbl.filter({});
    const votes = await votesTbl.filter({});

    const voteMap = {};
    for (const v of votes) {
      voteMap[v.feature_id] = (voteMap[v.feature_id] || 0) + 1;
    }

    const result = features
      .map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status || 'open',
        votes: voteMap[f.id] || 0,
        createdBy: f.user_id,
        createdAt: f.created_at,
      }))
      .sort((a, b) => b.votes - a.votes);

    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

/** Create a feature request. */
router.post('/features', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !String(title).trim()) return error(res, 'Title required', 400);

    const tbl = await table('feature_requests');
    const entry = {
      id: uuidv4(),
      user_id: req.user.userId,
      title: String(title).slice(0, 200),
      description: description ? String(description).slice(0, 1000) : '',
      status: 'open',
      created_at: new Date().toISOString(),
    };
    await tbl.insert(entry);
    return success(res, { id: entry.id }, 'Feature request created');
  } catch (e) {
    return error(res, e.message);
  }
});

/** Vote on a feature request. */
router.post('/features/:id/vote', async (req, res) => {
  try {
    const featureId = req.params.id;
    const tbl = await table('feature_requests');
    const features = await tbl.filter({ id: featureId });
    if (!features.length) return error(res, 'Feature not found', 404);

    const votesTbl = await table('feature_votes');
    const existing = await votesTbl.filter({ feature_id: featureId, user_id: req.user.userId });
    if (existing.length) {
      // Unvote
      await votesTbl.delete({ feature_id: featureId, user_id: req.user.userId });
      const allVotes = await votesTbl.filter({ feature_id: featureId });
      return success(res, { voted: false, votes: allVotes.length });
    }

    await votesTbl.insert({
      id: uuidv4(),
      feature_id: featureId,
      user_id: req.user.userId,
      created_at: new Date().toISOString(),
    });
    const allVotes = await votesTbl.filter({ feature_id: featureId });
    return success(res, { voted: true, votes: allVotes.length });
  } catch (e) {
    return error(res, e.message);
  }
});

/** Check if user has completed NPS (for survey gating). */
router.get('/nps/status', async (req, res) => {
  try {
    const tbl = await table('nps_responses');
    const responses = await tbl.filter({ user_id: req.user.userId });
    const lastResponse = responses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const daysSinceLast = lastResponse
      ? (Date.now() - new Date(lastResponse.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    return success(res, {
      hasResponded: responses.length > 0,
      eligibleForSurvey: daysSinceLast > 30,
      lastScore: lastResponse?.score || null,
    });
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
