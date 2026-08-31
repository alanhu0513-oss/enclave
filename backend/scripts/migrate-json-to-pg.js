#!/usr/bin/env node
/**
 * Data Migration Script: JSON → PostgreSQL
 * 
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate-json-to-pg.js [--dry-run] [--file=path/to/enclave.json]
 * 
 * This script reads the legacy JSON database and inserts all records into PostgreSQL
 * using the adapter layer. It handles field name mapping (camelCase → snake_case)
 * and skips records that already exist (by id).
 */

const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find(a => a.startsWith('--file='));
const jsonPath = fileArg
  ? fileArg.split('=')[1]
  : process.env.DATABASE_PATH || path.join(__dirname, '../data/enclave.json');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL required. Usage: DATABASE_URL=postgresql://... node scripts/migrate-json-to-pg.js');
  process.exit(1);
}

// Field mapping: camelCase (JSON) → snake_case (PG)
const FIELD_MAP = {
  // Common
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // Alerts
  sourceUrl: 'source_url',
  mediaType: 'media_type',
  matchedOn: 'matched_on',
  // Users
  fullName: 'full_name',
  avatarUrl: 'avatar_url',
  tokenVersion: 'token_version',
  emailNotifications: 'email_notifications',
  fcmToken: 'fcm_token',
  subscriptionTier: 'subscription_tier',
  subscriptionStatus: 'subscription_status',
  stripeCustomerId: 'stripe_customer_id',
  stripeSubscriptionId: 'stripe_subscription_id',
  subscriptionCurrentPeriodEnd: 'subscription_current_period_end',
  // Biometrics
  filePath: 'file_path',
  sha256Hash: 'sha256_hash',
  embeddingJson: 'embedding_json',
  profileJson: 'profile_json',
  varianceJson: 'variance_json',
  sampleRate: 'sample_rate',
  fftSize: 'fft_size',
  durationMs: 'duration_ms',
  // Takedowns
  abuseEmail: 'abuse_email',
  pdfPath: 'pdf_path',
  sentAt: 'sent_at',
  acknowledgedAt: 'acknowledged_at',
  removedAt: 'removed_at',
  escalatedAt: 'escalated_at',
  escalatedNotes: 'escalated_notes',
  followUpAt: 'follow_up_at',
  evidencePath: 'evidence_path',
  // Usage
  deepScans: 'deep_scans',
  apiCalls: 'api_calls',
  // Referrals
  referrerId: 'referrer_id',
  referralCount: 'referral_count',
  rewardClaimed: 'reward_claimed',
  referredUserId: 'referred_user_id',
  // Family
  ownerId: 'owner_id',
  memberEmail: 'member_email',
  memberName: 'member_name',
  // Threat shares
  iocType: 'ioc_type',
  iocValue: 'ioc_value',
  sourceAlertId: 'source_alert_id',
  communityVotes: 'community_votes',
  lastSeenAt: 'last_seen_at',
  // Forum
  anonymousHandle: 'anonymous_handle',
  replyTo: 'reply_to',
  upvotes: 'upvotes',
  downvotes: 'downvotes',
  pinned: 'pinned',
  postId: 'post_id',
  voteType: 'vote_type',
  // OTDB
  apiKey: 'api_key',
  requestsToday: 'requests_today',
  lastReset: 'last_reset',
  // Webhooks
  failureCount: 'failure_count',
  lastTriggeredAt: 'last_triggered_at',
  // SSO
  configId: 'config_id',
  redirectUri: 'redirect_uri',
  expiresAt: 'expires_at',
  // Reports
  reportType: 'report_type',
  dateRange: 'date_range',
  dataJson: 'data_json',
  // Report schedules
  lastRun: 'last_run',
  nextRun: 'next_run',
  // Partners
  companyName: 'company_name',
  partnerCode: 'partner_code',
  totalReferrals: 'total_referrals',
  totalRevenue: 'total_revenue',
  revenueOwed: 'revenue_owed',
  revenuePaid: 'revenue_paid',
  expectedReferrals: 'expected_referrals',
  integrationType: 'integration_type',
  referredUserId: 'referred_user_id',
  revenueShare: 'revenue_share',
  // API Platform
  keyId: 'key_id',
  rateLimit: 'rate_limit',
  totalRequests: 'total_requests',
  lastUsedAt: 'last_used_at',
  statusCode: 'status_code',
  latencyMs: 'latency_ms',
  // Bounty
  bountyAmount: 'bounty_amount',
  totalPaid: 'total_paid',
  totalMatches: 'total_matches',
  faceImages: 'face_images',
  hunterId: 'hunter_id',
  imageUrl: 'image_url',
  sourceUrl: 'source_url',
  confirmedAt: 'confirmed_at',
  rejectedAt: 'rejected_at',
  // Insurance
  planId: 'plan_id',
  coverageAmount: 'coverage_amount',
  monthlyPrice: 'monthly_price',
  policyId: 'policy_id',
  evidenceUrls: 'evidence_urls',
  // Estate
  ownerUserId: 'owner_user_id',
  deceasedName: 'deceased_name',
  dateOfDeath: 'date_of_death',
  monitoringEnabled: 'monitoring_enabled',
  takedownsAuthorized: 'takedowns_authorized',
  profileUrl: 'profile_url',
  // Education
  tutorialId: 'tutorial_id',
  completedAt: 'completed_at',
  // ML
  precisionScore: 'precision_score',
  recallScore: 'recall_score',
  f1Score: 'f1_score',
  trainedAt: 'trained_at',
  deployedAt: 'deployed_at',
  modelPath: 'model_path',
  inferenceTime: 'inference_time',
  // Bug bounty
  reportedAt: 'reported_at',
  resolvedAt: 'resolved_at',
  proofOfConcept: 'proof_of_concept',
  // Threat intel
  firstSeen: 'first_seen',
  lastSeen: 'last_seen',
  reportedBy: 'reported_by',
  // Passport
  holderName: 'holder_name',
  enrolledAt: 'enrolled_at',
  verificationLevel: 'verification_level',
  publicKey: 'public_key',
  biometricHash: 'biometric_hash',
  qrCode: 'qr_code',
  revokedAt: 'revoked_at',
  // Insurance plans
  monthly_price: 'monthly_price',
  coverage_amount: 'coverage_amount',
};

