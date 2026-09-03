/* ─── Enclave Crawler Service ───
 * Proactive identity monitoring: social media, dark web, paste sites,
 * reverse image analysis, face matching.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');
const cheerio = require('cheerio');
const sizeOf = require('image-size');
const mlClient = require('./ml-client');
const notifications = require('./notifications');

const activeSessions = new Map();
const scannedUrls = new Map();

const { UPLOAD_DIR } = require('../utils/upload-dir');

/* ─── Search Engines ─── */

const SEARCH_ENGINES = [
  {
    name: 'duckduckgo',
    url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    parser: parseDuckDuckGo,
  },
  {
    name: 'yandex',
    url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}&lr=84`,
    parser: parseYandex,
  },
];

const SUSPICIOUS_DOMAINS = [
  'deepfake', 'synthetic', 'face-swap', 'voice-clone', 'impersonator',
  'fake-profile', 'identity-market', 'unauthorized-mirror', 'ai-generated',
  'morph', 'swapface', 'deep-nude', 'celebrity-fake', 'nsfw',
  'nonconsensual', 'revenge-porn', 'sextortion',
];

const DARK_WEB_KEYWORDS = [
  'deepfake', 'face swap', 'voice clone', 'identity theft',
  'nonconsensual', 'ncii', 'sextortion', 'fake profile',
];

/* ─── Platform-Specific Crawlers ─── */

async function searchReddit(userName) {
  const results = [];
  const queries = [
    `${userName} deepfake`,
    `${userName} face swap`,
    `${userName} impersonation`,
  ];

  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=25`,
        10000
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of (data.data?.children || []).slice(0, 10)) {
        const d = post.data;
        results.push({
          title: d.title || 'Untitled',
          url: `https://reddit.com${d.permalink}`,
          snippet: (d.selftext || '').slice(0, 200),
          source: 'reddit',
          subreddit: d.subreddit,
          score: d.score,
          created: d.created_utc,
        });
      }
    } catch {}
  }
  return results;
}

async function searchPastebin(userName) {
  const results = [];
  const queries = [
    `${userName} deepfake`,
    `${userName} identity`,
    `${userName} leaked`,
  ];

  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
        `https://pastebin.com/search?q=${encodeURIComponent(q)}`,
        10000
      );
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $('.col-sm-12, .col-md-12').each((i, el) => {
        const title = $(el).find('a').first().text().trim();
        const url = $(el).find('a').first().attr('href');
        const snippet = $(el).text().trim().slice(0, 200);
        if (url && url.startsWith('/')) {
          results.push({
            title: title || 'Untitled Paste',
            url: `https://pastebin.com${url}`,
            snippet,
            source: 'pastebin',
          });
        }
      });
    } catch {}
  }
  return results;
}

async function search4chan(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://a.4cdn.org/search.json?q=${encodeURIComponent(userName)}`,
      10000
    );
    if (!res.ok) return [];
    const data = await res.json();
    for (const thread of (data.threads || []).slice(0, 10)) {
      results.push({
        title: thread.subject || thread.com?.slice(0, 50) || 'Untitled',
        url: `https://boards.4chan.org/${thread.board}/thread/${thread.no}`,
        snippet: (thread.com || '').replace(/<[^>]+>/g, '').slice(0, 200),
        source: '4chan',
        board: thread.board,
      });
    }
  } catch {}
  return results;
}

/* ─── Social Media Crawlers ─── */

