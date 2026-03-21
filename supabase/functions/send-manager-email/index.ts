import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type EmailRequest = {
  to: string;
  subject?: string;
  body?: string;
  html?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const defaultFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const defaultFromName = Deno.env.get("RESEND_FROM_NAME") || "DentalCloud";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Resend API key is not configured." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let payload: EmailRequest;
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const to = (payload.to || "").trim();
  const subject = (payload.subject || "").trim();
  const text = (payload.body || "").trim();
  const html = (payload.html || "").trim();

  if (!to || !isValidEmail(to)) {
    return new Response(JSON.stringify({ error: "Valid recipient email is required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!subject && !text && !html) {
    return new Response(JSON.stringify({ error: "Email subject or body is required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const fromEmail = (payload.fromEmail || defaultFromEmail).trim();
  if (!fromEmail || !isValidEmail(fromEmail)) {
    return new Response(JSON.stringify({ error: "A valid sender email is required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const fromName = (payload.fromName || defaultFromName).trim();
  const from = `${fromName} <${fromEmail}>`;

  const resendPayload = {
    from,
    to: [to],
    subject: subject || "DentalCloud Notification",
    text: text || undefined,
    html: html || undefined,
    reply_to: payload.replyTo || undefined
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resendPayload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error?.message ||
        data?.errors?.[0]?.message ||
        "Failed to send email.";
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const deliveryId = data?.id || data?.data?.id || null;
    if (!deliveryId) {
      return new Response(JSON.stringify({ error: "Email provider accepted the request but did not return a delivery id.", providerResponse: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ id: deliveryId, messageId: deliveryId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error sending email.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
