alter table webinars enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table follow_ups enable row level security;

create policy "Public read webinars"
  on webinars for select
  using (true);

create policy "Public create webinars"
  on webinars for insert
  with check (true);

create policy "Public read questions"
  on questions for select
  using (true);

create policy "Public create questions"
  on questions for insert
  with check (true);

create policy "Public update question triage"
  on questions for update
  using (true)
  with check (true);

create policy "Public read answers"
  on answers for select
  using (true);

create policy "Public create answers"
  on answers for insert
  with check (true);

create policy "Public update answer votes"
  on answers for update
  using (true)
  with check (true);

create policy "Public read follow ups"
  on follow_ups for select
  using (true);

create policy "Public create follow ups"
  on follow_ups for insert
  with check (true);
