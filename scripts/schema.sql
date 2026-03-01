-- ============================================================
-- PaperPulse Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Papers table
create table if not exists papers (
  id          text primary key,          -- sha256 of DOI or title
  title       text not null,
  authors     text,
  journal     text,
  category    text,                       -- "OM/IS" | "Marketing" | "CS/AI" etc.
  abstract    text,
  doi         text,
  url         text,
  pub_date    date,
  tags        text[],                     -- array of tag strings
  fetched_at  timestamptz default now(),

  -- Full-text search index
  fts         tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, ''))
  ) stored
);

-- Index for fast queries
create index if not exists papers_pub_date_idx on papers(pub_date desc);
create index if not exists papers_journal_idx  on papers(journal);
create index if not exists papers_fts_idx      on papers using gin(fts);

-- Enable Row Level Security (keep data public for reading)
alter table papers enable row level security;

create policy "Public read access"
  on papers for select
  using (true);

-- ============================================================
-- Optional: saved_papers table for user bookmarks
-- (use Supabase Auth for user management)
-- ============================================================

create table if not exists saved_papers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  paper_id   text references papers(id) on delete cascade,
  notes      text,
  saved_at   timestamptz default now(),
  unique(user_id, paper_id)
);

alter table saved_papers enable row level security;

create policy "Users can manage their own saved papers"
  on saved_papers for all
  using (auth.uid() = user_id);

-- ============================================================
-- Verify setup: run this after inserting some data
-- ============================================================
-- select count(*), journal from papers group by journal order by count desc;
