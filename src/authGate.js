// Global on-demand auth bridge.
//
// requireAuth() lets ANY code path (React components, plain hooks, context)
// prompt sign-in through the single premium MiLey auth modal and resume the
// original action once the user is signed in — without every caller needing
// access to React context.
//
// AuthProvider registers the actual modal opener via _registerAuthGate().
// Until it mounts (or if it's somehow absent), we fall back to the platform
// sign-in modal so auth still works.

import { auth } from './lib/auth'

let _handler = null

export function _registerAuthGate(fn) {
  _handler = fn
}

/**
 * Ensure the user is signed in before continuing an action.
 * @param {string} [reason] optional context key (e.g. 'play', 'like') — lets
 *   the modal tailor its copy. Purely cosmetic.
 * @returns {Promise<boolean>} true once signed in, false if the user dismissed.
 */
export async function requireAuth(reason) {
  if (auth.isAuthenticated()) return true
  if (_handler) {
    try {
      return await _handler(reason)
    } catch {
      return auth.isAuthenticated()
    }
  }
  // Fallback: no provider mounted — use the platform modal directly.
  await auth.signIn()
  return auth.isAuthenticated()
}
