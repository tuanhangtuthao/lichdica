-- ═══════════════════════════════════════════════════════════════
-- ĐỔI NỘI DUNG KIỂM TRA: 4 MỤC -> 5 MỤC MỚI
-- Chạy SAU 5s-khongdat-phai-co-anh.sql, 1 lần, Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════
--
-- Bộ tiêu chí mới KHÁC HẲN bộ cũ, không phải chỉ thêm 1 mục:
--   cũ: Tài liệu/Check sheet | Tem nhãn | Phân loại hàng hóa | Thân máy+Sàn
--   mới: Đường đi/Sàn/Line | Bàn thao tác | Thân máy | Rổ đựng hàng | Bộ cấp phôi
-- Cột vẫn tên s1..s5 nên dữ liệu chấm theo bộ cũ mà giữ lại sẽ bị hiển thị
-- sai ý nghĩa. Đã thống nhất: xoá hết, chấm lại theo bộ mới.

-- ── 1. XOÁ DỮ LIỆU CHẤM THEO BỘ CŨ ────────────────────────────
-- Phải xoá TRƯỚC khi thêm ràng buộc ở mục 4, nếu không Postgres kiểm tra
-- các dòng cũ (chưa có mục 5, không ảnh) và sẽ báo lỗi không thêm được.
-- Các lượt cũ đều đạt hết và không đính ảnh nào nên không có ảnh mồ côi
-- trong kho cần dọn.
delete from public.s5_checks;

-- ── 2. THÊM LẠI CỘT MỤC THỨ 5 ─────────────────────────────────
-- Cột này từng bị bỏ khi rút xuống 4 mục.
alter table public.s5_checks
  add column if not exists s5 boolean not null default false;

-- ── 3. GHI Ý NGHĨA TỪNG CỘT ───────────────────────────────────
-- Cột để tên trung tính s1..s5 vì nội dung còn có thể đổi nữa; mở bảng ra
-- là biết mục nào là gì. Đổi nội dung thì sửa S_DEFS trong 5s.html rồi
-- cập nhật lại 5 dòng dưới đây.
comment on column public.s5_checks.s1 is 'Đường đi, sàn nhà, đường line';
comment on column public.s5_checks.s2 is 'Bàn thao tác';
comment on column public.s5_checks.s3 is 'Thân máy';
comment on column public.s5_checks.s4 is 'Rổ đựng hàng';
comment on column public.s5_checks.s5 is 'Bộ cấp phôi';

-- ── 4. RÀNG BUỘC "CHƯA ĐẠT PHẢI CÓ ẢNH" TÍNH CẢ MỤC 5 ─────────
-- Ràng buộc cũ chỉ xét s1..s4, bỏ sót mục mới thêm.
alter table public.s5_checks drop constraint if exists s5_checks_khongdat_phai_co_anh;
alter table public.s5_checks
  add constraint s5_checks_khongdat_phai_co_anh check (
    (s1 and s2 and s3 and s4 and s5)
    or (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) > 0)
  );

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Bảng trống và có đủ cột s1..s5:
--   select count(*) from public.s5_checks;
--   select column_name from information_schema.columns
--   where table_name = 's5_checks' and column_name like 's_' order by column_name;
--
-- Ràng buộc đã tính cả s5 (phải thấy "and s5" trong biểu thức):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass
--     and conname = 's5_checks_khongdat_phai_co_anh';
