-- ═══════════════════════════════════════════════════════════════
-- CHO PHÉP KIỂM NHIỀU LƯỢT TRONG MỘT CA + BẮT BUỘC NHẬP NGƯỜI KIỂM
-- Chạy SAU 5s-update.sql, 1 lần, trên Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. BỎ GIỚI HẠN 1 PHIẾU MỖI MÁY MỖI CA ─────────────────────
-- Trước: khoá unique (date, shift, cell_id) => mỗi máy mỗi ca chỉ 1 dòng,
-- chấm lại là ĐÈ lên lượt trước, mất dấu lượt cũ.
-- Giờ mỗi lượt kiểm là một dòng riêng, phân biệt nhau bằng cột id sẵn có.
alter table public.s5_checks drop constraint if exists s5_checks_date_shift_cell_uniq;
alter table public.s5_checks drop constraint if exists s5_checks_date_cell_uniq;

-- ── 2. GIỜ KIỂM CỦA TỪNG LƯỢT ─────────────────────────────────
-- Tách riêng với updated_at: checked_at là giờ đi kiểm (đặt 1 lần lúc tạo),
-- updated_at là lần sửa gần nhất. Nếu dùng chung thì sửa ghi chú xong
-- lượt kiểm sẽ bị nhảy giờ, xếp sai thứ tự lượt.
alter table public.s5_checks
  add column if not exists checked_at timestamptz not null default now();

-- ── 3. BẮT BUỘC CÓ NGƯỜI KIỂM ─────────────────────────────────
-- Trang đã chặn sẵn trước khi gửi; ràng buộc này là lớp chặn cuối,
-- để không bao giờ lọt một lượt kiểm không biết ai chấm.
alter table public.s5_checks drop constraint if exists s5_checks_inspector_khong_rong;
alter table public.s5_checks
  add constraint s5_checks_inspector_khong_rong check (btrim(inspector) <> '');

-- ── 4. INDEX ──────────────────────────────────────────────────
-- Lấy các lượt của một máy trong một ca, mới nhất trước
create index if not exists s5_checks_luot_idx
  on public.s5_checks (date, shift, cell_id, checked_at);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Không còn khoá unique nào trên (date, shift, cell_id):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass and contype = 'u';
--
-- Có cột checked_at và ràng buộc inspector:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass and contype = 'c';
