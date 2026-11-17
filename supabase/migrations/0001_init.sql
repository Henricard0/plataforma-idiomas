-- =====================================================================
-- Plataforma de idiomas: esquema inicial
--   perfis e papéis · alunos do professor · aulas ao vivo · materiais
--   cursos gravados (episódios semanais) e matrículas · lives
--   conversas (diretas, grupos, comunidade, live) · comunidades
--   buckets de storage e regras de acesso (RLS)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.billing_type as enum ('one_time', 'monthly');
create type public.enrollment_status as enum ('pending', 'active', 'canceled');
create type public.live_status as enum ('scheduled', 'live', 'ended');
create type public.conversation_kind as enum ('direct', 'group', 'community', 'live');

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  bio text,
  avatar_url text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- Alunos de cada professor
-- ---------------------------------------------------------------------
create table public.teacher_students (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id),
  check (teacher_id <> student_id)
);
create index teacher_students_student_idx on public.teacher_students (student_id);

create or replace function public.is_student_of(p_teacher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_students
    where teacher_id = p_teacher and student_id = auth.uid()
  );
$$;

-- Professores procuram alunos pelo e-mail sem que e-mails fiquem visíveis a todos.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where public.is_teacher()
    and lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Aulas ao vivo (videochamada com o professor)
-- ---------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  language text not null,
  starts_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min between 15 and 240),
  notes text,
  room_name text not null unique default ('aula-' || gen_random_uuid()::text),
  created_at timestamptz not null default now()
);
create index classes_teacher_idx on public.classes (teacher_id, starts_at);

create table public.class_students (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (class_id, student_id)
);
create index class_students_student_idx on public.class_students (student_id);

create or replace function public.is_class_participant(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes where id = p_class and teacher_id = auth.uid())
      or exists (select 1 from public.class_students where class_id = p_class and student_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Materiais (arquivos no bucket "materials", pasta = id do professor)
--   class_id nulo  -> visível para todos os alunos do professor
--   class_id preenchido -> visível só para os alunos daquela aula
-- ---------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  language text,
  file_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index materials_teacher_idx on public.materials (teacher_id, created_at desc);
create index materials_class_idx on public.materials (class_id);

-- ---------------------------------------------------------------------
-- Cursos gravados, episódios semanais e matrículas
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 140),
  description text,
  language text not null,
  level text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'brl',
  billing public.billing_type not null default 'monthly',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  video_path text unique,
  duration_sec integer,
  is_free_preview boolean not null default false,
  -- data de lançamento: permite agendar os episódios da semana com antecedência
  release_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index episodes_course_idx on public.episodes (course_id, release_at);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status public.enrollment_status not null default 'pending',
  provider text not null default 'stripe' check (provider in ('stripe', 'manual')),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);

create table public.episode_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger enrollments_touch
  before update on public.enrollments
  for each row execute function public.touch_updated_at();

create or replace function public.owns_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses where id = p_course and teacher_id = auth.uid());
$$;

create or replace function public.has_course_access(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.courses c
           where c.id = p_course
             and (c.teacher_id = auth.uid() or (c.published and c.price_cents = 0))
         )
      or exists (
           select 1 from public.enrollments e
           where e.course_id = p_course and e.user_id = auth.uid() and e.status = 'active'
         );
$$;

-- ---------------------------------------------------------------------
-- Lives (transmissões para muitos alunos)
--   course_id preenchido -> exclusiva para quem tem acesso ao curso
-- ---------------------------------------------------------------------
create table public.lives (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text,
  language text,
  course_id uuid references public.courses (id) on delete set null,
  scheduled_at timestamptz not null,
  status public.live_status not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  room_name text not null unique default ('live-' || gen_random_uuid()::text),
  created_at timestamptz not null default now()
);
create index lives_schedule_idx on public.lives (status, scheduled_at);

create or replace function public.can_watch_live(p_live uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lives l
    where l.id = p_live
      and auth.uid() is not null
      and (l.host_id = auth.uid() or l.course_id is null or public.has_course_access(l.course_id))
  );
