const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const threatIntel = require('../services/threat-intel');
const community = require('../services/community');
const threatDB = require('../services/threat-db');

const router = express.Router();

// ─── Threat Intelligence Sharing ───

router.post('/threats/share', authenticate, async (req, res) => {
  try {
    const { iocType, iocValue, sourceAlertId, severity, description, tags } = req.body;
    const result = await threatIntel.shareIndicator(req.user.userId, {
      iocType, iocValue, sourceAlertId, severity, description, tags
    });
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/threats', optionalAuth, async (req, res) => {
  try {
    const { iocType, severity, minConfidence, search, page, limit } = req.query;
    const result = await threatIntel.getIndicators({
      iocType, severity,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      search, page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/threats/:id/vote', authenticate, async (req, res) => {
  try {
    const { vote } = req.body;
    const result = await threatIntel.voteIndicator(req.params.id, req.user.userId, vote);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/threats/check', optionalAuth, async (req, res) => {
  try {
    const { value } = req.query;
    if (!value) return error(res, 'Value required', 400);
    const result = await threatIntel.checkAgainstThreatDB(value);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/threats/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await threatIntel.getStats();
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Anonymous Forum ───

router.post('/forum/posts', authenticate, async (req, res) => {
  try {
    const { category, title, body, tags, replyTo } = req.body;
    const result = await community.createPost(req.user.userId, {
      category, title, body, tags, replyTo
    });
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/forum/posts', optionalAuth, async (req, res) => {
  try {
    const { category, search, replyTo, page, limit } = req.query;
    const result = await community.getPosts({
      category, search, replyTo,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/forum/posts/:id', optionalAuth, async (req, res) => {
  try {
    const post = await community.getPostWithReplies(req.params.id);
    if (!post) return error(res, 'Post not found', 404);
    return success(res, post);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/forum/posts/:id/vote', authenticate, async (req, res) => {
  try {
    const { vote } = req.body;
    const result = await community.votePost(req.params.id, req.user.userId, vote);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/forum/categories', (req, res) => {
  return success(res, { categories: community.CATEGORIES });
});

router.get('/forum/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await community.getStats();
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

// ─── Open Threat Database (Public API) ───

router.post('/otdb/api-key', authenticate, async (req, res) => {
  try {
    const apiKey = await threatDB.getOrCreateApiKey(req.user.userId);
    const stats = await threatDB.getApiKeyStats(req.user.userId);
    return success(res, { apiKey, stats });
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/otdb/usage', authenticate, async (req, res) => {
  try {
    const stats = await threatDB.getApiKeyStats(req.user.userId);
    return success(res, stats);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/otdb/submit', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return error(res, 'API key required', 401);
    const result = await threatDB.submitIndicator(apiKey, req.body);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.get('/otdb/query', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return error(res, 'API key required', 401);
    const { iocType, severity, minConfidence, search, page, limit } = req.query;
    const result = await threatDB.queryIndicators(apiKey, {
      iocType, severity,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      search, page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

router.post('/otdb/bulk', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return error(res, 'API key required', 401);
    const { values } = req.body;
    const result = await threatDB.bulkCheck(apiKey, values);
    return success(res, result);
  } catch (e) {
    return error(res, e.message);
  }
});

module.exports = router;
