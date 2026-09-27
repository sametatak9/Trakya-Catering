-- Advisor 0006: "for all" yazma politikası SELECT'i de kapsıyordu; yazma işlemleri ayrı politikalara bölündü
drop policy if exists approval_policies_write on public.approval_policies;
drop policy if exists approval_policies_insert on public.approval_policies;
drop policy if exists approval_policies_update on public.approval_policies;
drop policy if exists approval_policies_delete on public.approval_policies;
create policy approval_policies_insert on public.approval_policies for insert to authenticated with check ((select public.has_role(array['kurucu'])));
create policy approval_policies_update on public.approval_policies for update to authenticated
  using ((select public.has_role(array['kurucu']))) with check ((select public.has_role(array['kurucu'])));
create policy approval_policies_delete on public.approval_policies for delete to authenticated using ((select public.has_role(array['kurucu'])));
