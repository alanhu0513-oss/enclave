#!/usr/bin/env node
/* ─── Stripe Setup Script ───
 * Creates Enclave products + monthly prices in your Stripe account,
 * then prints the env vars to paste into backend/.env (or Render dashboard).
 *
 * Usage:
 *   1. Put STRIPE_SECRET_KEY=sk_live_... or sk_test_... in backend/.env
 *   2. cd backend && node scripts/setup-stripe.js
 */

require('dotenv').config();

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !key.startsWith('sk_')) {
  console.error('✗ Set STRIPE_SECRET_KEY=sk_... in backend/.env first.');
  console.error('  Get keys at: https://dashboard.stripe.com/apikeys');
  process.exit(1);
}

let stripe;
try {
  stripe = require('stripe')(key);
} catch (_) {
  console.error('✗ stripe package not installed. Run: cd backend && npm install stripe');
  process.exit(1);
}

const TIERS = [
  {
    id: 'detection_only',
    name: 'Enclave — Detection Only',
    description: 'Unlimited AI deepfake detection for image, audio, and text. No monitoring.',
    price: 499,
  },
  {
    id: 'pro',
    name: 'Enclave — Individual Pro',
    description: '50 scans/month, hourly surface monitoring, 2 takedowns with evidence chain and verification re-crawls.',
    price: 999,
  },
  {
    id: 'shield',
    name: 'Enclave — Family',
    description: '200 scans/month for up to 5 members, dark web monitoring, 10 takedowns/month.',
    price: 1999,
  },
  {
    id: 'business',
    name: 'Enclave — Business',
    description: 'Unlimited scans for 10 seats, 15-minute real-time monitoring, unlimited takedowns, API access.',
    price: 4999,
  },
];

async function findExistingPrice(productId) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
  return prices.data.find((p) => p.recurring?.interval === 'month') || null;
}

async function findProductByName(name) {
  const products = await stripe.products.search({ query: `name:"${name}"`, limit: 5 });
  return products.data[0] || null;
}

(async () => {
  const live = key.startsWith('sk_live');
  console.log(`\nStripe setup (${live ? 'LIVE' : 'TEST'} mode)\n`);

  const results = {};
  for (const tier of TIERS) {
    try {
      let product = await findProductByName(tier.name);
      if (!product) {
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: { enclave_tier: tier.id },
        });
        console.log(`✓ created product  ${tier.name}  (${product.id})`);
      } else {
        console.log(`• product exists   ${tier.name}  (${product.id})`);
      }

      let price = await findExistingPrice(product.id);
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: tier.price,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { enclave_tier: tier.id },
        });
        console.log(`✓ created price    $${(tier.price / 100).toFixed(2)}/mo  (${price.id})`);
      } else {
        console.log(`• price exists     $${(price.unit_amount / 100).toFixed(2)}/mo  (${price.id})`);
      }

      const envName = 'STRIPE_PRICE_' + tier.id.toUpperCase();
      results[envName] = price.id;
    } catch (e) {
      console.error(`✗ ${tier.name}: ${e.message}`);
    }
  }

  console.log('\n── Paste these into backend/.env (and Render dashboard if deployed) ──\n');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}=${v}`);
  }
  console.log('\nThen restart the backend. Checkout will switch from mock to live.\n');
})();
