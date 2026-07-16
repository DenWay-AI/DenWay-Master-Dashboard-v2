create table if not exists fathom_calls (
  id uuid default gen_random_uuid() primary key,
  recording_id text unique not null,
  title text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  participants jsonb,
  transcript jsonb,
  has_transcript boolean default false,
  fathom_url text,
  category text default 'uncategorized' check (category in ('sales_call', 'other', 'uncategorized')),
  category_override boolean default false,
  synced_at timestamptz default now()
);

create index if not exists fathom_calls_started_at_idx on fathom_calls(started_at desc);
create index if not exists fathom_calls_category_idx on fathom_calls(category);
create index if not exists fathom_calls_recording_id_idx on fathom_calls(recording_id);
