-- ═══════════════════════════════════════════════════════════════
-- BOT ZALO: GHI LƯỢT 5S CHƯA ĐẠT ĐÃ BÁO CHO NHÂN VIÊN
-- Chạy 1 lần, Supabase → SQL Editor → Run. Xem worker/BAO-5S-ZALO.md.
-- ═══════════════════════════════════════════════════════════════
-- Mỗi lượt chưa đạt (s5_checks.id) chỉ báo cho nhân viên MỘT lần. Lượt
-- không có dòng ở đây = chưa báo -> sẽ được báo bù khi người đó liên kết.
-- Để riêng bảng, không ghi vào s5_checks: khoá anon chỉ được ĐỌC s5_checks
-- (sql/5s-siet-rls.sql).

create table if not exists public.zalo_bao_5s (
  s5_id    bigint      primary key,           -- s5_checks.id
  msnv     text        not null default '',
  zalo_id  text        not null default '',
  cach     text        not null default 'tuc_thi'
           check (cach in ('tuc_thi', 'bao_bu')),
  bao_luc  timestamptz not null default now()
);

alter table public.zalo_bao_5s enable row level security;
drop policy if exists zalo_bao_5s_anon_all on public.zalo_bao_5s;
create policy zalo_bao_5s_anon_all on public.zalo_bao_5s
  for all to anon using (true) with check (true);
