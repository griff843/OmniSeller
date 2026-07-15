const target = process.argv[2];
const common = ['DATABASE_URL', 'OMNISELLER_API_INTERNAL_SECRET'];
const required = target === 'web'
  ? [...common, 'AUTH_SECRET', 'AUTH_URL', 'AUTH0_ISSUER', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'NEXT_PUBLIC_APP_URL', 'OMNISELLER_API_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'STORAGE_BUCKET']
  : [...common, 'REDIS_HOST', 'OMNISELLER_WEB_ORIGIN', 'OMNISELLER_TOKEN_ACTIVE_KEY_ID', 'OMNISELLER_TOKEN_ENCRYPTION_KEYS', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'STORAGE_BUCKET', 'EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_REDIRECT_URI', 'EBAY_MERCHANT_LOCATION_KEY', 'EBAY_PAYMENT_POLICY_ID', 'EBAY_RETURN_POLICY_ID', 'EBAY_FULFILLMENT_POLICY_ID', 'EASYPOST_API_KEY', 'DEFAULT_SHIP_FROM_STREET1', 'DEFAULT_SHIP_FROM_CITY', 'DEFAULT_SHIP_FROM_STATE', 'DEFAULT_SHIP_FROM_ZIP'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (process.env.NODE_ENV !== 'production') process.exit(0);
if (missing.length) {
  console.error(`Refusing to start ${target}: missing required production environment variables: ${missing.join(', ')}`);
  process.exit(78);
}
if (target === 'api') {
  let keys;
  try { keys = JSON.parse(process.env.OMNISELLER_TOKEN_ENCRYPTION_KEYS); }
  catch { console.error('Refusing to start api: OMNISELLER_TOKEN_ENCRYPTION_KEYS must be valid JSON.'); process.exit(78); }
  const active = process.env.OMNISELLER_TOKEN_ACTIVE_KEY_ID;
  if (!keys[active] || Buffer.from(keys[active], 'base64').length !== 32) {
    console.error('Refusing to start api: active provider-token key must decode to 32 bytes.');
    process.exit(78);
  }
}
