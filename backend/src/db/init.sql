-- Enclave PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT NOT NULL,
  provider TEXT DEFAULT 'email',
  provider_id TEXT,
  avatar_url TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  fcm_token TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'none',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_current_period_end TIMESTAMP WITH TIME ZONE,
  token_version INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Migration for existing installs
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS faceprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  width INTEGER DEFAULT 64,
  height INTEGER DEFAULT 48,
  sha256_hash TEXT,
  embedding_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voiceprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL DEFAULT '[]',
  variance_json TEXT DEFAULT '[]',
  bins INTEGER DEFAULT 64,
  sample_rate INTEGER DEFAULT 44100,
  fft_size INTEGER DEFAULT 128,
  frames INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  media_type TEXT NOT NULL DEFAULT 'image',
  matched_on TEXT,
  notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  succeeded INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
  sent_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  removed_at TIMESTAMP WITH TIME ZONE,
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalated_notes TEXT,
  follow_up_at TIMESTAMP WITH TIME ZONE,
  evidence_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  referral_count INTEGER DEFAULT 0,
  reward_claimed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  profile TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_digests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'weekly',
  threats_included INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
  verified BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS threat_votes (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES threat_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL DEFAULT 'confirm',
  removed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
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
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS forum_votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  removed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS otdb_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'free',
  requests_today INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS white_label (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
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
  enabled BOOLEAN DEFAULT TRUE,
  auto_provision BOOLEAN DEFAULT TRUE,
  default_role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sso_states (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES sso_configurations(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  nonce TEXT,
  redirect_uri TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  date_range TEXT DEFAULT '{}',
  data_json TEXT DEFAULT '{}',
  format TEXT DEFAULT 'pdf',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time TEXT DEFAULT '09:00',
  date_range TEXT DEFAULT '{}',
  filters TEXT DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT FALSE,
  schedule TEXT DEFAULT 'daily',
  sources TEXT DEFAULT '[]',
  last_scan_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  total_findings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS partner_conversions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referred_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  amount REAL DEFAULT 0,
  revenue_share REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_user ON auth_attempts(user_id);
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

-- Migrations for Google Sign-In support
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'email';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN provider_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN avatar_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Migration: Add variance_json to voiceprints
DO $$ BEGIN
  ALTER TABLE voiceprints ADD COLUMN variance_json TEXT DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migration: Add monitoring_state table
CREATE TABLE IF NOT EXISTS monitoring_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT FALSE,
  schedule TEXT DEFAULT 'daily',
  sources TEXT DEFAULT '[]',
  last_scan_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  total_findings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Migration: Add billing columns to users table
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migration: Add embedding_json to faceprints
DO $$ BEGIN
  ALTER TABLE faceprints ADD COLUMN embedding_json TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migration: Add sources_health to monitoring_state
DO $$ BEGIN
  ALTER TABLE monitoring_state ADD COLUMN sources_health TEXT DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Phase 1: Missing tables for old-pattern routes
-- ═══════════════════════════════════════════════════════════════

-- API Platform
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  permissions TEXT DEFAULT '["read"]',
  rate_limit INTEGER DEFAULT 100,
  total_requests INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id TEXT,
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ML Model Registry
CREATE TABLE IF NOT EXISTS ml_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  accuracy REAL,
  precision_score REAL,
  recall_score REAL,
  f1_score REAL,
  trained_at TIMESTAMP WITH TIME ZONE,
  deployed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft',
  dataset TEXT,
  parameters TEXT,
  inference_time TEXT,
  model_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ml_benchmarks (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
  dataset TEXT NOT NULL,
  samples INTEGER,
  accuracy REAL,
  precision_score REAL,
  recall_score REAL,
  f1_score REAL,
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model_a TEXT NOT NULL,
  model_b TEXT NOT NULL,
  traffic_split INTEGER DEFAULT 50,
  status TEXT DEFAULT 'running',
  results TEXT DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Bounty System
CREATE TABLE IF NOT EXISTS bounty_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  face_images TEXT DEFAULT '[]',
  bounty_amount REAL DEFAULT 10,
  status TEXT DEFAULT 'active',
  total_paid REAL DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS hunter_scans (
  id TEXT PRIMARY KEY,
  hunter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  source_url TEXT DEFAULT '',
  matches INTEGER DEFAULT 0,
  candidates TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  confirmed_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  payout REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insurance
CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  coverage_amount REAL DEFAULT 0,
  monthly_price REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id TEXT REFERENCES insurance_policies(id) ON DELETE SET NULL,
  alert_id TEXT,
  scan_id TEXT,
  type TEXT DEFAULT 'deepfake',
  description TEXT,
  damages REAL DEFAULT 0,
  evidence_urls TEXT DEFAULT '[]',
  image_url TEXT,
  source TEXT,
  source_url TEXT,
  confidence REAL,
  bounty_amount REAL,
  coverage_amount REAL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Estate (Digital Legacy)
CREATE TABLE IF NOT EXISTS estate_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deceased_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  date_of_death TEXT,
  email TEXT,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  monitoring_enabled BOOLEAN DEFAULT TRUE,
  takedowns_authorized BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estate_takedowns (
  id TEXT PRIMARY KEY,
  estate_id TEXT NOT NULL REFERENCES estate_profiles(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deceased_name TEXT,
  url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'dmca',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memorial_requests (
  id TEXT PRIMARY KEY,
  estate_id TEXT NOT NULL REFERENCES estate_profiles(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'facebook',
  profile_url TEXT DEFAULT '',
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Education
CREATE TABLE IF NOT EXISTS tutorial_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tutorial_id TEXT NOT NULL,
  score INTEGER,
  passed BOOLEAN DEFAULT FALSE,
  answers TEXT DEFAULT '[]',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education_tutorials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty TEXT DEFAULT 'beginner',
  duration TEXT,
  content TEXT,
  steps TEXT DEFAULT '[]',
  quiz TEXT DEFAULT '{}',
  completions INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS education_certs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT,
  requirements TEXT DEFAULT '[]',
  tutorials TEXT DEFAULT '[]',
  badge TEXT,
  holders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  author TEXT,
  date TEXT,
  read_time TEXT,
  category TEXT,
  featured BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Bug Bounty
CREATE TABLE IF NOT EXISTS bug_bounty_vulns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  cvss REAL,
  status TEXT DEFAULT 'submitted',
  reporter TEXT,
  reported_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  bounty REAL DEFAULT 0,
  description TEXT,
  impact TEXT,
  remediation TEXT,
  proof_of_concept TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bug_bounty_leaderboard (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  reports INTEGER DEFAULT 0,
  resolved INTEGER DEFAULT 0,
  earned REAL DEFAULT 0,
  rank INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Threat Intel (per-user persistent IOCs)
CREATE TABLE IF NOT EXISTS ioc_indicators (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  threat TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  confidence REAL DEFAULT 0.5,
  reports INTEGER DEFAULT 1,
  region TEXT DEFAULT 'GLOBAL',
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reporter TEXT,
  verified BOOLEAN DEFAULT FALSE,
  reported_by TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Shield Stats (persistent)
CREATE TABLE IF NOT EXISTS shield_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  images_scanned INTEGER DEFAULT 0,
  deepfakes_detected INTEGER DEFAULT 0,
  deepfakes_found INTEGER DEFAULT 0,
  watermarks_embedded INTEGER DEFAULT 0,
  c2pa_credentials_embedded INTEGER DEFAULT 0,
  voice_enrollments INTEGER DEFAULT 0,
  voice_verifications INTEGER DEFAULT 0,
  voice_matches INTEGER DEFAULT 0,
  voice_rejections INTEGER DEFAULT 0,
  takedowns_initiated INTEGER DEFAULT 0,
  takedowns_completed INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  threats_blocked INTEGER DEFAULT 0,
  crawler_runs INTEGER DEFAULT 0,
  urls_scanned INTEGER DEFAULT 0,
  face_matches INTEGER DEFAULT 0,
  sessions_protected INTEGER DEFAULT 0,
  shield_activations INTEGER DEFAULT 0,
  first_activated_at TIMESTAMP WITH TIME ZONE,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  last_detection_at TIMESTAMP WITH TIME ZONE,
  last_takedown_at TIMESTAMP WITH TIME ZONE,
  recent_activity TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Voice Clone Analysis Results
CREATE TABLE IF NOT EXISTS voice_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT,
  file_size INTEGER,
  format TEXT,
  is_clone BOOLEAN DEFAULT FALSE,
  clone_score REAL DEFAULT 0,
  breathing_score REAL DEFAULT 0,
  spectral_score REAL DEFAULT 0,
  result_json TEXT DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insurance Plans (configurable)
CREATE TABLE IF NOT EXISTS insurance_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price REAL NOT NULL,
  coverage_amount REAL NOT NULL,
  features TEXT DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes for new tables
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage_logs(key_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON ml_models(type, status);
CREATE INDEX IF NOT EXISTS idx_ml_benchmarks_model ON ml_benchmarks(model_id);
CREATE INDEX IF NOT EXISTS idx_bounty_profiles_user ON bounty_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_bounty_profiles_status ON bounty_profiles(status);
CREATE INDEX IF NOT EXISTS idx_hunter_scans_hunter ON hunter_scans(hunter_id);
CREATE INDEX IF NOT EXISTS idx_hunter_scans_status ON hunter_scans(status);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_user ON insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_user ON insurance_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_estate_profiles_owner ON estate_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_estate_takedowns_estate ON estate_takedowns(estate_id);
CREATE INDEX IF NOT EXISTS idx_memorial_requests_estate ON memorial_requests(estate_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_completions_user ON tutorial_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_completions_tutorial ON tutorial_completions(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_education_tutorials_category ON education_tutorials(category, difficulty);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category, published_at);
CREATE INDEX IF NOT EXISTS idx_bug_bounty_vulns_severity ON bug_bounty_vulns(severity, status);
CREATE INDEX IF NOT EXISTS idx_bug_bounty_leaderboard_user ON bug_bounty_leaderboard(user_id);
CREATE INDEX IF NOT EXISTS idx_ioc_indicators_type ON ioc_indicators(type, severity);
CREATE INDEX IF NOT EXISTS idx_ioc_indicators_value ON ioc_indicators(value);
CREATE INDEX IF NOT EXISTS idx_ioc_indicators_user ON ioc_indicators(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_analyses_user ON voice_analyses(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_active ON insurance_plans(active);

-- Identity Passports
CREATE TABLE IF NOT EXISTS identity_passports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holder_name TEXT,
  email TEXT,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN DEFAULT TRUE,
  verification_level TEXT DEFAULT 'standard',
  public_key TEXT,
  biometric_hash TEXT,
  qr_code TEXT,
  status TEXT DEFAULT 'active',
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_passports_user ON identity_passports(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_passports_status ON identity_passports(status);
