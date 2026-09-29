import { supabase } from './supabaseClient';
import { User, UserRole } from '../types';

// Maps a Supabase `profiles` row (snake_case) into the app's existing User shape (camelCase)
const SYSTEM_CREATOR_EMAIL = 'bebito@nilefleet.com';

function mapProfileToUser(profile: any, email: string): User {
  const normalizedEmail = String(email || profile.email || '').trim().toLowerCase();
  return {
    id: profile.id,
    name: profile.name,
    email: email,
    isCreator: normalizedEmail === SYSTEM_CREATOR_EMAIL,
    role: profile.role as UserRole,
    companyName: profile.company_name,
    companyNameAr: profile.company_name_ar,
    avatarUrl: profile.avatar_url,
    phoneNumber: profile.phone_number,
    jobTitle: profile.job_title,
    department: profile.department,
    joinedDate: profile.joined_date,
    bio: profile.bio,
    assignedPorts: profile.assigned_ports || undefined,
    taxpayerId: profile.taxpayer_id,
    addressLine: profile.address_line,
    governorate: profile.governorate,
    postalCode: profile.postal_code,
    isEtaVerified: profile.is_eta_verified,
    pastOutstandingAmount: profile.past_outstanding_amount || 0,
    revoked: profile.revoked,
    mfaEnabled: profile.mfa_enabled,
    allowedScreens: profile.allowed_screens || undefined,
    permissions: profile.permissions || undefined,
    invoiceSettings: profile.invoice_settings || undefined,
    signatureUrl: profile.signature_url || undefined,
  };
}

export async function loginWithPassword(email: string, password: string): Promise<{ user?: User; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: error?.message || 'Authentication failed' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Supabase profile lookup failed after sign in:', {
      code: profileError.code,
      message: profileError.message,
      hint: profileError.hint,
    });
    await supabase.auth.signOut();
    return {
      error: 'Profile lookup failed (' + (profileError.code || 'unknown') + '). Check the browser console for details.',
    };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return { error: 'No profile is linked to this Auth account. Ask an administrator to link or recreate the account.' };
  }

  if (profile.revoked) {
    await supabase.auth.signOut();
    return { error: 'REVOKED' };
  }

  return { user: mapProfileToUser(profile, data.user.email || email) };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSessionUser(): Promise<User | null> {
  // getUser() validates the access token with Supabase Auth instead of
  // trusting a locally cached session when deciding whether to unlock screens.
  const { data, error } = await supabase.auth.getUser();
  const sessionUser = error ? null : data.user;
  if (!sessionUser) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sessionUser.id)
    .maybeSingle();

  if (!profile || profile.revoked) return null;

  return mapProfileToUser(profile, sessionUser.email || '');
}

/**
 * Creates a REAL login account (Supabase Auth + profile), via the secure
 * server-side function. Used by User Management when adding a new staff
 * or customer account. Returns an error string on failure.
 */
export async function activateAllCustomerUsers(): Promise<{ users?: Array<{ email: string; name?: string; companyName?: string; password: string }>; count?: number; failed?: number; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { error: 'No active administrator session' };

    const { data, error } = await supabase.functions.invoke('activate-customer-users', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {},
    });

    if (error) return { error: error.message || 'Customer activation service failed' };
    if (!data?.ok) return { error: data?.error || 'Customer activation service failed' };
    return {
      users: data.users || [],
      count: data.count || 0,
      failed: data.failed || 0,
    };
  } catch (e: any) {
    return { error: e?.message || 'Network error activating customer accounts' };
  }
}

export async function resetCustomerPassword(userId: string): Promise<{ password?: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { error: 'No active administrator session' };
    const { data, error } = await supabase.functions.invoke('activate-customer-users', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { userId },
    });
    if (error) return { error: error.message || 'Password reset service failed' };
    if (!data?.ok || !data?.password) return { error: data?.error || 'Password reset service failed' };
    return { password: data.password };
  } catch (e: any) {
    return { error: e?.message || 'Network error resetting password' };
  }
}

export async function createRealAccount(email: string, password: string, profile: Partial<User>): Promise<{ userId?: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { error: 'No active administrator session' };

    const res = await fetch('/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, password, profile }),
    });
    const responseText = await res.text();
    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      return { error: `Create-user service returned HTTP ${res.status}: ${responseText.slice(0, 300) || 'non-JSON response'}` };
    }
    if (!res.ok || data.error) return { error: data.error || `Failed to create account (HTTP ${res.status})` };
    if (!data.userId) return { error: 'Account service did not return a user ID' };
    return { userId: data.userId };
  } catch (e: any) {
    return { error: e?.message || 'Network error creating account' };
  }
}
