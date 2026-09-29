-- ═══════════════════════════════════════════════════════════════
-- CHƯA ĐẠT THÌ BẮT BUỘC CÓ ẢNH
-- Chạy SAU 5s-nhieu-luot.sql, 1 lần, trên Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- Đạt hết 4 mục  -> ảnh không bắt buộc.
-- Còn mục chưa đạt -> phải có ít nhất 1 ảnh, để bộ phận biết hỏng chỗ nào
-- mà khắc phục, và để đối chiếu lượt sau.
--
-- Trang đã chặn sẵn trước khi gửi; ràng buộc này là lớp cuối, phòng trường
-- hợp ai đó ghi thẳng vào bảng.
--
-- jsonb_typeof: phòng khi cột photos không phải mảng thì câu lệnh không vỡ.
alter table public.s5_checks drop constraint if exists s5_checks_khongdat_phai_co_anh;
alter table public.s5_checks
  add constraint s5_checks_khongdat_phai_co_anh check (
    (s1 and s2 and s3 and s4)
    or (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) > 0)
  );

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Phải thấy ràng buộc s5_checks_khongdat_phai_co_anh:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.s5_checks'::regclass and contype = 'c';
--
-- Thử chèn một dòng chưa đạt mà không ảnh -> PHẢI báo lỗi:
--   insert into public.s5_checks
--     (date, shift, kip, cell_id, machine_code, s1, s2, s3, s4, inspector)
--   values ('2000-01-01','S',1,'__test__','TEST', true, true, true, false, 'test');
-- Chạy xong nhớ xoá nếu lỡ chèn được:
--   delete from public.s5_checks where date = '2000-01-01';
