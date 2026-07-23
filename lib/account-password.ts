/**
 * Shared default account password.
 *
 * Public users sign in passwordlessly (email OTP / Google), so their accounts
 * would otherwise have no usable password. We set this fixed password on every
 * account so an admin can sign in to the password-based /login page with any
 * account's email + this password. Server-only — never import into client code.
 */
export const DEFAULT_ACCOUNT_PASSWORD = "Global123!@#"
