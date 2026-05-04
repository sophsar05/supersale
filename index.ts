// supabase/functions/notify-restock/index.ts
// Deploy: supabase functions deploy notify-restock
// Trigger: called by the frontend admin when marking an item as restocked
//
// Required secrets (set via Supabase Dashboard > Edge Functions > Secrets):
//   SEMAPHORE_API_KEY  — your Semaphore.ph API key
//   SEMAPHORE_SENDER   — your registered sender name (e.g. "SUPERSALE")

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { product_name, store_id } = await req.json();

    if (!product_name || !store_id) {
      return new Response(
        JSON.stringify({ error: "product_name and store_id are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Init Supabase admin client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch all pending requesters for this product + store
    const { data: requests, error: fetchError } = await supabase
      .from("restock_requests")
      .select("id, phone, quantity")
      .eq("store_id", store_id)
      .eq("product_name", product_name)
      .eq("restocked", false);

    if (fetchError) throw fetchError;
    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending requests found.", notified: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2. Get store name for the SMS message
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", store_id)
      .single();

    const storeName = store?.name || store_id;

    // 3. Deduplicate phone numbers
    const phoneMap = new Map<string, { ids: number[]; totalQty: number }>();
    for (const r of requests) {
      const key = r.phone.replace(/\D/g, "");
      if (!phoneMap.has(key)) phoneMap.set(key, { ids: [], totalQty: 0 });
      phoneMap.get(key)!.ids.push(r.id);
      phoneMap.get(key)!.totalQty += r.quantity;
    }

    // 4. Send SMS via Semaphore.ph
    const semaphoreKey = Deno.env.get("SEMAPHORE_API_KEY");
    const senderName   = Deno.env.get("SEMAPHORE_SENDER") || "SUPERSALE";
    const smsResults: { phone: string; status: string }[] = [];

    if (semaphoreKey) {
      for (const [phone, { totalQty }] of phoneMap) {
        const message =
          `Hi! ${product_name} (qty: ${totalQty}) is now back in stock at ${storeName}. ` +
          `Hurry while supplies last! – Supersale.ph`;

        const smsRes = await fetch("https://api.semaphore.co/api/v4/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apikey:      semaphoreKey,
            number:      phone,
            message:     message,
            sendername:  senderName,
          }),
        });

        const status = smsRes.ok ? "sent" : `failed (${smsRes.status})`;
        smsResults.push({ phone: phone.slice(0, 6) + "****", status });
      }
    } else {
      // No API key — log only (dev mode)
      for (const [phone] of phoneMap) {
        smsResults.push({ phone: phone.slice(0, 6) + "****", status: "simulated (no API key)" });
      }
    }

    // 5. Mark all matching requests as restocked
    const allIds = requests.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("restock_requests")
      .update({ restocked: true, restocked_at: new Date().toISOString() })
      .in("id", allIds);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        message: "Restock processed.",
        notified: phoneMap.size,
        total_requests: requests.length,
        sms_results: smsResults,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-restock error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