// Table name mapping: JSON collection name → PG table name
const TABLE_MAP = {
  users: 'users',
  faceprints: 'faceprints',
  voiceprints: 'voiceprints',
  signatures: 'signatures',
  alerts: 'alerts',
  documents: 'documents',
  auth_attempts: 'auth_attempts',
  scan_sessions: 'scan_sessions',
  notifications: 'notifications',
  takedowns: 'takedowns',
  usage_tracking: 'usage_tracking',
  referrals: 'referrals',
  referral_redemptions: 'referral_redemptions',
  family_members: 'family_members',
  email_digests: 'email_digests',
  threat_shares: 'threat_shares',
  threat_votes: 'threat_votes',
  forum_posts: 'forum_posts',
  forum_votes: 'forum_votes',
  otdb_api_keys: 'otdb_api_keys',
  webhooks: 'webhooks',
  white_label: 'white_label',
  sso_configurations: 'sso_configurations',
  sso_states: 'sso_states',
  reports: 'reports',
  report_schedules: 'report_schedules',
  monitoring_state: 'monitoring_state',
  partners: 'partners',
  partner_conversions: 'partner_conversions',
  // New tables (migrated from old pattern)
  api_keys: 'api_keys',
  api_usage_logs: 'api_usage_logs',
  audit_logs: 'audit_logs',
  ml_models: 'ml_models',
  ml_benchmarks: 'ml_benchmarks',
  ab_tests: 'ab_tests',
  bounty_profiles: 'bounty_profiles',
  hunter_scans: 'hunter_scans',
  insurance_policies: 'insurance_policies',
  insurance_claims: 'insurance_claims',
  estate_profiles: 'estate_profiles',
  estate_takedowns: 'estate_takedowns',
  memorial_requests: 'memorial_requests',
  tutorial_completions: 'tutorial_completions',
  identity_passports: 'identity_passports',
  ioc_indicators: 'ioc_indicators',
  voice_analyses: 'voice_analyses',
  shield_stats: 'shield_stats',
  insurance_plans: 'insurance_plans',
  education_tutorials: 'education_tutorials',
  education_certs: 'education_certs',
  blog_posts: 'blog_posts',
  bug_bounty_vulns: 'bug_bounty_vulns',
  bug_bounty_leaderboard: 'bug_bounty_leaderboard',
};

function mapFields(record) {
  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    const pgKey = FIELD_MAP[key] || key;
    // Convert objects/arrays to JSON strings for JSONB/TEXT columns
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      mapped[pgKey] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      mapped[pgKey] = JSON.stringify(value);
    } else {
      mapped[pgKey] = value;
    }
  }
  return mapped;
}

async function migrate() {
  console.log(`\n🔧 JSON → PostgreSQL Migration`);
  console.log(`   Source: ${jsonPath}`);
  console.log(`   Target: ${process.env.DATABASE_URL.replace(/:([^@]+)@/, ':***@')}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Read JSON file
  if (!fs.existsSync(jsonPath)) {
    console.log(`⚠️  JSON file not found: ${jsonPath}`);
    console.log('   Nothing to migrate.');
    process.exit(0);
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const collections = Object.keys(jsonData).filter(k => Array.isArray(jsonData[k]));

  console.log(`📦 Found ${collections.length} collections in JSON file:\n`);

  let totalRecords = 0;
  for (const coll of collections) {
    const records = jsonData[coll];
    const table = TABLE_MAP[coll];
    console.log(`   ${coll} → ${table || '???'} (${records.length} records)`);
    totalRecords += records.length;
  }

  console.log(`\n📊 Total: ${totalRecords} records across ${collections.length} collections\n`);

  if (dryRun) {
    console.log('🔍 Dry run complete. No data was written.');
    process.exit(0);
  }

  // Connect to PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');
  } catch (e) {
    console.error(`❌ Failed to connect: ${e.message}`);
    process.exit(1);
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const coll of collections) {
    const table = TABLE_MAP[coll];
    if (!table) {
      console.log(`⚠️  Skipping "${coll}" — no table mapping`);
      skipped += jsonData[coll].length;
      continue;
    }

    const records = jsonData[coll];
    if (records.length === 0) continue;

    for (const record of records) {
      try {
        const mapped = mapFields(record);
        const keys = Object.keys(mapped);
        const values = Object.values(mapped);
        const placeholders = keys.map((_, i) => `$${i + 1}`);

        // Check if record already exists
        const checkResult = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [record.id]);
        if (checkResult.rows.length > 0) {
          skipped++;
          continue;
        }

        await pool.query(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`,
          values
        );
        migrated++;
      } catch (e) {
        errors++;
        if (errors <= 5) {
          console.log(`   ⚠️  Error migrating ${coll}/${record.id}: ${e.message}`);
        }
      }
    }

    console.log(`✅ ${coll}: ${records.length} records processed`);
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped (already exist): ${skipped}`);
  console.log(`   Errors: ${errors}`);

  await pool.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
