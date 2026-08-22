/** Renames are rate-limited to one per this many days. Enforced server-side
 * (PATCH /users/me rejects a too-soon rename with a 400 regardless of what
 * the UI allows) -- this copy exists only so the Edit Profile modal can say
 * "available in N days" up front, instead of letting someone type a new name,
 * press SAVE and find out from an error. The backend stays the authority: if
 * the two ever disagree, its message is what gets shown. */
export const USERNAME_COOLDOWN_DAYS = 10;

/**
 * Whole days left before `changedAt` clears the rename cooldown, or 0 if a
 * rename is allowed right now.
 *
 * `changedAt` is the profile's `username_changed_at`: null means the account
 * has never been renamed since signup, so no cooldown has started and a
 * rename is immediately allowed.
 *
 * Rounded up, deliberately: with a partial day left, rounding down would show
 * "0 days" while the backend still refuses the rename. Better to say 1 day and
 * be right a few hours early than to say 0 and look broken.
 */
export function usernameCooldownDaysLeft(changedAt: string | null, now: number = Date.now()): number {
  if (!changedAt) return 0;
  const changed = new Date(changedAt).getTime();
  // An unparseable timestamp shouldn't lock the field forever -- fall through
  // and let the backend be the one to refuse if it really is too soon.
  if (Number.isNaN(changed)) return 0;
  const msLeft = changed + USERNAME_COOLDOWN_DAYS * 86_400_000 - now;
  return msLeft <= 0 ? 0 : Math.ceil(msLeft / 86_400_000);
}
