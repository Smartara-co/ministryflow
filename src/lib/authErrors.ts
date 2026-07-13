/** Translate raw auth/network errors into messages a non-technical
 *  applicant can act on. Browsers report a blocked/unreachable request as
 *  the literal string "Failed to fetch" (Chrome) or similar. */
export function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('load failed') // Safari's wording
  ) {
    return 'Could not connect to the server. Please check your internet connection, turn off any data-saver mode, or try a different browser (e.g. Chrome).';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (normalized.includes('email rate limit')) {
    return 'Too many emails sent right now — please try again in about an hour.';
  }
  // Gateway timeouts and other 5xx responses can arrive with an empty or
  // unparseable body, which supabase-js surfaces as "{}" or similar junk.
  if (message.trim().length < 3 || normalized.includes('upstream request timeout')) {
    return 'The server took too long to respond. Please try again in a moment — if this keeps happening, contact the administrator.';
  }
  return message;
}
