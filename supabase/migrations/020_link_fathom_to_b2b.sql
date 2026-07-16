alter table fathom_calls
  add column if not exists b2b_tracker_id uuid references b2b_sales_tracker(id) on delete set null;

create index if not exists fathom_calls_b2b_tracker_id_idx on fathom_calls(b2b_tracker_id);
