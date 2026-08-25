/**
 * Enterprise SSO Service
 * SAML 2.0 and OpenID Connect (OIDC) integration for enterprise customers.
 * Manages SSO configurations per organization.
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { table } = require('../db/query');

const SSO_PROVIDERS = {
  okta: { name: 'Okta', protocol: 'oidc', icon: 'okta' },
  azure: { name: 'Azure AD', protocol: 'oidc', icon: 'microsoft' },
  google_workspace: { name: 'Google Workspace', protocol: 'oidc', icon: 'google' },
  onelogin: { name: 'OneLogin', protocol: 'saml', icon: 'onelogin' },
  ping: { name: 'Ping Identity', protocol: 'saml', icon: 'ping' },
  jumpcloud: { name: 'JumpCloud', protocol: 'saml', icon: 'jumpcloud' },
  custom_oidc: { name: 'Custom OIDC', protocol: 'oidc', icon: 'key' },
  custom_saml: { name: 'Custom SAML', protocol: 'saml', icon: 'key' }
};

/**
 * Configure SSO for an organization.
 */
async function configureSSO(userId, data) {
  const { provider, name, clientId, clientSecret, metadataUrl, entityId, ssoUrl, certificate } = data;
  if (!provider || !name) return { success: false, reason: 'provider_and_name_required' };
  if (!SSO_PROVIDERS[provider]) return { success: false, reason: 'unknown_provider' };

  const protocol = SSO_PROVIDERS[provider].protocol;

  if (protocol === 'oidc' && (!clientId || !clientSecret)) {
    return { success: false, reason: 'oidc_requires_client_id_and_secret' };
  }
  if (protocol === 'saml' && (!entityId || !ssoUrl || !certificate)) {
    return { success: false, reason: 'saml_requires_entity_id_sso_url_certificate' };
  }

  const id = uuidv4();
  const ssoConfigs = await table('sso_configurations');

  const config = {
    id,
    user_id: userId,
    provider,
    name,
    protocol,
    client_id: clientId || null,
    client_secret: clientSecret ? crypto.createHash('sha256').update(clientSecret).digest('hex') : null,
    client_secret_raw: clientSecret || null,
    metadata_url: metadataUrl || null,
    entity_id: entityId || null,
    sso_url: ssoUrl || null,
    certificate: certificate || null,
    enabled: true,
    auto_provision: true,
    default_role: 'member',
    created_at: new Date().toISOString()
  };

  await ssoConfigs.insert(config);

  return {
    success: true,
    id,
    provider,
    protocol,
    issuerUrl: `${process.env.APP_URL || 'http://localhost:4000'}/api/sso/${id}/metadata`,
    callbackUrl: `${process.env.APP_URL || 'http://localhost:4000'}/api/sso/${id}/callback`
  };
}

/**
 * List SSO configurations for a user.
 */
async function listSSO(userId) {
  const ssoConfigs = await table('sso_configurations');
  const all = await ssoConfigs.filter({ user_id: userId });
  return (Array.isArray(all) ? all : all ? [all] : []).map(c => ({
    id: c.id,
    provider: c.provider,
    name: c.name,
    protocol: c.protocol,
    enabled: c.enabled,
    autoProvision: c.auto_provision,
    createdAt: c.created_at
  }));
}

/**
 * Initiate SSO login.
 */
async function initiateSSO(configId, redirectUri) {
  const ssoConfigs = await table('sso_configurations');
  const config = await ssoConfigs.find({ id: configId });
  if (!config || !config.enabled) return { success: false, reason: 'sso_not_found_or_disabled' };

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store state for validation
  const states = await table('sso_states');
  await states.insert({
    id: uuidv4(),
    config_id: configId,
    state,
    nonce,
    redirect_uri: redirectUri || `${process.env.APP_URL || 'http://localhost:4000'}/api/sso/callback`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  });

  if (config.protocol === 'oidc') {
    const authUrl = new URL(config.sso_url || `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', config.client_id);
    authUrl.searchParams.set('redirect_uri', states.find ? '' : '');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    return { success: true, url: authUrl.toString(), state, protocol: 'oidc' };
  }

  // SAML — return metadata URL for SP-initiated flow
  return {
    success: true,
    protocol: 'saml',
    metadataUrl: `${process.env.APP_URL || 'http://localhost:4000'}/api/sso/${configId}/metadata`,
    ssoUrl: config.sso_url,
    state
  };
}

/**
 * Handle SSO callback (OIDC code exchange or SAML response).
 */
async function handleCallback(configId, code, state) {
  const ssoConfigs = await table('sso_configurations');
  const config = await ssoConfigs.find({ id: configId });
  if (!config) return { success: false, reason: 'config_not_found' };

  // Validate state
  const states = await table('sso_states');
  const storedState = await states.find({ config_id: configId, state });
  if (!storedState) return { success: false, reason: 'invalid_state' };
  if (new Date(storedState.expires_at) < new Date()) return { success: false, reason: 'state_expired' };

  // Clean up used state
  await states.remove({ id: storedState.id });

  if (config.protocol === 'oidc') {
    // In production: exchange code for tokens, validate nonce, extract user info
    // Mock for development
    return {
      success: true,
      user: {
        email: `sso-${config.provider}@enterprise.example.com`,
        name: `SSO User (${config.name})`,
        provider: config.provider,
        configId
      }
    };
  }

  // SAML — in production: validate XML signature, extract attributes
  return {
    success: true,
    user: {
      email: `saml-${config.name}@enterprise.example.com`,
      name: `SAML User (${config.name})`,
      provider: config.provider,
      configId
    }
  };
}

/**
 * Generate SAML SP metadata XML.
 */
function generateSAMLMetadata(configId) {
  const appId = process.env.APP_URL || 'http://localhost:4000';
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${appId}/api/sso/${configId}/metadata">
  <SPSSODescriptor
    AuthnRequestsSigned="true"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${appId}/api/sso/${configId}/callback"
      index="1" />
  </SPSSODescriptor>
</EntityDescriptor>`;
}

module.exports = {
  SSO_PROVIDERS,
  configureSSO,
  listSSO,
  initiateSSO,
  handleCallback,
  generateSAMLMetadata
};
