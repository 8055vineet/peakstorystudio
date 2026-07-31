-- Phase 2 — the inquiry write path.
--
-- Phase 1b created public.inquiries and locked anon out of it entirely. Three
-- things the Edge Function needs that it did not provide:
--   1. somewhere to record whether the studio was actually told about a lead,
--   2. a ledger to rate-limit submissions per visitor,
--   3. an atomic way to consume one unit of that limit.

alter table public.inquiries
  add column notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'skipped'));

comment on column public.inquiries.notification_status is
  'Whether the studio notification email went out. ''skipped'' means email was
   never configured, ''failed'' means Resend rejected it. The row is saved
   either way — a lead is never lost because email broke. Without this column a
   silent Resend outage is indistinguishable from a week with no inquiries.';

-- Keyed by a salted SHA-256 of the submitter's IP, never the address itself,
-- so this table holds nothing that identifies a person on its own.
create table public.inquiry_rate_limits (
  ip_hash           text primary key,
  window_started_at timestamptz not null default now(),
  request_count     integer     not null default 0
);

comment on table public.inquiry_rate_limits is
  'Per-visitor inquiry counter, written only by the submit-inquiry Edge
   Function via consume_inquiry_rate_limit(). Not readable by anon at all.';

create index inquiry_rate_limits_window_idx
  on public.inquiry_rate_limits (window_started_at);

alter table public.inquiry_rate_limits enable row level security;

-- No policies at all: anon and authenticated get nothing. The Edge Function
-- reaches this table with the service-role key, which bypasses RLS. Base
-- grants are still required for service_role, because Postgres checks table
-- privileges before it ever evaluates a policy.
grant select, insert, update, delete
  on public.inquiry_rate_limits
  to service_role;

-- One statement does the window roll, the increment, and the read, so two
-- simultaneous requests cannot both pass a limit that admits only one.
create or replace function public.consume_inquiry_rate_limit(
  p_ip_hash      text,
  p_max_requests integer,
  p_window       interval
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_started_at timestamptz;
  v_request_count     integer;
begin
  -- Opportunistic prune. At this traffic the table never exceeds a few
  -- thousand rows, and this keeps it from growing without bound. The cutoff
  -- must never be shorter than the caller's own window — a bare interval
  -- '1 day' here would delete a still-live counter row out from under any
  -- caller using a window of a day or longer, silently defeating that
  -- caller's limit (the very next upsert would treat it as a fresh window).
  -- Do not "simplify" this back to a bare interval.
  delete from public.inquiry_rate_limits
   where window_started_at < now() - greatest(p_window, interval '1 day');

  insert into public.inquiry_rate_limits as l (ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
     set window_started_at = case
           when l.window_started_at < now() - p_window then now()
           else l.window_started_at
         end,
         request_count = case
           when l.window_started_at < now() - p_window then 1
           else l.request_count + 1
         end
  returning l.window_started_at, l.request_count
    into v_window_started_at, v_request_count;

  if v_request_count > p_max_requests then
    return query
      select false,
             greatest(
               1,
               ceil(extract(epoch from (v_window_started_at + p_window - now())))::integer
             );
    return;
  end if;

  return query select true, 0;
end;
$$;

comment on function public.consume_inquiry_rate_limit(text, integer, interval) is
  'Records one inquiry attempt for p_ip_hash and reports whether it is within
   p_max_requests per p_window. Rolls the window when the current one has
   expired. Callable only by service_role.';

revoke all on function public.consume_inquiry_rate_limit(text, integer, interval) from public;
grant execute on function public.consume_inquiry_rate_limit(text, integer, interval) to service_role;
