-- Funções auxiliares: só usuários logados executam (são usadas pelas regras de RLS).
-- Funções de gatilho: ninguém chama direto pela API.

revoke execute on function
  public.handle_new_user(),
  public.handle_new_community(),
  public.handle_new_live(),
  public.bump_conversation(),
  public.touch_updated_at()
from public, anon, authenticated;

revoke execute on function
  public.is_teacher(),
  public.is_student_of(uuid),
  public.is_class_participant(uuid),
  public.owns_course(uuid),
  public.has_course_access(uuid),
  public.can_watch_live(uuid),
  public.is_community_member(uuid),
  public.is_community_moderator(uuid),
  public.can_access_conversation(uuid)
from public, anon;

grant execute on function
  public.is_teacher(),
  public.is_student_of(uuid),
  public.is_class_participant(uuid),
  public.owns_course(uuid),
  public.has_course_access(uuid),
  public.can_watch_live(uuid),
  public.is_community_member(uuid),
  public.is_community_moderator(uuid),
  public.can_access_conversation(uuid)
to authenticated;
