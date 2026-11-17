import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon, CheckIcon, LockIcon } from "@/components/icons";
import { toggleEpisodeWatched } from "../../actions";

export default async function EpisodePage({ params }: PageProps<"/cursos/[slug]/[episodeId]">) {
  const { slug, episodeId } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("id, slug, title").eq("slug", slug).maybeSingle();
  if (!course) notFound();

  const [{ data: episodes }, { data: hasAccess }, { data: progress }] = await Promise.all([
    supabase
      .from("episodes")
      .select("id, title, description, video_path, is_free_preview, release_at")
      .eq("course_id", course.id)
      .lte("release_at", new Date(await requestNow()).toISOString())
      .order("release_at", { ascending: true }),
    supabase.rpc("has_course_access", { p_course: course.id }),
    supabase.from("episode_progress").select("episode_id").eq("user_id", viewer.id),
  ]);

  const list = episodes ?? [];
  const index = list.findIndex((e) => e.id === episodeId);
  const episode = list[index];
  if (!episode) notFound();
  if (!hasAccess && !episode.is_free_preview) redirect(`/cursos/${course.slug}`);

  // Link assinado de 3 h, gerado só se o RLS do storage permitir (acesso ao curso ou prévia grátis).
  const { data: signed } = episode.video_path
    ? await supabase.storage.from("course-videos").createSignedUrl(episode.video_path, 60 * 60 * 3)
    : { data: null };

  const watched = new Set((progress ?? []).map((p) => p.episode_id as string));
  const isWatched = watched.has(episode.id);
  const prev = list[index - 1];
  const next = list[index + 1];
  const path = `/cursos/${course.slug}/${episode.id}`;

  return (
    <>
      <Link href={`/cursos/${course.slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> {course.title}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {signed?.signedUrl ? (
            <video
              key={episode.id}
              src={signed.signedUrl}
              controls
              controlsList="nodownload"
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-[#111] text-sm text-white/70">
              Vídeo indisponível no momento.
            </div>
          )}

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold">{episode.title}</h1>
              <p className="mt-1 text-sm text-muted">
                Episódio {index + 1} · {formatDate(episode.release_at)}
              </p>
            </div>
            <form action={toggleEpisodeWatched} className="shrink-0">
              <input type="hidden" name="episode_id" value={episode.id} />
              <input type="hidden" name="watched" value={isWatched ? "1" : "0"} />
              <input type="hidden" name="path" value={path} />
              <SubmitButton className={`btn ${isWatched ? "btn-secondary" : "btn-primary"}`}>
                <CheckIcon size={16} /> {isWatched ? "Assistido" : "Marcar como assistido"}
              </SubmitButton>
            </form>
          </div>
          {episode.description ? (
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-ink/85">{episode.description}</p>
          ) : null}

          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            {prev ? (
              <Link href={`/cursos/${course.slug}/${prev.id}`} className="btn btn-secondary">
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/cursos/${course.slug}/${next.id}`} className="btn btn-secondary">
                Próximo →
              </Link>
            ) : null}
          </div>
        </div>

        <aside>
          <h2 className="mb-3 text-sm font-semibold">Episódios do curso</h2>
          <ol className="space-y-1">
            {list.map((e, i) => {
              const canWatch = hasAccess || e.is_free_preview;
              const current = e.id === episode.id;
              const inner = (
                <>
                  <span className="w-5 shrink-0 text-xs text-muted">
                    {watched.has(e.id) ? <CheckIcon size={14} className="text-accent" /> : i + 1}
                  </span>
                  <span className="flex-1 truncate">{e.title}</span>
                  {!canWatch ? <LockIcon size={14} className="text-muted" /> : null}
                </>
              );
              return (
                <li key={e.id}>
                  {canWatch ? (
                    <Link
                      href={`/cursos/${course.slug}/${e.id}`}
                      aria-current={current ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        current ? "bg-accent-soft font-medium text-accent" : "hover:bg-black/5"
                      }`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </>
  );
}
