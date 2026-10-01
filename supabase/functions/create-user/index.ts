import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) throw new Error("Required Supabase environment variables are missing");

const VALID_ROLES = new Set(["ADMIN","CUSTOMER","VIEWER","GATE_OPERATOR","MANAGER"]);
const MANAGER_ROLES = new Set(["CUSTOMER","VIEWER","GATE_OPERATOR"]);
const VALID_PORTS = new Set(["DAM","ALEX","GOUDA","SOKHNA","SCCT","PSD","MAL","WORKSHOP"]);
const PORT_MAP: Record<string,string> = { DAM:"DAM",DAMIETTA:"DAM",ALEX:"ALEX",ALEXANDRIA:"ALEX",GOUDA:"GOUDA",DEKHEILA:"GOUDA",SOKHNA:"SOKHNA",AIN_SOKHNA:"SOKHNA","AIN SOKHNA":"SOKHNA",SCCT:"SCCT",PSD:"PSD",PORTSAID:"PSD",PORT_SAID:"PSD","PORT SAID":"PSD",MAL:"MAL",MALTA:"MAL",WORKSHOP:"WORKSHOP" };

function cleanDate(v: unknown): string | null { const s=String(v??"").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null; }
function boolValue(v: unknown, fallback=false): boolean { if(typeof v==="boolean") return v; if(typeof v==="string") return v.toLowerCase()==="true"; return v==null?fallback:Boolean(v); }
function json(data: unknown,status=200){ return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}}); }

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{status:200,headers:corsHeaders});
  if(req.method!=="POST") return json({ok:false,error:"Method not allowed"},405);
  try{
    const authHeader=req.headers.get("Authorization")??"";
    if(!authHeader.startsWith("Bearer ")) return json({ok:false,error:"Unauthorized"},401);
    const callerClient=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:authHeader}}});
    const {data:{user:caller},error:authError}=await callerClient.auth.getUser();
    if(authError||!caller) return json({ok:false,error:"Invalid session"},401);

    const adminClient=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
    const {data:callerProfile,error:profileError}=await adminClient.from("profiles").select("role, revoked").eq("id",caller.id).maybeSingle();
    if(profileError) return json({ok:false,error:"Unable to verify administrator profile: "+profileError.message},500);
    const callerRole=String(callerProfile?.role??"").toUpperCase();
    if(!["ADMIN","MANAGER"].includes(callerRole)||callerProfile?.revoked) return json({ok:false,error:"Administrator access required"},403);

    let body:any; try{body=await req.json();}catch{return json({ok:false,error:"Invalid JSON"},400);}
    const email=String(body?.email??"").trim().toLowerCase();
    const password=String(body?.password??"");
    const input=body?.profile&&typeof body.profile==="object"?body.profile:{};
    if(!email||!email.includes("@")) return json({ok:false,error:"Valid email required"},400);
    if(password.length<8) return json({ok:false,error:"Password must be at least 8 characters"},400);

    const requestedRole=String(input.role??"VIEWER").trim().toUpperCase();
    if(!VALID_ROLES.has(requestedRole)) return json({ok:false,error:"Invalid user role: "+requestedRole},400);
    if(callerRole==="MANAGER"&&!MANAGER_ROLES.has(requestedRole)) return json({ok:false,error:"Managers may only create CUSTOMER, VIEWER, or GATE_OPERATOR accounts"},403);

    const rawPorts=Array.isArray(input.assignedPorts)?input.assignedPorts:[];
    const assignedPorts=rawPorts.map((p:any)=>PORT_MAP[String(p??"").trim().toUpperCase()]).filter((p:any):p is string=>VALID_PORTS.has(p));
    const displayName=String(input.name??email.split("@")[0]??"User").trim()||"User";

    const {data:created,error:createError}=await adminClient.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:displayName}});
    if(createError||!created?.user) return json({ok:false,error:createError?.message??"Failed to create auth user"},400);

    const userId=created.user.id;
    const profile={
      id:userId,name:displayName,email,role:requestedRole,
      company_name:input.companyName||null,company_name_ar:input.companyNameAr||null,avatar_url:input.avatarUrl||null,
      phone_number:input.phoneNumber||null,job_title:input.jobTitle||null,department:input.department||null,joined_date:cleanDate(input.joinedDate),
      bio:input.bio||null,assigned_ports:assignedPorts.length?assignedPorts:null,taxpayer_id:input.taxpayerId||null,address_line:input.addressLine||null,
      governorate:input.governorate||null,postal_code:input.postalCode||null,is_eta_verified:boolValue(input.isEtaVerified),
      past_outstanding_amount:Number.isFinite(Number(input.pastOutstandingAmount))?Number(input.pastOutstandingAmount):0,revoked:boolValue(input.revoked),
      mfa_enabled:boolValue(input.mfaEnabled),allowed_screens:Array.isArray(input.allowedScreens)?input.allowedScreens:null,
      permissions:input.permissions&&typeof input.permissions==="object"?input.permissions:{},invoice_settings:input.invoiceSettings&&typeof input.invoiceSettings==="object"?input.invoiceSettings:{},
      signature_url:input.signatureUrl||null,is_service_account:boolValue(input.isServiceAccount)
    };

    const {error:profileError2}=await adminClient.from("profiles").upsert(profile,{onConflict:"id"});
    if(profileError2){
      const {error:rollbackError}=await adminClient.auth.admin.deleteUser(userId);
      const note=rollbackError?" Account cleanup also failed: "+rollbackError.message:"";
      return json({ok:false,error:"Profile creation failed: "+profileError2.message+"."+note},500);
    }
    return json({ok:true,userId});
  }catch(error){ console.error("create-user unexpected error:",error); return json({ok:false,error:error instanceof Error?error.message:String(error)},500); }
});