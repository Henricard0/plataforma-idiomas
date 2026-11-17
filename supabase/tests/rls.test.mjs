// Testa as regras de acesso (RLS) do banco num Postgres em memória (PGlite).
// Rode com: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
grant usage on schema storage to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`
await db.exec(stubs)
await db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))
console.log('migration applied OK')

const T = '11111111-1111-1111-1111-111111111111'
const S1 = '22222222-2222-2222-2222-222222222222'
const S2 = '33333333-3333-3333-3333-333333333333'
await db.exec(`
insert into auth.users (id, email, raw_user_meta_data) values
 ('${T}', 'prof@x.com', '{"full_name":"Profa Ana"}'),
 ('${S1}', 'aluno1@x.com', '{}'),
 ('${S2}', 'aluno2@x.com', '{"full_name":"Bia"}');
update public.profiles set role = 'teacher' where id = '${T}';
`)

let failures = 0
async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
async function expectRows(label, uid, sql, n) {
  const r = await as(uid, sql); const ok = r.rows.length === n
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (got ${r.rows.length}, want ${n})`)
  return r
}
async function expectError(label, uid, sql) {
  try { await as(uid, sql); failures++; console.log(`FAIL ${label} (no error)`) }
  catch (e) { console.log(`PASS ${label} -> ${e.message.slice(0, 70)}`) }
}
async function expectOk(label, uid, sql) {
  try { const r = await as(uid, sql); console.log(`PASS ${label}`); return r }
  catch (e) { failures++; console.log(`FAIL ${label} -> ${e.message}`) }
}

await expectRows('profile names from metadata', T, `select full_name from profiles where full_name in ('Profa Ana','aluno1','Bia')`, 3)
await expectError('student cannot promote self', S1, `update profiles set role='teacher' where id='${S1}'`)
await expectOk('student edits own name', S1, `update profiles set full_name='Caio' where id='${S1}'`)
await expectError('student cannot add roster', S1, `insert into teacher_students values ('${S1}','${S2}')`)
await expectRows('teacher finds by email', T, `select * from find_profile_by_email('ALUNO1@x.com ')`, 1)
await expectRows('student cannot find by email', S1, `select * from find_profile_by_email('aluno2@x.com')`, 0)
await expectOk('teacher adds S1 to roster', T, `insert into teacher_students (teacher_id, student_id) values ('${T}','${S1}')`)

const cls = await expectOk('teacher creates class', T, `insert into classes (teacher_id,title,language,starts_at) values ('${T}','Inglês B1','en', now() + interval '1 day') returning id`)
const classId = cls.rows[0].id
await expectOk('teacher adds S1 to class', T, `insert into class_students values ('${classId}','${S1}')`)
await expectError('teacher cannot add non-roster S2', T, `insert into class_students values ('${classId}','${S2}')`)
await expectRows('S1 sees class', S1, `select * from classes`, 1)
await expectRows('S2 sees no class', S2, `select * from classes`, 0)
await expectRows('S1 sees class members', S1, `select * from class_students`, 1)

await expectOk('teacher material (class)', T, `insert into materials (teacher_id,class_id,title,file_path,file_name) values ('${T}','${classId}','Vocab','${T}/vocab.pdf','vocab.pdf')`)
await expectOk('teacher material (all students)', T, `insert into materials (teacher_id,title,file_path,file_name) values ('${T}','Gramática','${T}/gram.pdf','gram.pdf')`)
await expectError('teacher material in other folder', T, `insert into materials (teacher_id,title,file_path,file_name) values ('${T}','X','${S1}/x.pdf','x.pdf')`)
await expectRows('S1 sees 2 materials', S1, `select * from materials`, 2)
await expectRows('S2 sees 0 materials', S2, `select * from materials`, 0)
await expectOk('teacher uploads storage object', T, `insert into storage.objects (bucket_id,name) values ('materials','${T}/vocab.pdf'),('materials','${T}/gram.pdf'),('materials','${T}/secret.pdf')`)
await expectError('student cannot upload material', S1, `insert into storage.objects (bucket_id,name) values ('materials','${S1}/a.pdf')`)
await expectRows('S1 reads 2 linked objects', S1, `select * from storage.objects where bucket_id='materials'`, 2)
await expectRows('S2 reads 0 objects', S2, `select * from storage.objects where bucket_id='materials'`, 0)

const course = await expectOk('teacher creates course', T, `insert into courses (teacher_id,slug,title,language,price_cents,published) values ('${T}','ingles-semanal','Inglês semanal','en',4900,true) returning id`)
const courseId = course.rows[0].id
await expectOk('episodes', T, `insert into episodes (course_id,title,video_path,is_free_preview,release_at) values
  ('${courseId}','Ep 1','${T}/${courseId}/1.mp4',true, now() - interval '7 days'),
  ('${courseId}','Ep 2','${T}/${courseId}/2.mp4',false, now() - interval '1 hour'),
  ('${courseId}','Ep 3','${T}/${courseId}/3.mp4',false, now() + interval '6 days')`)
