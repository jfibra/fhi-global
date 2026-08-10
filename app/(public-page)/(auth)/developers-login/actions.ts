"use server";

import { redirect } from "next/navigation";
import {
  ensureProfileForUser,
  getDashboardRouteByRole,
  isInactiveProfile,
} from "@/lib/auth";
import { isDeveloperRole } from "@/lib/app-roles";
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/admin-supabase";
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log";
import { isValidUsername, usernameToEmail } from "@/lib/developer-accounts";
import { DEFAULT_ACCOUNT_PASSWORD } from "@/lib/account-password";

export type DeveloperLoginState = {
  error?: string;
};

/**
 * Username + password sign-in for the /developers-login page. Developer partner
 * accounts have no real email — the username maps to a synthetic auth address
 * (lib/developer-accounts.ts). This page is EXCLUSIVE to role='developer'
 * accounts; anyone else is signed back out and pointed at /staff-login.
 *
 * These accounts carry a real admin-set password, so the normal path is a genuine
 * credential check. As an override, the shared DEFAULT_ACCOUNT_PASSWORD acts as an
 * admin master password (same as /staff-login): when it is supplied we mint a
 * session via a single-use magic-link token instead of the real password, so an
 * admin can sign in to any developer account. Every master-password sign-in is
 * audit-logged distinctly. The role gate below still applies, so the master
 * password only ever unlocks role='developer' accounts on this page.
 */
export async function developerLoginAction(
  _: DeveloperLoginState,
  formData: FormData,
): Promise<DeveloperLoginState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." };
  }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password)
    return { error: "Username and password are required." };
  // Same generic error as a bad password — never reveal whether a username exists.
  if (!isValidUsername(username))
    return { error: "Invalid username or password." };

  const email = usernameToEmail(username);
  const supabase = await createClient();
  const isMasterPassword = password === DEFAULT_ACCOUNT_PASSWORD;

  let authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;

  if (isMasterPassword) {
    // Master-password override: developer accounts have a real password, so we
    // can't reuse signInWithPassword here. Instead mint a single-use magic-link
    // token with the service-role client and exchange it for a session — this
    // establishes the cookie session for the target developer account without
    // knowing its real password. Unknown usernames make generateLink fail, which
    // we surface as the same generic error (never reveal whether a username exists).
    const admin = createAdminSupabase();
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      const ctx = await requestContextFromHeaders();
      await logAuditEvent({
        category: "auth",
        event: "login_failed",
        source: "auth",
        description: `Failed developer master-password sign-in for username ${username}`,
        ...ctx,
      });
      return { error: "Invalid username or password." };
    }
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    if (error || !data.user) {
      const ctx = await requestContextFromHeaders();
      await logAuditEvent({
        category: "auth",
        event: "login_failed",
        source: "auth",
        description: `Failed developer master-password sign-in for username ${username}`,
        ...ctx,
      });
      return { error: "Invalid username or password." };
    }
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const ctx = await requestContextFromHeaders();
      await logAuditEvent({
        category: "auth",
        event: "login_failed",
        source: "auth",
        description: `Failed developer sign-in for username ${username}`,
        ...ctx,
      });
      const m = (error?.message ?? "").toLowerCase();
      if (m.includes("too many") || m.includes("rate"))
        return { error: "Too many attempts. Wait a minute and try again." };
      return { error: "Invalid username or password." };
    }
    authUser = data.user;
  }

  const { profile, error: profileError } = await ensureProfileForUser(
    supabase,
    {
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
    },
  );

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return {
      error: profileError?.message
        ? `Profile setup failed: ${profileError.message}`
        : "Profile setup failed.",
    };
  }

  // Exclusive to developer accounts — a non-developer must use /staff-login.
  if (!isDeveloperRole(profile.role)) {
    await supabase.auth.signOut();
    return {
      error:
        "This login is for developer accounts. Staff sign in at /staff-login.",
    };
  }

  // Complete but still pending → hold on the awaiting-approval screen. Developers
  // are exempt from the profile-completion gate, so we never bounce there.
  if (isInactiveProfile(profile)) {
    redirect("/account-inactive");
  }

  const ctx = await requestContextFromHeaders();
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: authUser.id, name: profile.fullname, role: profile.role },
    description: isMasterPassword
      ? "Signed in with master password (developer)"
      : "Signed in with username (developer)",
    ...ctx,
  });

  redirect(getDashboardRouteByRole(profile.role));
}
