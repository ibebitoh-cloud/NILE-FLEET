import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function randomPassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase server configuration is incomplete" }), { status: 500, headers: corsHeaders });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id, role, revoked")
      .eq("id", caller.id)
      .maybeSingle();

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.revoked ||
      !["ADMIN", "MANAGER"].includes(String(callerProfile.role).toUpperCase())
    ) {
      return new Response(JSON.stringify({ error: "Admin or manager access required" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;

    if (targetUserId) {
      const { data: customer, error: customerError } = await adminClient
        .from("profiles")
        .select("id, email, name, company_name, role, revoked")
        .eq("id", targetUserId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customer || String(customer.role).toUpperCase() !== "CUSTOMER" || customer.revoked || !customer.email) {
        return new Response(JSON.stringify({ error: "Active customer account not found" }), { status: 404, headers: corsHeaders });
      }

      const password = randomPassword();
      const { error: resetError } = await adminClient.auth.admin.updateUserById(customer.id, {
        password,
        email_confirm: true,
        ban_duration: "none",
      });

      if (resetError) throw resetError;

      return new Response(JSON.stringify({
        ok: true,
        email: customer.email,
        name: customer.name || undefined,
        companyName: customer.company_name || undefined,
        password,
        warning: "The new password is returned once and is not stored in public.profiles.",
      }), { status: 200, headers: corsHeaders });
    }

    const { data: customers, error: customersError } = await adminClient
      .from("profiles")
      .select("id, email, name, company_name, role, revoked")
      .eq("role", "CUSTOMER")
      .eq("revoked", false)
      .order("email");

    if (customersError) throw customersError;

    const users = [];
    let failed = 0;

    for (const customer of customers || []) {
      if (!customer.email) {
        failed++;
        continue;
      }

      const password = randomPassword();
      const { error } = await adminClient.auth.admin.updateUserById(customer.id, {
        password,
        email_confirm: true,
        ban_duration: "none",
      });

      if (error) {
        failed++;
        continue;
      }

      users.push({
        email: customer.email,
        name: customer.name || undefined,
        companyName: customer.company_name || undefined,
        password,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      count: users.length,
      failed,
      users,
      warning: "Passwords are returned once and are not stored in public.profiles.",
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: corsHeaders });
  }
});
