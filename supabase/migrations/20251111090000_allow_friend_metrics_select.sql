-- Allow accepted friends to view each other's study metrics
begin;

drop policy if exists "Users can view own metrics" on public.daily_metrics;

create policy "Users and friends can view metrics"
  on public.daily_metrics
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friends f
      where f.user_id = auth.uid()
        and f.friend_id = public.daily_metrics.user_id
        and f.status = 'accepted'
    )
  );

commit;

