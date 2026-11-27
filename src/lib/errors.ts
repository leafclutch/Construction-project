type MaybeError = { code?: string; message?: string; status?: number } | null | undefined

/** Turns Supabase/Postgres/network errors into one sentence a user can act on. */
export function getErrorMessage(error: unknown): string {
  const e = error as MaybeError
  if (!e) return 'Something went wrong. Try again.'
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You are offline. Check your connection and try again.'

  switch (e.code) {
    case '42501':
      return 'You do not have permission for this. Ask the firm owner.'
    case '23505':
      return 'This entry already exists.'
    case '23503':
      return 'This record is linked to something that no longer exists. Refresh and try again.'
    case '23514':
    case '22P02':
    case '22003':
      return 'Some values are not valid. Check the highlighted fields.'
    case 'P0002':
      return e.message ?? 'Not found.'
    case 'invalid_credentials':
      return 'Email or password is wrong.'
    case 'email_exists':
      return 'This email already has an account. Use a different email.'
    case 'forbidden':
    case 'invalid_input':
    case 'not_found':
      return e.message ?? 'You cannot do this.'
    case 'not_signed_in':
      return 'Your login has expired. Log in again.'
    case 'user_banned':
      return 'This account is turned off. Ask the firm owner.'
    case 'password_mismatch':
      return 'The two passwords do not match.'
    case 'same_password':
      return 'Choose a password different from the current one.'
    case 'reauthentication_needed':
    case 'session_expired':
      return 'For safety, log out, log in again, then change your password.'
    case 'weak_password':
      return 'Choose a stronger password (at least 8 characters).'
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
  }
  if (e.message?.includes('Failed to fetch')) return 'Could not reach the server. Check your connection and try again.'
  if (e.status === 413 || e.message?.includes('exceeded the maximum')) return 'This file is too large.'
  if (e.message?.includes('mime type')) return 'This file type is not allowed.'
  return 'Something went wrong. Try again.'
}
