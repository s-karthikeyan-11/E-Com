const insecureJwtSecrets = new Set([
  'change_this_to_a_long_random_secret',
  'replace_with_a_unique_32_plus_character_secret',
  'secret',
  'jwt_secret',
]);

const getClientOrigins = () =>
  (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const getCookieSameSite = () => (process.env.COOKIE_SAME_SITE || 'lax').trim().toLowerCase();

const validateEnvironment = () => {
  const missing = ['MONGO_URI', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
    .filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;

  if (isProduction && (jwtSecret.length < 32 || insecureJwtSecrets.has(jwtSecret.toLowerCase()))) {
    throw new Error('JWT_SECRET must be a unique random value of at least 32 characters in production');
  }
  if (isProduction && getClientOrigins().length === 0) {
    throw new Error('CLIENT_URL must be configured in production');
  }
  if (!['lax', 'strict', 'none'].includes(getCookieSameSite())) {
    throw new Error('COOKIE_SAME_SITE must be one of: lax, strict, none');
  }
};

module.exports = { getClientOrigins, getCookieSameSite, validateEnvironment };
