import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Required Supabase environment variables are missing");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ ok: false, error: "Invalid session" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, revoked")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError) return json({ ok: false, error: "Unable to verify administrator profile: " + profileError.message }, 500);

    if (String(profile?.role ?? "").toUpperCase() !== "ADMIN" || profile?.revoked) {
      return json({ ok: false, error: "Administrator access required" }, 403);
    }

    const { data, error } = await adminClient.rpc("admin_total_system_wipe");
    if (error || !data?.ok) {
      return json({ ok: false, error: error?.message || "System wipe failed" }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("system-wipe unexpected error:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});