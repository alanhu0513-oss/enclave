/**
 * Anonymous Community Forum Service
 * Peer support, advice sharing, and discussion — all anonymous.
 * Users get an auto-generated anonymous handle per topic.
 * No real identities are stored or linked.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const ANONYMOUS_ADJECTIVES = [
  'silent', 'shadow', 'digital', 'phantom', 'ghost', 'hidden', 'masked',
  'covert', 'dark', 'vague', 'obscure', 'stealth', 'cloaked', 'veiled',
  'cryptic', 'enigmatic', 'mysterious', 'arcane', 'occult', 'ethereal'
];

const ANONYMOUS_NOUNS = [
  'shield', 'guardian', 'sentinel', 'warden', 'protector', 'defender',
  'cipher', 'node', 'proxy', 'relay', 'beacon', 'signal', 'watcher',
  'seeker', 'oracle', 'keeper', 'agent', 'specter', 'wraith', 'cipher'
];

function generateAnonymousHandle() {
  const adj = ANONYMOUS_ADJECTIVES[Math.floor(Math.random() * ANONYMOUS_ADJECTIVES.length)];
  const noun = ANONYMOUS_NOUNS[Math.floor(Math.random() * ANONYMOUS_NOUNS.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj}_${noun}_${num}`;
}

const CATEGORIES = [
  { id: 'support', name: 'Support & Advice', description: 'Get help from the community' },
  { id: 'threats', name: 'Threat Reports', description: 'Report and discuss active threats' },
  { id: 'legal', name: 'Legal Help', description: 'Share legal resources and experiences' },
  { id: 'prevention', name: 'Prevention Tips', description: 'How to protect yourself and others' },
  { id: 'tools', name: 'Tools & Resources', description: 'Discovery and recommendations' },
  { id: 'stories', name: 'Survivor Stories', description: 'Share your experience (anonymous)' }
];

/**
 * Create a forum post (anonymous).
 */
async function createPost(userId, data) {
  const { category, title, body, tags, replyTo } = data;
  if (!category || !title || !body) return { success: false, reason: 'missing_fields' };
  if (!CATEGORIES.find(c => c.id === category)) return { success: false, reason: 'invalid_category' };

  const posts = await table('forum_posts');
  const id = uuidv4();
  const anonHandle = generateAnonymousHandle();

  await posts.insert({
    id,
    user_id: userId,
    anonymous_handle: anonHandle,
    category,
    title,
    body,
    tags: JSON.stringify(tags || []),
    reply_to: replyTo || null,
    upvotes: 0,
    downvotes: 0,
    pinned: false,
    created_at: new Date().toISOString()
  });

  return { success: true, id, anonymousHandle: anonHandle };
}

/**
 * Get posts with optional filters. Returns anonymous data only.
 */
async function getPosts(filters) {
  filters = filters || {};
  const posts = await table('forum_posts');
  const all = await posts.all();
  let results = Array.isArray(all) ? all : all ? [all] : [];

  // Strip user_id from results for anonymity
  results = results.map(p => ({
    id: p.id,
    anonymousHandle: p.anonymous_handle,
    category: p.category,
    title: p.title,
    body: p.body,
    tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []),
    replyTo: p.reply_to,
    upvotes: p.upvotes || 0,
    downvotes: p.downvotes || 0,
    pinned: p.pinned || false,
    createdAt: p.created_at
  }));

  if (filters.category) {
    results = results.filter(r => r.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q)
    );
  }
  if (filters.replyTo) {
    results = results.filter(r => r.replyTo === filters.replyTo);
  }

  // Pinned first, then by date
  results.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Paginate
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;

  return {
    posts: results.slice(start, start + limit),
    total: results.length,
    page,
    limit,
    hasMore: start + limit < results.length,
    categories: CATEGORIES
  };
}

/**
 * Vote on a post.
 */
async function votePost(postId, userId, voteType) {
  if (!['up', 'down'].includes(voteType)) return { success: false, reason: 'invalid_vote' };

  const posts = await table('forum_posts');
  const post = await posts.find({ id: postId });
  if (!post) return { success: false, reason: 'post_not_found' };

  const votes = await table('forum_votes');
  const existing = await votes.find({ post_id: postId, user_id: userId });

  if (existing) {
    if (existing.vote_type === voteType) {
      // Remove vote
      await votes.update({ id: existing.id }, { removed: true, updated_at: new Date().toISOString() });
    } else {
      // Change vote
      await votes.update({ id: existing.id }, { vote_type: voteType, updated_at: new Date().toISOString() });
    }
  } else {
    await votes.insert({
      id: uuidv4(), post_id: postId, user_id: userId, vote_type: voteType,
      created_at: new Date().toISOString()
    });
  }

  // Recalculate votes
  const allVotes = await votes.filter({ post_id: postId });
  const voteList = Array.isArray(allVotes) ? allVotes : allVotes ? [allVotes] : [];
  const upvotes = voteList.filter(v => v.vote_type === 'up' && !v.removed).length;
  const downvotes = voteList.filter(v => v.vote_type === 'down' && !v.removed).length;

  await posts.update({ id: postId }, { upvotes, downvotes, updated_at: new Date().toISOString() });

  return { success: true, upvotes, downvotes };
}

/**
 * Get a single post with its replies (anonymous).
 */
async function getPostWithReplies(postId) {
  const posts = await table('forum_posts');
  const post = await posts.find({ id: postId });
  if (!post) return null;

  const allPosts = await posts.all();
  const all = Array.isArray(allPosts) ? allPosts : allPosts ? [allPosts] : [];
  const replies = all
    .filter(p => p.reply_to === postId)
    .map(p => ({
      id: p.id,
      anonymousHandle: p.anonymous_handle,
      body: p.body,
      upvotes: p.upvotes || 0,
      downvotes: p.downvotes || 0,
      createdAt: p.created_at
    }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    id: post.id,
    anonymousHandle: post.anonymous_handle,
    category: post.category,
    title: post.title,
    body: post.body,
    tags: typeof post.tags === 'string' ? JSON.parse(post.tags) : (post.tags || []),
    upvotes: post.upvotes || 0,
    downvotes: post.downvotes || 0,
    createdAt: post.created_at,
    replies,
    replyCount: replies.length
  };
}

/**
 * Get community stats.
 */
async function getStats() {
  const posts = await table('forum_posts');
  const all = await posts.all();
  const list = Array.isArray(all) ? all : all ? [all] : [];

  const byCategory = {};
  list.forEach(p => {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  });

  return {
    totalPosts: list.length,
    totalReplies: list.filter(p => p.reply_to).length,
    byCategory,
    activeToday: list.filter(p => {
      const d = new Date(p.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length
  };
}

module.exports = {
  CATEGORIES,
  createPost,
  getPosts,
  votePost,
  getPostWithReplies,
  getStats,
  generateAnonymousHandle
};
