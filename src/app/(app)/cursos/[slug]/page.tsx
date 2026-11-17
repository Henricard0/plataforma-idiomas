import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { Badge, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon, CheckIcon, LockIcon, PlayIcon } from "@/components/icons";
import { openBillingPortal, startCheckout } from "../actions";

const WEEK = 7 * 86_400_000;

export default async function CoursePage({ params, searchParams }: PageProps<"/cursos/[slug]">) {
  const { slug } = await params;
  const { compra } = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, slug, title, description, language, level, price_cents, currency, billing, published, teacher_id, teacher:profiles!teacher_id(full_name)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!course) notFound();

  const [{ data: episodes }, { data: enrollment }, { data: hasAccess }, { data: progress }] = await Promise.all([
    supabase
      .from("episodes")
      .select("id, title, description, duration_sec, is_free_preview, release_at, video_path")
      .eq("course_id", course.id)
      .order("release_at", { ascending: true }),
    supabase
      .from("enrollments")
      .select("status, provider, stripe_subscription_id")
      .eq("course_id", course.id)
      .eq("user_id", viewer.id)
      .maybeSingle(),
    supabase.rpc("has_course_access", { p_course: course.id }),
    supabase.from("episode_progress").select("episode_id").eq("user_id", viewer.id),
  ]);

  const isOwner = course.teacher_id === viewer.id;
  const teacher = one(course.teacher as unknown as { full_name: string } | null);
  const watched = new Set((progress ?? []).map((p) => p.episode_id as string));
  const now = await requestNow();
  const list = episodes ?? [];
  const released = list.filter((e) => new Date(e.release_at).getTime() <= now);
  const nextUp = released.find((e) => !watched.has(e.id)) ?? released[0];
  const latest = released[released.length - 1];
  const monthly = course.billing === "monthly";
  const priceLabel =
    course.price_cents === 0 ? "Grátis" : `${formatPrice(course.price_cents, course.currency)}${monthly ? "/mês" : ""}`;

  return (
    <>
      <Link href="/cursos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Cursos gravados
      </Link>

      {compra === "sucesso" && !hasAccess ? (
        <Notice tone="success">
          Pagamento enviado! Assim que o Stripe confirmar (no Pix pode levar alguns minutos), os episódios são liberados
          aqui automaticamente. Atualize a página em instantes.
        </Notice>
      ) : null}
      {compra === "sucesso" && hasAccess ? <Notice tone="success">Tudo certo! O curso já está liberado para você.</Notice> : null}
      {compra === "cancelada" ? <Notice>O pagamento foi cancelado. Nada foi cobrado.</Notice> : null}
      {enrollment?.status === "pending" && !hasAccess ? (
        <Notice>Seu pagamento está aguardando confirmação.</Notice>
      ) : null}
      {isOwner && !course.published ? (
        <Notice>
          Este curso ainda é um rascunho e não aparece para os alunos.{" "}
          <Link href={`/estudio/${course.id}`} className="font-medium text-accent hover:underline">
            Publicar no Estúdio
          </Link>
        </Notice>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <PageHeader
            title={course.title}
            eyebrow={
              <span className="flex flex-wrap gap-2">
                <Badge tone="accent">{languageLabel(course.language)}</Badge>
                {course.level ? <Badge>{course.level}</Badge> : null}
              </span>
            }
            description={teacher ? `com ${teacher.full_name}` : undefined}
          />
          {course.description ? (
            <p className="-mt-4 mb-8 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-ink/85">
              {course.description}
            </p>
          ) : null}

          <h2 className="mb-3 text-base font-semibold">Episódios</h2>
          {list.length === 0 ? (
            <p className="text-sm text-muted">O primeiro episódio sai em breve.</p>
          ) : (
            <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
              {list.map((e, i) => {
                const isReleased = new Date(e.release_at).getTime() <= now;
                const canWatch = isReleased && (hasAccess || e.is_free_preview);
                const isNew = isReleased && now - new Date(e.release_at).getTime() < WEEK;
                const content = (
                  <>
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        watched.has(e.id) ? "bg-accent text-white" : "bg-paper text-muted"
                      }`}
                    >
                      {watched.has(e.id) ? <CheckIcon size={15} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted">
                        {isReleased ? formatDate(e.release_at) : `Agendado para ${formatDateTime(e.release_at)}`}
                        {e.duration_sec ? ` · ${Math.max(1, Math.round(e.duration_sec / 60))} min` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {isNew ? <Badge tone="warning">Novo</Badge> : null}
                      {e.is_free_preview && !hasAccess ? <Badge tone="accent">Grátis</Badge> : null}
                      {!isReleased ? <Badge>Agendado</Badge> : null}
                      {canWatch ? (
                        <PlayIcon size={18} className="text-accent" />
                      ) : (
                        <LockIcon size={16} className="text-muted" />
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={e.id}>
                    {canWatch && e.video_path ? (
                      <Link href={`/cursos/${course.slug}/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 opacity-80">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside>
          <div className="card space-y-4 p-5 lg:sticky lg:top-8">
            {hasAccess ? (
              <>
                <p className="text-sm text-muted">
                  {isOwner ? "Você é o professor deste curso." : "Você tem acesso a todos os episódios."}
                </p>
                {nextUp?.video_path ? (
                  <Link href={`/cursos/${course.slug}/${nextUp.id}`} className="btn btn-primary w-full">
                    <PlayIcon size={16} /> {watched.size > 0 ? "Continuar assistindo" : "Começar a assistir"}
                  </Link>
                ) : null}
                {isOwner ? (
                  <Link href={`/estudio/${course.id}`} className="btn btn-secondary w-full">
                    Editar no Estúdio
                  </Link>
                ) : null}
                {enrollment?.stripe_subscription_id ? (
                  <form action={openBillingPortal}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <SubmitButton className="btn btn-secondary w-full" pendingLabel="Abrindo…">
                      Gerenciar assinatura
                    </SubmitButton>
                  </form>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <p className="text-2xl font-semibold">{priceLabel}</p>
                  <p className="mt-1 text-sm text-muted">
                    {monthly
                      ? "Assinatura mensal. Episódios novos toda semana, cancele quando quiser."
                      : "Pagamento único. Acesso a todos os episódios, inclusive os próximos."}
                  </p>
                </div>
                <form action={startCheckout}>
                  <input type="hidden" name="course_id" value={course.id} />
                  <SubmitButton className="btn btn-primary w-full" pendingLabel="Abrindo pagamento…">
                    {monthly ? "Assinar o curso" : "Comprar o curso"}
                  </SubmitButton>
                </form>
                <p className="text-xs text-muted">Pagamento seguro pelo Stripe.</p>
              </>
            )}
            <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Episódios</dt>
                <dd>{released.length}</dd>
              </div>
              {latest ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Último lançamento</dt>
                  <dd>{formatDate(latest.release_at)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
