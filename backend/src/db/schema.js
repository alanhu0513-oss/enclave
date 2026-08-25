const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email_notifications INTEGER DEFAULT 1,
  fcm_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faceprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sha256_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voiceprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  bins INTEGER NOT NULL DEFAULT 64,
  sample_rate INTEGER NOT NULL DEFAULT 44100,
  fft_size INTEGER NOT NULL DEFAULT 128,
  frames INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 10000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  media_type TEXT NOT NULL DEFAULT 'image',
  matched_on TEXT,
  notes TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  succeeded INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS takedowns (
  id TEXT PRIMARY KEY,
  alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'dmca',
  platform TEXT NOT NULL,
  abuse_email TEXT,
  pdf_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  acknowledged_at TEXT,
  removed_at TEXT,
  escalated_at TEXT,
  escalated_notes TEXT,
  follow_up_at TEXT,
  evidence_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  scans INTEGER DEFAULT 0,
  alerts INTEGER DEFAULT 0,
  takedowns INTEGER DEFAULT 0,
  deep_scans INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  referral_count INTEGER DEFAULT 0,
  reward_claimed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_digests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'weekly',
  threats_included INTEGER DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threat_shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ioc_type TEXT NOT NULL,
  ioc_value TEXT NOT NULL,
  source_alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence REAL DEFAULT 0.5,
  description TEXT,
  tags TEXT DEFAULT '[]',
  community_votes INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS threat_votes (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES threat_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL DEFAULT 'confirm',
  removed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anonymous_handle TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  reply_to TEXT REFERENCES forum_posts(id) ON DELETE SET NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS forum_votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  removed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS otdb_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'free',
  requests_today INTEGER DEFAULT 0,
  last_reset TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  active INTEGER DEFAULT 1,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS white_label (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sso_configurations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  metadata_url TEXT,
  entity_id TEXT,
  sso_url TEXT,
  certificate TEXT,
  enabled INTEGER DEFAULT 1,
  auto_provision INTEGER DEFAULT 1,
  default_role TEXT DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sso_states (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES sso_configurations(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  nonce TEXT,
  redirect_uri TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  date_range TEXT DEFAULT '{}',
  data_json TEXT DEFAULT '{}',
  format TEXT DEFAULT 'pdf',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time TEXT DEFAULT '09:00',
  date_range TEXT DEFAULT '{}',
  filters TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  partner_code TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'pending',
  total_referrals INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  revenue_owed REAL DEFAULT 0,
  revenue_paid REAL DEFAULT 0,
  expected_referrals INTEGER DEFAULT 0,
  integration_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS partner_conversions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referred_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  amount REAL DEFAULT 0,
  revenue_share REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_user ON auth_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_faceprints_user ON faceprints(user_id);
CREATE INDEX IF NOT EXISTS idx_voiceprints_user ON voiceprints(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_takedowns_user ON takedowns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_takedowns_alert ON takedowns(alert_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON usage_tracking(user_id, month);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_user ON referral_redemptions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_threat_shares_type ON threat_shares(ioc_type, severity);
CREATE INDEX IF NOT EXISTS idx_threat_shares_value ON threat_shares(ioc_value);
CREATE INDEX IF NOT EXISTS idx_threat_votes_share ON threat_votes(share_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_reply ON forum_posts(reply_to);
CREATE INDEX IF NOT EXISTS idx_forum_votes_post ON forum_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_otdb_api_keys_key ON otdb_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id, active);
CREATE INDEX IF NOT EXISTS idx_white_label_user ON white_label(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_configs_user ON sso_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_states_config ON sso_states(config_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_conversions_partner ON partner_conversions(partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

module.exports = { SCHEMA };
