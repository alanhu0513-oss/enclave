# Enclave API Documentation

## Authentication
All API requests require a Bearer token:
```
Authorization: Bearer <your-api-key>
```

## Endpoints

### Authentication
- `POST /api/auth/register` - Register new account
- `POST /api/auth/login` - Login

### Scan
- `POST /api/scan` - Scan URL for deepfakes
- `POST /api/scan/file` - Scan uploaded file

### Shields
- `GET /api/shields` - List shields
- `POST /api/shields/:id/toggle` - Toggle shield

### Alerts
- `GET /api/alerts` - List alerts
- `GET /api/alerts/:id` - Get alert details

### Insurance
- `GET /api/insurance/plans` - List plans
- `POST /api/insurance/subscribe` - Subscribe to plan

### Passport
- `POST /api/passport/enroll` - Enroll identity
- `GET /api/passport/:id/verify` - Verify passport

### Threat Intelligence
- `GET /api/threat-intel/iocs` - List IOCs
- `POST /api/threat-intel/iocs` - Report IOC

### ML Models
- `GET /api/ml/models` - List models
- `POST /api/ml/models/:id/deploy` - Deploy model

### Enterprise
- `GET /api/sso/config` - Get SSO config
- `POST /api/sso/saml/configure` - Configure SAML
- `GET /api/platform/keys` - List API keys
- `POST /api/platform/keys` - Create API key

## Rate Limits
- Free: 100 requests/minute
- Pro: 500 requests/minute
- Shield: 1000 requests/minute
- Enterprise: Custom

## Response Format
```json
{
  "success": true,
  "data": { ... }
}
```

## Error Format
```json
{
  "success": false,
  "error": "Error message"
}
```
