import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_ROLES = new Set(["ADMIN", "CUSTOMER", "VIEWER", "GATE_OPERATOR", "MANAGER"]);
const PORT_MAP: Record<string, string> = {
  DAM: "DAM", DAMIETTA: "DAM",
  ALEX: "ALEX", ALEXANDRIA: "ALEX",
  GOUDA: "GOUDA", DEKHEILA: "GOUDA",
  SOKHNA: "SOKHNA", AIN_SOKHNA: "SOKHNA", "AIN SOKHNA": "SOKHNA",
  SCCT: "SCCT", PORTSAID: "PSD", PORT_SAID: "PSD", "PORT SAID": "PSD",
  PSD: "PSD", MAL: "MAL", MALTA: "MAL",
  WORKSHOP: "WORKSHOP"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ ok: false, error: "Invalid session" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, revoked")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError) return json({ ok: false, error: "Unable to verify administrator profile: " + profileError.message }, 500);

    const role = String(callerProfile?.role || "").toUpperCase();
    if (!VALID_ROLES.has(role) || !["ADMIN", "MANAGER"].includes(role) || callerProfile?.revoked) {
      return json({ ok: false, error: "Administrator access required" }, 403);
    }

    let body: { email?: string; password?: string; profile?: Record<string, unknown> };
    try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const input = body.profile && typeof body.profile === "object" ? body.profile : {};

    if (!email.includes("@")) return json({ ok: false, error: "Valid email required" }, 400);
    if (password.length < 8) return json({ ok: false, error: "Password must be at least 8 characters" }, 400);

    const requestedRole = String(input.role || "VIEWER").trim().toUpperCase();
    if (!VALID_ROLES.has(requestedRole)) return json({ ok: false, error: "Invalid user role: " + requestedRole }, 400);
    if (role === "MANAGER" && !["CUSTOMER","VIEWER","GATE_OPERATOR"].includes(requestedRole)) {
      return json({ ok: false, error: "Managers may only create CUSTOMER, VIEWER, or GATE_OPERATOR accounts" }, 403);
    }

    const rawPorts = Array.isArray(input.assignedPorts) ? input.assignedPorts : [];
    const assignedPorts = rawPorts
      .map((p) => PORT_MAP[String(p).trim().toUpperCase()] || String(p).trim().toUpperCase())
      .filter((p) => ["DAM","ALEX","GOUDA","SOKHNA","SCCT","PSD","MAL","WORKSHOP"].includes(p));

    const displayName = String(input.name || input.email || email.split("@")[0] || "User").trim();

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (createError || !created.user) {
      return json({ ok: false, error: createError?.message || "Failed to create auth user" }, 400);
    }

    const profile = {
      id: created.user.id,
      name: displayName,
      email,
      role: requestedRole,
      company_name: input.companyName ?? null,
      company_name_ar: input.companyNameAr ?? null,
      avatar_url: input.avatarUrl ?? null,
      phone_number: input.phoneNumber ?? null,
      job_title: input.jobTitle ?? null,
      department: input.department ?? null,
      joined_date: input.joinedDate ?? null,
      bio: input.bio ?? null,
      assigned_ports: assignedPorts.length ? assignedPorts : null,
      taxpayer_id: input.taxpayerId ?? null,
      address_line: input.addressLine ?? null,
      governorate: input.governorate ?? null,
      postal_code: input.postalCode ?? null,
      is_eta_verified: Boolean(input.isEtaVerified ?? false),
      past_outstanding_amount: Number(input.pastOutstandingAmount ?? 0) || 0,
      revoked: Boolean(input.revoked ?? false),
      mfa_enabled: Boolean(input.mfaEnabled ?? false),
      allowed_screens: Array.isArray(input.allowedScreens) ? input.allowedScreens : null,
      permissions: input.permissions && typeof input.permissions === "object" ? input.permissions : {},
      invoice_settings: input.invoiceSettings && typeof input.invoiceSettings === "object" ? input.invoiceSettings : {},
      signature_url: input.signatureUrl ?? null,
      is_service_account: Boolean(input.isServiceAccount ?? false),
    };

    const { error: profileError2 } = await adminClient.from("profiles").upsert(profile, { onConflict: "id" });

    if (profileError2) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
      const note = rollbackError ? " Account cleanup also failed: " + rollbackError.message : "";
      return json({ ok: false, error: "Profile creation failed: " + profileError2.message + "." + note }, 500);
    }

    return json({ ok: true, userId: created.user.id });
  } catch (error) {
    console.error("create-user unexpected error:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