async function searchTwitter(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:twitter.com+OR+site:x.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('twitter.com') || url.includes('x.com')) {
          results.push({ title, url, snippet, source: 'twitter' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchInstagram(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:instagram.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('instagram.com')) {
          results.push({ title, url, snippet, source: 'instagram' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchTikTok(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:tiktok.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('tiktok.com')) {
          results.push({ title, url, snippet, source: 'tiktok' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchFacebook(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:facebook.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('facebook.com')) {
          results.push({ title, url, snippet, source: 'facebook' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchYouTube(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:youtube.com+"${userName}"+deepfake+OR+"face+swap"+OR+impersonation`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('youtube.com')) {
          results.push({ title, url, snippet, source: 'youtube' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchLinkedIn(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:linkedin.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('linkedin.com')) {
          results.push({ title, url, snippet, source: 'linkedin' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchPinterest(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:pinterest.com+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('pinterest.com')) {
          results.push({ title, url, snippet, source: 'pinterest' });
        }
      }
    });
  } catch {}
  return results;
}

async function searchTelegram(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=site:t.me+"${userName}"`,
      10000
    );
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    $('.result, .web-result').each((i, el) => {
      const title = $(el).find('h2, .result__title').text().trim();
      let url = $(el).find('a').first().attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
        if (url.includes('t.me')) {
          results.push({ title, url, snippet, source: 'telegram' });
        }
      }
    });
  } catch {}
  return results;
}

/* ─── Dark Web Crawlers ─── */

async function searchDarkWebForums(userName) {
  const results = [];
  const darkWebSources = [
    { name: 'torum', url: `https://www.torum.com/search?q=${encodeURIComponent(userName)}` },
    { name: 'dread', url: `http://dread2kutj.onion/search/${encodeURIComponent(userName)}` },
    { name: 'exploit', url: `https://exploit.in/search?q=${encodeURIComponent(userName)}` },
    { name: 'nulled', url: `https://nulled.to/search/?q=${encodeURIComponent(userName)}` },
  ];

  for (const source of darkWebSources) {
    try {
      const res = await fetchWithTimeout(source.url, 15000);
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $('a[href]').each((i, el) => {
        const title = $(el).text().trim();
        const url = $(el).attr('href');
        if (title && url && title.length > 5) {
          results.push({
            title: title.slice(0, 100),
            url: url.startsWith('http') ? url : `${source.url}/${url}`,
            snippet: `Found on ${source.name}: ${title.slice(0, 100)}`,
            source: source.name,
            isDarkWeb: true,
          });
        }
      });
    } catch {}
  }
  return results;
}

async function searchTorHiddenServices(userName) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://ahmia.fi/api/v1/search/?q=${encodeURIComponent(userName)}+deepfake`,
      15000
    );
    if (!res.ok) return [];
    const data = await res.json();
    for (const item of (data.results || []).slice(0, 10)) {
      results.push({
        title: item.title || 'Untitled',
        url: item.url || item.bitcoin_address || '',
        snippet: item.description || '',
        source: 'ahmia',
        isOnion: true,
      });
    }
  } catch {}
  return results;
}

async function searchDarkPasteSites(userName) {
  const results = [];
  const pasteSites = [
    { name: 'pastebox', url: 'https://pastebox.org/' },
    { name: 'hastebin', url: 'https://hastebin.com/' },
    { name: 'rentry', url: 'https://rentry.co/' },
  ];

  for (const site of pasteSites) {
    try {
      const res = await fetchWithTimeout(
        `https://html.duckduckgo.com/html/?q=site:${new URL(site.url).hostname}+"${userName}"`,
        10000
      );
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $('.result, .web-result').each((i, el) => {
        const title = $(el).find('h2').text().trim();
        let url = $(el).find('a').first().attr('href');
        const snippet = $(el).find('.result__snippet').text().trim();
        if (url) {
          const match = url.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
          results.push({ title, url, snippet, source: site.name });
        }
      });
    } catch {}
  }
  return results;
}

/* ─── Search Engines ─── */

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── Parsers ─── */

function parseDuckDuckGo(html) {
  const $ = cheerio.load(html);
  const results = [];
  $('.result, .web-result, article').each((i, el) => {
    const title = $(el).find('h2, .result__title, .result-title').text().trim();
    let url = $(el).find('a').first().attr('href');
    const snippet = $(el).find('.result__snippet, .result-snippet, .snippet').text().trim();
    if (url) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) url = decodeURIComponent(match[1]);
      results.push({ title, url, snippet });
    }
  });
  return results;
}

function parseYandex(html) {
  const $ = cheerio.load(html);
  const results = [];
  $('.serp-item, .organic').each((i, el) => {
    const title = $(el).find('.organic__title-wrapper, .serp-item__title').text().trim();
    let url = $(el).find('a').first().attr('href');
    const snippet = $(el).find('.organic__content-wrapper, .serp-item__snippet').text().trim();
    if (url && url.startsWith('http')) {
      results.push({ title, url, snippet });
    }
  });
  return results;
}

/* ─── Dark Web Monitoring (Ahmia) ─── */

async function searchAhmia(query) {
  const results = [];
  try {
    const res = await fetchWithTimeout(
      `https://ahmia.fi/api/v1/search/?q=${encodeURIComponent(query)}`,
      15000
    );
    if (!res.ok) return [];
    const data = await res.json();
    for (const item of (data.results || []).slice(0, 5)) {
      results.push({
        title: item.title || 'Untitled',
        url: item.url || item.bitcoin_address || '',
        snippet: item.description || '',
        source: 'ahmia',
        isOnion: true,
      });
    }
  } catch (e) {
    console.warn('[Crawler] Ahmia search failed:', e.message);
  }
  return results;
}

/* ─── Image Analysis ─── */

function isSuspiciousDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SUSPICIOUS_DOMAINS.some(d => hostname.includes(d));
  } catch { return false; }
}

function extractImagesFromPage(html, baseUrl) {
  const $ = cheerio.load(html);
  const images = [];
  $('img').each((i, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !src.startsWith('data:') && !src.startsWith('blob:') && !src.includes('svg')) {
      try {
        const fullUrl = new URL(src, baseUrl).href;
        if (fullUrl.startsWith('http')) images.push(fullUrl);
      } catch {}
    }
  });
  return images.slice(0, 10);
}

async function analyzeImageFromUrl(url) {
  try {
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    let dimensions = null;
    try { dimensions = sizeOf(buffer); } catch {}
    if (!dimensions) return null;

    const sizeKB = buffer.length / 1024;
    const isSuspicious = (
      (dimensions.width < 100 || dimensions.height < 100) ||
      (sizeKB > 5000) ||
      (dimensions.width > 4000 && dimensions.height > 4000)
    );

    return {
      width: dimensions.width, height: dimensions.height,
      type: dimensions.type, sizeKB: Math.round(sizeKB * 10) / 10,
      suspicious: isSuspicious,
      buffer,
    };
  } catch {
    return null;
  }
}

/* ─── Face Matching Pipeline ─── */

async function matchFaceAgainstEnrolled(imageBuffer, filename, userId) {
  try {
    const faceprints = await table('faceprints');
    const enrolled = await faceprints.filter({ user_id: userId });
    if (!enrolled.length) return null;

    const tempDir = path.join(UPLOAD_DIR, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `match-${Date.now()}-${filename || 'img.jpg'}`);
    fs.writeFileSync(tempPath, imageBuffer);

    let bestMatch = null;
    for (const fp of enrolled) {
      if (!fp.file_path) continue;
      try {
        const result = await mlClient.matchFaces(
          tempPath,
          fp.file_path,
          0.65
        );
        if (result.match) {
          if (!bestMatch || result.similarity > bestMatch.similarity) {
            bestMatch = {
              faceprintId: fp.id,
              similarity: result.similarity,
              distance: result.distance,
            };
          }
        }
      } catch {}
    }

    try { fs.unlinkSync(tempPath); } catch {}
    return bestMatch;
  } catch (e) {
    console.warn('[Crawler] Face match failed:', e.message);
    return null;
  }
}

/* ─── Core Search Logic ─── */

/* Surface-web engine search (DuckDuckGo + Yandex). Exported for monitoring service. */
async function searchWebEngines(userName) {
  const allResults = [];
  const queries = [
    `"${userName}" deepfake OR "face swap" OR impersonation OR "identity theft" OR "unauthorized"`,
    `"${userName}" synthetic OR "AI generated" OR "fake profile" OR morphing`,
    `"${userName}" nonconsensual OR "revenge" OR "sextortion" OR "ncii"`,
  ];

  for (const engine of SEARCH_ENGINES) {
    // Skip engines in block-cooldown (rate limit / CAPTCHA graceful handling)
    const coolUntil = _engineCooldowns.get(engine.name) || 0;
    if (Date.now() < coolUntil) continue;

    for (const q of queries) {
      try {
        const res = await fetchWithTimeout(engine.url(q));
        if (!res.ok) {
          if (res.status === 429) _blockEngine(engine.name, 5 * 60 * 1000);
          continue;
        }
        const html = await res.text();

        // CAPTCHA / anomaly detection
        if (/anomaly|captcha|challenge/i.test(html.slice(0, 3000)) && !html.includes('result__a')) {
          console.warn(`[Crawler] ${engine.name} appears blocked (challenge page) — cooling down`);
          _blockEngine(engine.name, 10 * 60 * 1000);
          continue;
        }

        const results = engine.parser(html);
        if (res.ok && results.length === 0 && html.length > 5000) {
          // Page loaded but zero parsed results may indicate layout change / soft block
          _blockEngine(engine.name, 5 * 60 * 1000);
        }
        for (const r of results) {
          if (!r.url || scannedUrls.has(r.url)) continue;
          scannedUrls.set(r.url, { timestamp: Date.now(), engine: engine.name });

          const suspicious = isSuspiciousDomain(r.url);
          const nameMatch = r.title && r.title.toLowerCase().includes(userName.toLowerCase());
          const snippetMatch = r.snippet && r.snippet.toLowerCase().includes(userName.toLowerCase());

          if (suspicious || nameMatch || snippetMatch) {
            let confidence = 40;
            if (suspicious) confidence += 30;
            if (nameMatch) confidence += 15;
            if (snippetMatch) confidence += 10;
            if (engine.name === 'yandex') confidence += 5; // Yandex has better image indexing

            allResults.push({
              sourceUrl: r.url,
              confidence: Math.min(99, confidence),
              mediaType: 'link',
              matchedOn: [
                suspicious ? 'suspicious domain' : null,
                nameMatch ? 'name in title' : null,
                snippetMatch ? 'name in snippet' : null,
                `engine:${engine.name}`,
              ].filter(Boolean).join('; '),
              notes: `Found via ${engine.name}: ${r.title || r.url}`,
              timestamp: new Date().toISOString(),
              engine: engine.name,
            });
          }
        }
      } catch {}
    }
  }

  return allResults;
}

/* Per-engine block cooldowns (rate-limit/CAPTCHA backoff) */
const _engineCooldowns = new Map();
function _blockEngine(name, ms) {
  _engineCooldowns.set(name, Date.now() + ms);
}

/* Dark web search (Ahmia). Exported for monitoring service. */
async function searchDarkWebSources(userName) {
  const allResults = [];
  for (const kw of DARK_WEB_KEYWORDS) {
    const darkResults = await searchAhmia(`${userName} ${kw}`);
    for (const r of darkResults) {
      if (!r.url || scannedUrls.has(r.url)) continue;
      scannedUrls.set(r.url, { timestamp: Date.now(), engine: 'ahmia' });

      allResults.push({
        sourceUrl: r.url,
        confidence: 70,
        mediaType: 'darkweb',
        matchedOn: `dark web match: ${kw} | source: ahmia`,
        notes: `Found on dark web via Ahmia: ${r.title}`,
        timestamp: new Date().toISOString(),
        engine: 'ahmia',
        isOnion: true,
      });
    }
  }
  return allResults;
}

/* Original combined search (backward compatible) */
async function searchIdentity(userName) {
  const [
    web, dark, reddit, pastebin, fourchan,
    twitter, instagram, tiktok, facebook, youtube, linkedin, pinterest, telegram,
    darkForums, torHidden, darkPaste,
  ] = await Promise.all([
    searchWebEngines(userName),
    searchDarkWebSources(userName),
    searchReddit(userName),
    searchPastebin(userName),
    search4chan(userName),
    searchTwitter(userName),
    searchInstagram(userName),
    searchTikTok(userName),
    searchFacebook(userName),
    searchYouTube(userName),
    searchLinkedIn(userName),
    searchPinterest(userName),
    searchTelegram(userName),
    searchDarkWebForums(userName),
    searchTorHiddenServices(userName),
    searchDarkPasteSites(userName),
  ]);

  const allResults = [...web, ...dark];

  // Helper to add results
  const addResults = (items, engine, mediaType, confidence, formatNote) => {
    for (const r of items) {
      if (!r.url || scannedUrls.has(r.url)) continue;
      scannedUrls.set(r.url, { timestamp: Date.now(), engine });
      allResults.push({
        sourceUrl: r.url,
        confidence,
        mediaType,
        matchedOn: formatNote(r),
        notes: `Found on ${engine}: ${r.title}`,
        timestamp: new Date().toISOString(),
        engine,
      });
    }
  };

  // Social Media
  addResults(reddit, 'reddit', 'social', 55, (r) => `reddit: r/${r.subreddit} | score: ${r.score}`);
  addResults(twitter, 'twitter', 'social', 50, () => 'twitter/x match');
  addResults(instagram, 'instagram', 'social', 50, () => 'instagram match');
  addResults(tiktok, 'tiktok', 'social', 50, () => 'tiktok match');
  addResults(facebook, 'facebook', 'social', 50, () => 'facebook match');
  addResults(youtube, 'youtube', 'video', 55, () => 'youtube match');
  addResults(linkedin, 'linkedin', 'social', 45, () => 'linkedin match');
  addResults(pinterest, 'pinterest', 'image', 45, () => 'pinterest match');
  addResults(telegram, 'telegram', 'social', 55, () => 'telegram match');

  // Paste Sites
  addResults(pastebin, 'pastebin', 'paste', 50, () => 'pastebin match');

  // Forums
  addResults(fourchan, '4chan', 'forum', 60, (r) => `4chan: /${r.board}/`);

  // Dark Web
  addResults(darkForums, 'dark-forum', 'darkweb', 65, (r) => `dark web forum: ${r.source}`);
  addResults(torHidden, 'ahmia-tor', 'darkweb', 70, () => 'tor hidden service');
  addResults(darkPaste, 'dark-paste', 'paste', 55, (r) => `dark paste: ${r.source}`);

  return allResults;
}

async function deepAnalyzeResult(result, userId) {
  if (result.mediaType === 'darkweb') return result;

  try {
    const pageRes = await fetchWithTimeout(result.sourceUrl, 8000);
    if (!pageRes.ok) return result;
    const pageHtml = await pageRes.text();
    const images = extractImagesFromPage(pageHtml, result.sourceUrl);

    if (images.length > 0) {
      const imgAnalysis = await analyzeImageFromUrl(images[0]);
      if (imgAnalysis) {
        result.imageAnalysis = {
          width: imgAnalysis.width,
          height: imgAnalysis.height,
          sizeKB: imgAnalysis.sizeKB,
          suspicious: imgAnalysis.suspicious,
        };

        if (imgAnalysis.buffer) {
          const faceMatch = await matchFaceAgainstEnrolled(
            imgAnalysis.buffer,
            'scan-result.jpg',
            userId
          );
          if (faceMatch) {
            result.faceMatch = faceMatch;
            result.confidence = Math.min(99, result.confidence + 25);
            result.matchedOn += ` | face match: ${faceMatch.similarity} similarity`;
          }
        }

        if (imgAnalysis.suspicious) {
          result.confidence = Math.min(99, result.confidence + 15);
          result.matchedOn += ' | suspicious image characteristics';
        }
      }
    }
  } catch {}

  return result;
}

async function scanCycle(userId, userName) {
  const results = [];
  try {
    const searchResults = await searchIdentity(userName);

    // Deep analyze top results
    for (const r of searchResults.slice(0, 8)) {
      const analyzed = await deepAnalyzeResult(r, userId);
      results.push(analyzed);
    }
  } catch (e) {
    console.error('[Crawler] Scan cycle error:', e.message);
  }

  // Create alerts
  const alertsTbl = await table('alerts');
  const users = await table('users');
  const user = await users.find({ id: userId });
  const now = new Date().toISOString();
  let newAlertCount = 0;

  for (const r of results) {
    const existingAlerts = await alertsTbl.filter({ source_url: r.sourceUrl, user_id: userId });
    if (existingAlerts.length > 0) continue;

    const alertData = {
      id: uuidv4(),
      user_id: userId,
      source_url: r.sourceUrl,
      confidence: parseFloat(r.confidence.toFixed(1)),
      status: 'PENDING_REVIEW',
      media_type: r.mediaType || 'link',
      matched_on: r.matchedOn || 'similarity match',
      notes: r.notes || '',
      timestamp: r.timestamp,
      created_at: now,
    };
    await alertsTbl.insert(alertData);
    newAlertCount++;

    // Send notification for high-confidence alerts
    if (r.confidence >= 50 && user) {
      try {
        await notifications.notifyNewAlert(user, alertData);
      } catch (e) {
        console.warn('[Crawler] Notification failed:', e.message);
      }
    }
  }

  if (newAlertCount > 0) {
    console.log(`[Crawler] Scan complete: ${newAlertCount} new alert(s) for ${userName}`);
  }

  return results;
}

/* ─── Session Management ─── */

async function startSession(userId) {
  if (activeSessions.has(userId)) return activeSessions.get(userId);

  const sessionId = uuidv4();
  const sessionsTbl = await table('scan_sessions');
  await sessionsTbl.insert({
    id: sessionId, user_id: userId, status: 'active',
    started_at: new Date().toISOString()
  });

  const users = await table('users');
  const user = await users.find({ id: userId });
  const userName = user ? user.full_name : 'unknown';

  let running = true;
  let currentTimeout = null;
  let cycleCount = 0;

  async function runCycle() {
    if (!running) return;
    cycleCount++;
    try {
      await scanCycle(userId, userName);
    } catch (e) {
      console.error('[Crawler] Scan cycle error:', e.message);
    }
    if (running) {
      // First few cycles: shorter interval; after that, longer (hourly)
      const interval = cycleCount < 3
        ? 30000 + Math.random() * 30000   // 30-60s for first 3 cycles
        : 3600000 + Math.random() * 1800000; // 1-1.5 hours after that
      currentTimeout = setTimeout(runCycle, interval);
    }
  }

  currentTimeout = setTimeout(runCycle, 3000);

  const session = {
    sessionId,
    running: () => running,
    stop: () => {
      running = false;
      if (currentTimeout) clearTimeout(currentTimeout);
    }
  };
  activeSessions.set(userId, session);
  return session;
}

async function stopSession(userId) {
  const session = activeSessions.get(userId);
  if (session) {
    session.stop();
    const sessionsTbl = await table('scan_sessions');
    await sessionsTbl.update(
      { id: session.sessionId },
      { status: 'completed', completed_at: new Date().toISOString() }
    );
    activeSessions.delete(userId);
    return true;
  }
  return false;
}

function getSessionStatus(userId) {
  const session = activeSessions.get(userId);
  return session
    ? { active: true, sessionId: session.sessionId }
    : { active: false };
}

module.exports = {
  startSession,
  stopSession,
  getSessionStatus,
  scanCycle,
  searchIdentity,
  searchWebEngines,
  searchDarkWebSources,
  deepAnalyzeResult,
  searchAhmia,
};
