/**
 * White-Label Service
 * Custom branding, domain, logo, and theme for enterprise customers.
 */

const { v4: uuidv4 } = require('uuid');
const { table } = require('../db/query');

const DEFAULT_BRANDING = {
  companyName: 'Enclave Vault',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#00ff88',
  secondaryColor: '#00ccff',
  backgroundColor: '#0a0a0a',
  textColor: '#e0e0e0',
  fontFamily: '-apple-system, Helvetica, Arial, sans-serif',
  customCss: null,
  customDomain: null,
  loginSubtitle: 'Digital Identity Protection Vault',
  emailFromName: 'Enclave Vault',
  emailFromAddress: null,
  footerText: 'Powered by Enclave Vault',
  termsUrl: null,
  privacyUrl: null,
  supportUrl: null,
  socialLinks: { twitter: null, github: null, linkedin: null }
};

async function getBranding(userId) {
  try {
    const branding = await table('white_label');
    const existing = await branding.find({ user_id: userId });
    if (!existing) return { ...DEFAULT_BRANDING, configured: false };

    return {
      ...DEFAULT_BRANDING,
      ...JSON.parse(existing.config_json || '{}'),
      id: existing.id,
      configured: true,
      createdAt: existing.created_at
    };
  } catch (e) {
    return { ...DEFAULT_BRANDING, configured: false };
  }
}

async function updateBranding(userId, updates) {
  if (!updates || Object.keys(updates).length === 0) {
    return { success: false, reason: 'no_updates' };
  }

  // Validate colors
  const colorFields = ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor'];
  for (const field of colorFields) {
    if (updates[field] && !/^#[0-9a-fA-F]{3,8}$/.test(updates[field])) {
      return { success: false, reason: `invalid_color: ${field}` };
    }
  }

  // Validate URL fields
  const urlFields = ['logoUrl', 'faviconUrl', 'termsUrl', 'privacyUrl', 'supportUrl'];
  for (const field of urlFields) {
    if (updates[field]) {
      try { new URL(updates[field]); } catch (e) {
        return { success: false, reason: `invalid_url: ${field}` };
      }
    }
  }

  // Validate custom domain
  if (updates.customDomain) {
    const domain = updates.customDomain.toLowerCase().trim();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain)) {
      return { success: false, reason: 'invalid_domain' };
    }
    updates.customDomain = domain;
  }

  const branding = await table('white_label');
  const existing = await branding.find({ user_id: userId });
  const current = existing ? JSON.parse(existing.config_json || '{}') : {};
  const merged = { ...current, ...updates };

  if (existing) {
    await branding.update({ id: existing.id }, {
      config_json: JSON.stringify(merged),
      updated_at: new Date().toISOString()
    });
  } else {
    await branding.insert({
      id: uuidv4(),
      user_id: userId,
      config_json: JSON.stringify(merged),
      created_at: new Date().toISOString()
    });
  }

  return { success: true, branding: { ...DEFAULT_BRANDING, ...merged } };
}

async function getBrandingForDomain(domain) {
  try {
    const branding = await table('white_label');
    const all = await branding.all();
    const list = Array.isArray(all) ? all : all ? [all] : [];

    for (const entry of list) {
      const config = JSON.parse(entry.config_json || '{}');
      if (config.customDomain === domain.toLowerCase()) {
        return { ...DEFAULT_BRANDING, ...config, userId: entry.user_id };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function generateCSS(branding) {
  const b = { ...DEFAULT_BRANDING, ...branding };
  return `
:root {
  --enclave-primary: ${b.primaryColor};
  --enclave-secondary: ${b.secondaryColor};
  --enclave-bg: ${b.backgroundColor};
  --enclave-text: ${b.textColor};
  --enclave-font: ${b.fontFamily};
}
body {
  background: var(--enclave-bg);
  color: var(--enclave-text);
  font-family: var(--enclave-font);
}
.enclave-brand-logo { content: url('${b.logoUrl || '/assets/logo.svg'}'); }
.enclave-brand-name::after { content: '${b.companyName}'; }
.enclave-login-subtitle::after { content: '${b.loginSubtitle}'; }
.enclave-footer::after { content: '${b.footerText}'; }
button, .btn-primary { background: var(--enclave-primary); color: var(--enclave-bg); }
a, .link { color: var(--enclave-secondary); }
${b.customCss || ''}
`;
}

module.exports = {
  DEFAULT_BRANDING,
  getBranding,
  updateBranding,
  getBrandingForDomain,
  generateCSS
};
