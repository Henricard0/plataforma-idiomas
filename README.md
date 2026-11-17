# Plataforma de idiomas

Plataforma para os professores darem aulas ao vivo, compartilharem materiais e venderem
**cursos gravados com episódios semanais**, além de lives, chat e comunidades por idioma.

## O que tem

| Área | Professor | Aluno |
| --- | --- | --- |
| **Aulas ao vivo** (`/aulas`) | Agenda aulas, escolhe os alunos, abre a sala de vídeo | Vê a agenda e entra na sala (abre 15 min antes) |
| **Materiais** (`/materiais`) | Envia arquivos para todos os alunos dele ou só para uma aula | Baixa o que foi compartilhado com ele |
| **Cursos gravados** (`/cursos`, `/estudio`) | Cria cursos, sobe episódios e **agenda o lançamento da semana**; define preço mensal ou único; libera acesso de bônus | Compra/assina pelo Stripe, assiste, marca como assistido, vê "novos esta semana" |
| **Lives** (`/lives`) | Agenda, inicia e encerra; pode deixar exclusiva para assinantes de um curso | Assiste e conversa no chat da live; a página atualiza sozinha quando a live começa |
| **Mensagens** (`/mensagens`) | Conversa com cada aluno e cria grupos de conversação | Conversa com os professores e participa dos grupos |
| **Comunidades** (`/comunidades`) | Cria comunidades por idioma (é moderador) | Participa, publica, comenta e usa o chat da comunidade |
| **Meus alunos** (`/alunos`) | Adiciona alunos pelo e-mail | — |

## Tecnologias

- **Next.js 16** (App Router, Server Actions) + Tailwind CSS 4
- **Supabase**: login, banco Postgres, arquivos (Storage) e chat em tempo real (Realtime).
  Toda a segurança fica no banco, com **Row Level Security**: cada consulta só devolve o que a pessoa pode ver.
- **LiveKit**: vídeo das aulas (todos falam) e das lives (professor transmite, público assiste)
- **Stripe**: checkout dos cursos (assinatura mensal ou pagamento único), portal para o aluno cancelar a assinatura

## Como rodar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem (`0001_init.sql`, depois `0002_harden_functions.sql`), ou use `npx supabase db push` com a CLI.
3. Em **Authentication → URL Configuration**, coloque a URL do site e adicione `https://SEU-SITE/auth/confirm` nas Redirect URLs.
   Para testes, você pode desligar **Confirm email** (Authentication → Sign In / Providers → Email): o envio de e-mail embutido do Supabase só manda poucos e-mails por hora.
4. Em **Storage → Settings**, ajuste o tamanho máximo de upload para os vídeos (o padrão é 50 MB).

### 2. LiveKit

Crie um projeto em [cloud.livekit.io](https://cloud.livekit.io) (tem plano gratuito) e copie URL, API key e secret.

### 3. Stripe

1. Pegue a chave secreta em **Developers → API keys**.
2. Crie um webhook apontando para `https://SEU-SITE/api/webhooks/stripe` com os eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Ative o **Customer portal** (Settings → Billing → Customer portal) para os alunos gerenciarem a assinatura.
4. Para aceitar **Pix**, ative em Settings → Payment methods (o checkout mostra automaticamente).

Para testar localmente: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4. App

```bash
cp .env.example .env.local   # preencha as chaves
npm install
npm run dev
```

### 5. Transformar as contas dos professores em "professor"

Os dois professores criam a conta normalmente pelo site. Depois, no SQL Editor do Supabase:

```sql
update public.profiles set role = 'teacher'
where id in (select id from auth.users where email in ('professor1@email.com', 'professor2@email.com'));
```

Ninguém consegue virar professor pelo site: o papel só muda por SQL ou pelo painel do Supabase.

## Fluxo do dia a dia

1. O aluno cria a conta no site.
2. O professor adiciona o aluno em **Meus alunos** (pelo e-mail).
3. O professor agenda a aula em **Aulas ao vivo** e escolhe os alunos. Na hora, os dois entram na sala pela plataforma.
4. Materiais podem ir para todos os alunos ou só para uma aula.
5. Toda semana o professor grava o episódio, envia no **Estúdio** e agenda a data de lançamento.
   Alunos que assinam veem "novo esta semana" no painel e no catálogo.

## Testes do banco

```bash
npm run test:db
```

Roda 64 cenários das regras de acesso (RLS) num Postgres em memória: aluno não vê aula de outro, não baixa
material de outro professor, não assiste vídeo de curso sem pagar, não se promove a professor, não lê conversa
alheia, não manda mensagem em nome de outra pessoa etc.

## Próximos passos sugeridos

- **Gravar as lives** com o LiveKit Egress e publicar a gravação como episódio do curso.
- **Notificações** por e-mail/WhatsApp: lembrete de aula, episódio novo, mensagem não lida.
- **Vídeo em streaming (HLS)** com Mux ou Bunny Stream quando o volume crescer: carrega mais rápido e dificulta download.
- **Aulas recorrentes** (ex.: toda terça às 19h) e cobrança das aulas particulares pela plataforma.
- **Mercado Pago ou Asaas** no lugar do Stripe, se preferir um gateway brasileiro.
- Traduzir os botões da sala de vídeo das aulas (o componente do LiveKit vem em inglês: "Microphone", "Leave"…).
- App instalável (PWA) para o celular.
