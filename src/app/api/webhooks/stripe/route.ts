import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { requireEnv } from "@/lib/env";

type EnrollmentStatus = "pending" | "active" | "canceled";

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Webhook do Stripe: libera ou bloqueia o acesso aos cursos gravados.
 * Eventos usados:
 *   checkout.session.completed / async_payment_succeeded / async_payment_failed
 *   customer.subscription.updated / deleted
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const courseId = session.metadata?.course_id;
      if (!userId || !courseId) break;

      let status: EnrollmentStatus;
      if (event.type === "checkout.session.async_payment_failed") status = "canceled";
      else if (session.payment_status === "unpaid") status = "pending"; // Pix/boleto aguardando pagamento
      else status = "active";

      const { error } = await admin.from("enrollments").upsert(
        {
          user_id: userId,
          course_id: courseId,
          status,
          provider: "stripe",
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: idOf(session.subscription),
          stripe_customer_id: idOf(session.customer),
        },
        { onConflict: "user_id,course_id" },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      // past_due mantém o acesso enquanto o Stripe tenta cobrar de novo.
      const keepsAccess =
        event.type === "customer.subscription.updated" &&
        ["active", "trialing", "past_due"].includes(subscription.status);

      const { error } = await admin
        .from("enrollments")
        .update({ status: keepsAccess ? "active" : "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
