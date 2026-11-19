export function cloudConfigured() {
  const {DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL} = process.env;
  if (!DATABASE_URL || DATABASE_URL.includes('YOUR-HOST') || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length<32 || !BETTER_AUTH_URL) return false;
  try { return ['postgres:', 'postgresql:'].includes(new URL(DATABASE_URL).protocol) && ['http:', 'https:'].includes(new URL(BETTER_AUTH_URL).protocol); } catch { return false; }
}
export function recoveryConfigured() { return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM); }
