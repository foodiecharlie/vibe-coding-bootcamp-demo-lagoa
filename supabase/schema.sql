create table if not exists webinars (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  host text not null,
  starts_at timestamptz not null,
  qa_window_days_before int not null default 14 check (qa_window_days_before in (7, 14)),
  qa_window_days_after int not null default 14 check (qa_window_days_after in (7, 14)),
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  author_name text,
  body text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'delayed', 'archived')),
  priority text not null default 'community' check (priority in ('community', 'host_pick', 'needs_followup')),
  upvotes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  responder_name text not null,
  body text not null,
  upvotes int not null default 0,
  visible_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