await expectOk('video objects', T, `insert into storage.objects (bucket_id,name) values ('course-videos','${T}/${courseId}/1.mp4'),('course-videos','${T}/${courseId}/2.mp4'),('course-videos','${T}/${courseId}/3.mp4')`)
await expectRows('student sees 2 released episodes', S2, `select * from episodes`, 2)
await expectRows('teacher sees 3 episodes', T, `select * from episodes`, 3)
await expectRows('no access: only free preview video', S2, `select * from storage.objects where bucket_id='course-videos'`, 1)
await expectRows('has_course_access false', S2, `select 1 where has_course_access('${courseId}')`, 0)
await expectError('student cannot self-enroll', S2, `insert into enrollments (user_id,course_id,status) values ('${S2}','${courseId}','active')`)
await db.exec(`insert into enrollments (user_id,course_id,status) values ('${S2}','${courseId}','active')`) // webhook (service role)
await expectRows('enrolled: 2 released videos', S2, `select * from storage.objects where bucket_id='course-videos'`, 2)
await expectRows('S2 sees own enrollment', S2, `select * from enrollments`, 1)
await expectRows('S1 sees no enrollment', S1, `select * from enrollments`, 0)
await expectOk('teacher grants manual access to S1', T, `insert into enrollments (user_id,course_id,status,provider) values ('${S1}','${courseId}','active','manual')`)

await expectRows('teacher update on stripe row affects 0', T, `update enrollments set status='canceled' where user_id='${S2}' returning id`, 0)

const live = await expectOk('teacher schedules live', T, `insert into lives (host_id,title,scheduled_at) values ('${T}','Live de pronúncia', now()) returning id`)
const liveId = live.rows[0].id
const exclusive = await expectOk('exclusive live', T, `insert into lives (host_id,title,scheduled_at,course_id) values ('${T}','Live VIP', now(), '${courseId}') returning id`)
await expectError('student cannot create live', S1, `insert into lives (host_id,title,scheduled_at) values ('${S1}','x', now())`)
await expectRows('live chat accessible', S1, `select * from conversations where live_id='${liveId}'`, 1)
await expectOk('S1 messages in live chat', S1, `insert into messages (conversation_id, body) select id, 'oi!' from conversations where live_id='${liveId}'`)
await expectRows('S1 (manual access) sees VIP chat', S1, `select * from conversations where live_id='${exclusive.rows[0].id}'`, 1)
await db.exec(`delete from enrollments where user_id='${S1}'`)
await expectRows('S1 without access: no VIP chat', S1, `select * from conversations where live_id='${exclusive.rows[0].id}'`, 0)

const dm = await expectOk('S1 opens DM with teacher', S1, `select get_or_create_direct_conversation('${T}') as id`)
const dm2 = await expectOk('DM is reused', T, `select get_or_create_direct_conversation('${S1}') as id`)
if (dm.rows[0].id !== dm2.rows[0].id) { failures++; console.log('FAIL DM not reused') }
await expectOk('S1 sends DM', S1, `insert into messages (conversation_id, body) values ('${dm.rows[0].id}', 'Hello teacher')`)
await expectRows('S2 cannot read DM', S2, `select * from messages where conversation_id='${dm.rows[0].id}'`, 0)
await expectError('S2 cannot post into DM', S2, `insert into messages (conversation_id, body) values ('${dm.rows[0].id}', 'spam')`)
await expectError('cannot spoof sender', S1, `insert into messages (conversation_id, sender_id, body) values ('${dm.rows[0].id}', '${T}', 'fake')`)
await expectRows('last_message_at bumped', T, `select * from conversations where id='${dm.rows[0].id}' and last_message_at is not null`, 1)
const grp = await expectOk('teacher creates group', T, `select create_group_conversation('Turma B1', array['${S1}','${S2}']::uuid[]) as id`)
await expectRows('group has teacher + S1 only (S2 not in roster)', T, `select * from conversation_members where conversation_id='${grp.rows[0].id}'`, 2)
await expectError('student cannot create group', S1, `select create_group_conversation('x', array[]::uuid[])`)

const com = await expectOk('teacher creates community', T, `insert into communities (slug,name,language,created_by) values ('ingles','Inglês','en','${T}') returning id`)
const comId = com.rows[0].id
await expectError('student cannot create community', S1, `insert into communities (slug,name,language,created_by) values ('x','X','en','${S1}')`)
await expectError('non-member cannot post', S2, `insert into posts (community_id, body) values ('${comId}', 'hi')`)
await expectRows('non-member cannot see community chat', S2, `select * from conversations where community_id='${comId}'`, 0)
await expectError('cannot join as moderator', S2, `insert into community_members (community_id,user_id,role) values ('${comId}','${S2}','moderator')`)
await expectOk('S2 joins', S2, `insert into community_members (community_id,user_id) values ('${comId}','${S2}')`)
const post = await expectOk('S2 posts', S2, `insert into posts (community_id, body) values ('${comId}', 'Hi everyone') returning id`)
await expectRows('member sees community chat', S2, `select * from conversations where community_id='${comId}'`, 1)
await expectError('S1 (non-member) cannot comment', S1, `insert into post_comments (post_id, body) values ('${post.rows[0].id}', 'x')`)
await expectRows('teacher (moderator) deletes post', T, `delete from posts where id='${post.rows[0].id}' returning id`, 1)
await expectRows('S2 marks DM read: no rows (not member)', S2, `update conversation_members set last_read_at=now() where conversation_id='${dm.rows[0].id}' returning *`, 0)
await expectError('cannot change membership user', S1, `update conversation_members set user_id='${S2}' where conversation_id='${dm.rows[0].id}'`)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
