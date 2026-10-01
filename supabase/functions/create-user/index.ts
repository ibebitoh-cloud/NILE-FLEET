import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return json({ error: "Invalid session" }, 401);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, revoked")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) return json({ error: "Unable to verify administrator profile" }, 500);

  const role = String(callerProfile?.role || "").toUpperCase();
  if (!["ADMIN", "MANAGER"].includes(role) || callerProfile?.revoked) {
    return json({ error: "Administrator access required" }, 403);
  }

  let body: { email?: string; password?: string; profile?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const input = body.profile && typeof body.profile === "object" ? body.profile : {};

  if (!email.includes("@")) return json({ error: "Valid email required" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return json({ error: createError?.message || "Failed to create auth user" }, 400);
  }

  const profile = {
    id: created.user.id,
    name: input.name ?? null,
    email,
    role: input.role ?? "VIEWER",
    company_name: input.companyName ?? null,
    company_name_ar: input.companyNameAr ?? null,
    avatar_url: input.avatarUrl ?? null,
    phone_number: input.phoneNumber ?? null,
    job_title: input.jobTitle ?? null,
    department: input.department ?? null,
    joined_date: input.joinedDate ?? null,
    bio: input.bio ?? null,
    assigned_ports: input.assignedPorts ?? null,
    taxpayer_id: input.taxpayerId ?? null,
    address_line: input.addressLine ?? null,
    governorate: input.governorate ?? null,
    postal_code: input.postalCode ?? null,
    is_eta_verified: input.isEtaVerified ?? false,
    past_outstanding_amount: input.pastOutstandingAmount ?? 0,
    revoked: input.revoked ?? false,
    mfa_enabled: input.mfaEnabled ?? false,
    allowed_screens: input.allowedScreens ?? null,
    permissions: input.permissions ?? {},
    invoice_settings: input.invoiceSettings ?? {},
    signature_url: input.signatureUrl ?? null,
    is_service_account: input.isServiceAccount ?? false,
  };

  const { error: insertError } = await adminClient.from("profiles").insert(profile);

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: `Profile creation failed: ${insertError.message}` }, 500);
  }

  return json({ ok: true, userId: created.user.id });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}
