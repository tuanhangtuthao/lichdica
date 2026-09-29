-- ═══════════════════════════════════════════════════════════════
-- BỔ SUNG CHO TRANG 5S: ghi nhận người đứng máy + tách theo ca
-- Chạy SAU 5s-setup.sql, 1 lần, trên Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CỘT MỚI ────────────────────────────────────────────────
alter table public.s5_checks
  add column if not exists shift       text     not null default 'S',  -- 'S' ca sáng, 'C' ca tối
  add column if not exists kip         smallint,                       -- kíp trực ca đó, chốt lúc chấm
  add column if not exists worker_name text     not null default '';   -- người đứng máy, sửa được khi lịch sai

-- ── 2. ĐỔI KHOÁ CHỐNG TRÙNG ───────────────────────────────────
-- Trước: mỗi ngày mỗi máy 1 dòng.
-- Giờ chọn ca lúc đi kiểm nên một ngày có thể chấm cả ca sáng lẫn ca tối
-- => khoá phải gồm cả ca, nếu không hai ca sẽ đè lên nhau.
-- Khoá này cũng chính là thứ lệnh upsert của trang dựa vào.
alter table public.s5_checks drop constraint if exists s5_checks_date_cell_uniq;
alter table public.s5_checks drop constraint if exists s5_checks_date_shift_cell_uniq;
alter table public.s5_checks
  add constraint s5_checks_date_shift_cell_uniq unique (date, shift, cell_id);

-- ── 3. INDEX CHO LỊCH SỬ VI PHẠM ──────────────────────────────
-- Tra "người này từng vi phạm những gì"
create index if not exists s5_checks_worker_idx on public.s5_checks (worker_name, date desc);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Chạy câu này phải thấy đủ các cột shift / kip / worker_name:
--   select column_name, data_type from information_schema.columns
--   where table_name = 's5_checks' order by ordinal_position;
--
-- Và thấy khoá mới gồm 3 cột date, shift, cell_id:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass and contype = 'u';
