"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

async function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
}

/** Abre o checkout do Stripe (cartão, Pix etc. conforme ativado no painel do Stripe). */
export async function startCheckout(formData: FormData) {
  const viewer = await requireViewer();
  const courseId = String(formData.get("course_id") ?? "");
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, price_cents, currency, billing, published")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || !course.published) throw new Error("Este curso não está disponível para compra.");

  const { data: hasAccess } = await supabase.rpc("has_course_access", { p_course: course.id });
  if (hasAccess || course.price_cents <= 0) redirect(`/cursos/${course.slug}`);

  const origin = await siteUrl();
  const monthly = course.billing === "monthly";
  const metadata = { user_id: viewer.id, course_id: course.id };

  const session = await getStripe().checkout.sessions.create({
    mode: monthly ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: course.currency,
          unit_amount: course.price_cents,
          product_data: { name: course.title },
          ...(monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    customer_email: viewer.email || undefined,
    client_reference_id: viewer.id,
    metadata,
    ...(monthly ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    locale: "pt-BR",
    success_url: `${origin}/cursos/${course.slug}?compra=sucesso`,
    cancel_url: `${origin}/cursos/${course.slug}?compra=cancelada`,
  });

  if (!session.url) throw new Error("Não foi possível abrir o pagamento.");
  redirect(session.url);
}

/** Portal do Stripe para o aluno trocar cartão ou cancelar a assinatura mensal. */
export async function openBillingPortal(formData: FormData) {
  const viewer = await requireViewer();
  const courseId = String(formData.get("course_id") ?? "");
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("stripe_customer_id, course:courses(slug)")
    .eq("user_id", viewer.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!enrollment?.stripe_customer_id) throw new Error("Assinatura não encontrada.");

  const slug = (enrollment.course as unknown as { slug: string } | null)?.slug ?? "";
  const portal = await getStripe().billingPortal.sessions.create({
    customer: enrollment.stripe_customer_id,
    return_url: `${await siteUrl()}/cursos/${slug}`,
  });
  redirect(portal.url);
}

export async function toggleEpisodeWatched(formData: FormData) {
  const viewer = await requireViewer();
  const episodeId = String(formData.get("episode_id") ?? "");
  const watched = formData.get("watched") === "1";
  const path = String(formData.get("path") ?? "");
  const supabase = await createClient();

  if (watched) {
    await supabase.from("episode_progress").delete().eq("user_id", viewer.id).eq("episode_id", episodeId);
  } else {
    await supabase.from("episode_progress").upsert({ user_id: viewer.id, episode_id: episodeId });
  }
  if (path.startsWith("/cursos/")) revalidatePath(path);
}
