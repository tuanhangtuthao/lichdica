-- ═══════════════════════════════════════════════════════════════
-- BỔ SUNG CHO TRANG 5S
--   (a) ghi nhận người đứng máy + tách theo ca
--   (b) đổi nội dung kiểm tra: 5 mục 5S -> 4 mục theo yêu cầu
-- Chạy SAU 5s-setup.sql, 1 lần, trên Supabase → SQL Editor → Run.
-- Chạy lại nhiều lần không sao (mọi lệnh đều có "if exists/if not exists").
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CỘT MỚI: NGƯỜI ĐỨNG MÁY + CA ───────────────────────────
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

-- ── 3. NỘI DUNG KIỂM TRA MỚI: 4 MỤC ───────────────────────────
-- Cột giữ tên trung tính s1..s4 vì nội dung kiểm tra còn có thể đổi nữa;
-- ý nghĩa hiện tại ghi ngay vào comment của cột để sau này mở bảng ra là
-- biết. Muốn đổi nội dung: sửa danh sách S_DEFS trong 5s.html rồi cập
-- nhật lại 4 dòng comment dưới đây.
comment on column public.s5_checks.s1 is 'Tài liệu / Check sheet';
comment on column public.s5_checks.s2 is 'Hiển thị thông tin tem nhãn';
comment on column public.s5_checks.s3 is 'Phân loại hàng hóa';
comment on column public.s5_checks.s4 is 'Thân máy / Sàn nhà';

-- Mục thứ 5 của bộ 5S cũ không còn dùng -> bỏ hẳn.
-- Để lại thì cột luôn mang giá trị false, và mọi lần kiểm sẽ bị tính
-- nhầm thành "có vi phạm" vì bộ lọc lịch sử coi false là chưa đạt.
-- An toàn: bảng đang trống, chưa chấm dòng nào.
alter table public.s5_checks drop column if exists s5;

-- ── 4. INDEX CHO LỊCH SỬ VI PHẠM ──────────────────────────────
-- Tra "người này từng vi phạm những gì"
create index if not exists s5_checks_worker_idx on public.s5_checks (worker_name, date desc);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Phải thấy đủ shift / kip / worker_name và KHÔNG còn cột s5:
--   select column_name, data_type from information_schema.columns
--   where table_name = 's5_checks' order by ordinal_position;
--
-- Khoá mới phải gồm 3 cột date, shift, cell_id:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass and contype = 'u';
