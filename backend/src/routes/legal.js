const express = require('express');
const { success, error } = require('../utils/response');
const legal = require('../services/legal');

const router = express.Router();

/** Public legal documents (no auth — required for signup flow visibility). */
router.get('/', (req, res) => {
  return success(res, legal.getLegalIndex());
});

router.get('/:doc', (req, res) => {
  const doc = legal.getLegalDoc(req.params.doc);
  if (!doc) return error(res, 'Unknown document', 404);
  return success(res, doc);
});

module.exports = router;