$$;

-- ---------------------------------------------------------------------
-- Comunidades de idiomas
-- ---------------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  language text not null,
  description text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index posts_community_idx on public.posts (community_id, created_at desc);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

create or replace function public.is_community_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = auth.uid()
  );
$$;

create or replace function public.is_community_moderator(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = auth.uid() and role = 'moderator'
  );
$$;

-- ---------------------------------------------------------------------
-- Conversas e mensagens (chat em tempo real)
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  title text,
  community_id uuid unique references public.communities (id) on delete cascade,
  live_id uuid unique references public.lives (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id desc);

create or replace function public.can_access_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and (
        exists (
          select 1 from public.conversation_members m
          where m.conversation_id = c.id and m.user_id = auth.uid()
        )
        or (c.kind = 'community' and public.is_community_member(c.community_id))
        or (c.kind = 'live' and public.can_watch_live(c.live_id))
      )
  );
$$;

create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- Cada comunidade nasce com um chat e com o criador como moderador.
create or replace function public.handle_new_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (kind, title, community_id, created_by)
  values ('community', new.name, new.id, new.created_by);
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id, role)
    values (new.id, new.created_by, 'moderator')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_community_created
  after insert on public.communities
  for each row execute function public.handle_new_community();

-- Cada live nasce com um chat.
create or replace function public.handle_new_live()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (kind, title, live_id, created_by)
  values ('live', new.title, new.id, new.host_id);
  return new;
end;
$$;

create trigger on_live_created
  after insert on public.lives
  for each row execute function public.handle_new_live();

create or replace function public.get_or_create_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'invalid participant';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'user not found';
  end if;

  select c.id into v_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.user_id = v_me
  join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_other
  where c.kind = 'direct'
  limit 1;

  if v_id is null then
    insert into public.conversations (kind, created_by) values ('direct', v_me) returning id into v_id;
    insert into public.conversation_members (conversation_id, user_id) values (v_id, v_me), (v_id, p_other);
  end if;

  return v_id;
end;
$$;

-- Grupos de conversação: o professor cria e adiciona alunos dele.
create or replace function public.create_group_conversation(p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_teacher() then
    raise exception 'only teachers can create groups';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title required';
  end if;

  insert into public.conversations (kind, title, created_by)
  values ('group', trim(p_title), v_me)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id)
  select v_id, s.uid
  from (select distinct unnest(coalesce(p_members, '{}') || v_me) as uid) s
  where s.uid = v_me
     or exists (
          select 1 from public.teacher_students ts
          where ts.teacher_id = v_me and ts.student_id = s.uid
        );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de funções
-- ---------------------------------------------------------------------
revoke execute on function public.find_profile_by_email(text) from public, anon;
revoke execute on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke execute on function public.create_group_conversation(text, uuid[]) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teacher_students enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.materials enable row level security;
alter table public.courses enable row level security;
alter table public.episodes enable row level security;
alter table public.enrollments enable row level security;
alter table public.episode_progress enable row level security;
alter table public.lives enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Perfis: nomes visíveis a quem está logado; cada um edita o próprio
-- (o papel só muda pelo painel do Supabase ou por SQL do administrador).
create policy "profiles: leitura" on public.profiles
  for select to authenticated using (true);
create policy "profiles: editar o próprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, bio, avatar_url) on public.profiles to authenticated;

-- Alunos do professor
create policy "teacher_students: professor e aluno veem" on public.teacher_students
  for select to authenticated using (teacher_id = auth.uid() or student_id = auth.uid());
create policy "teacher_students: professor adiciona" on public.teacher_students
  for insert to authenticated with check (teacher_id = auth.uid() and public.is_teacher());
create policy "teacher_students: professor remove" on public.teacher_students
  for delete to authenticated using (teacher_id = auth.uid());

-- Aulas
create policy "classes: participantes veem" on public.classes
  -- teacher_id direto primeiro: um INSERT ... RETURNING não enxerga a linha nova dentro da função
  for select to authenticated using (teacher_id = auth.uid() or public.is_class_participant(id));
create policy "classes: professor cria" on public.classes
  for insert to authenticated with check (teacher_id = auth.uid() and public.is_teacher());
create policy "classes: professor edita" on public.classes
  for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "classes: professor apaga" on public.classes
  for delete to authenticated using (teacher_id = auth.uid());

create policy "class_students: participantes veem" on public.class_students
  for select to authenticated using (student_id = auth.uid() or public.is_class_participant(class_id));
create policy "class_students: professor adiciona alunos dele" on public.class_students
  for insert to authenticated with check (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
    and exists (
      select 1 from public.teacher_students ts
      where ts.teacher_id = auth.uid() and ts.student_id = class_students.student_id
    )
  );
create policy "class_students: professor remove" on public.class_students
  for delete to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

-- Materiais
create policy "materials: professor e alunos com acesso veem" on public.materials
  for select to authenticated using (
    teacher_id = auth.uid()
    or (class_id is null and public.is_student_of(teacher_id))
    or (
      class_id is not null and exists (
        select 1 from public.class_students cs
        where cs.class_id = materials.class_id and cs.student_id = auth.uid()
      )
    )
  );
create policy "materials: professor publica" on public.materials
  for insert to authenticated with check (
    teacher_id = auth.uid()
    and public.is_teacher()
    and file_path like auth.uid()::text || '/%'
    and (
      class_id is null
      or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
    )
  );
create policy "materials: professor apaga" on public.materials
  for delete to authenticated using (teacher_id = auth.uid());

-- Cursos
create policy "courses: publicados ou do próprio professor" on public.courses
  for select to authenticated using (published or teacher_id = auth.uid());
create policy "courses: professor cria" on public.courses
  for insert to authenticated with check (teacher_id = auth.uid() and public.is_teacher());
create policy "courses: professor edita" on public.courses
  for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "courses: professor apaga" on public.courses
  for delete to authenticated using (teacher_id = auth.uid());

-- Episódios: a lista aparece para todos (com cadeado); o vídeo só abre para quem tem acesso
-- (ver política do bucket "course-videos"). Episódios agendados só o professor vê.
create policy "episodes: lançados de cursos publicados" on public.episodes
  for select to authenticated using (
    public.owns_course(course_id)
    or (
      release_at <= now()
      and exists (select 1 from public.courses c where c.id = course_id and c.published)
    )
  );
create policy "episodes: professor cria" on public.episodes
  for insert to authenticated with check (public.owns_course(course_id));
create policy "episodes: professor edita" on public.episodes
  for update to authenticated using (public.owns_course(course_id)) with check (public.owns_course(course_id));
create policy "episodes: professor apaga" on public.episodes
  for delete to authenticated using (public.owns_course(course_id));

-- Matrículas: pagamentos entram pelo webhook (service role).
-- O professor pode liberar acesso manual (ex.: bônus para aluno particular).
create policy "enrollments: aluno e professor do curso veem" on public.enrollments
  for select to authenticated using (user_id = auth.uid() or public.owns_course(course_id));
create policy "enrollments: professor libera manualmente" on public.enrollments
  for insert to authenticated with check (public.owns_course(course_id) and provider = 'manual');
create policy "enrollments: professor altera manuais" on public.enrollments
  for update to authenticated
  using (public.owns_course(course_id) and provider = 'manual')
  with check (public.owns_course(course_id) and provider = 'manual');
create policy "enrollments: professor remove manuais" on public.enrollments
  for delete to authenticated using (public.owns_course(course_id) and provider = 'manual');

create policy "episode_progress: o próprio aluno" on public.episode_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lives
create policy "lives: todos logados veem a agenda" on public.lives
  for select to authenticated using (true);
create policy "lives: professor agenda" on public.lives
  for insert to authenticated with check (
    host_id = auth.uid() and public.is_teacher()
    and (course_id is null or public.owns_course(course_id))
  );
create policy "lives: professor edita" on public.lives
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "lives: professor apaga" on public.lives
  for delete to authenticated using (host_id = auth.uid());

-- Comunidades
create policy "communities: todos logados veem" on public.communities
  for select to authenticated using (true);
create policy "communities: professor cria" on public.communities
  for insert to authenticated with check (public.is_teacher() and created_by = auth.uid());
create policy "communities: criador ou moderador edita" on public.communities
  for update to authenticated
  using (created_by = auth.uid() or public.is_community_moderator(id))
  with check (created_by = auth.uid() or public.is_community_moderator(id));
create policy "communities: criador apaga" on public.communities
  for delete to authenticated using (created_by = auth.uid());

create policy "community_members: todos logados veem" on public.community_members
  for select to authenticated using (true);
create policy "community_members: entrar" on public.community_members
  for insert to authenticated with check (user_id = auth.uid() and role = 'member');
create policy "community_members: sair ou moderador remove" on public.community_members
  for delete to authenticated using (user_id = auth.uid() or public.is_community_moderator(community_id));

create policy "posts: todos logados leem" on public.posts
  for select to authenticated using (true);
create policy "posts: membros publicam" on public.posts
  for insert to authenticated with check (author_id = auth.uid() and public.is_community_member(community_id));
create policy "posts: autor ou moderador apaga" on public.posts
  for delete to authenticated using (author_id = auth.uid() or public.is_community_moderator(community_id));

create policy "post_comments: todos logados leem" on public.post_comments
  for select to authenticated using (true);
create policy "post_comments: membros comentam" on public.post_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_community_member(p.community_id)
    )
  );
create policy "post_comments: autor ou moderador apaga" on public.post_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_community_moderator(p.community_id)
    )
  );

-- Conversas e mensagens
create policy "conversations: quem tem acesso vê" on public.conversations
  for select to authenticated using (public.can_access_conversation(id));

create policy "conversation_members: quem tem acesso vê" on public.conversation_members
  for select to authenticated using (user_id = auth.uid() or public.can_access_conversation(conversation_id));
create policy "conversation_members: marcar como lido" on public.conversation_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.conversation_members from anon, authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

create policy "messages: quem tem acesso lê" on public.messages
  for select to authenticated using (public.can_access_conversation(conversation_id));
create policy "messages: quem tem acesso envia" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.can_access_conversation(conversation_id)
  );
create policy "messages: autor apaga" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime: chat e status das lives
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.lives;

-- ---------------------------------------------------------------------
-- Storage
--   materials      privado · {professor_id}/arquivo
--   course-videos  privado · {professor_id}/{curso_id}/video.mp4
--   public-assets  público · capas e avatares
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('materials', 'materials', false),
  ('course-videos', 'course-videos', false),
  ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

create policy "materials: professor envia na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'materials'
    and public.is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "materials: leitura para quem tem acesso" on storage.objects
  for select to authenticated using (
    bucket_id = 'materials'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      -- a tabela materials já filtra por RLS quem pode ver cada arquivo
      or exists (select 1 from public.materials m where m.file_path = storage.objects.name)
    )
  );
create policy "materials: professor apaga os próprios" on storage.objects
  for delete to authenticated using (
    bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "course-videos: professor envia na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'course-videos'
    and public.is_teacher()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "course-videos: assistir com acesso ao curso" on storage.objects
  for select to authenticated using (
    bucket_id = 'course-videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.episodes e
        where e.video_path = storage.objects.name
          and (e.is_free_preview or public.has_course_access(e.course_id))
      )
    )
  );
create policy "course-videos: professor apaga os próprios" on storage.objects
  for delete to authenticated using (
    bucket_id = 'course-videos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public-assets: envio na própria pasta" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'public-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "public-assets: apagar os próprios" on storage.objects
  for delete to authenticated using (
    bucket_id = 'public-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
