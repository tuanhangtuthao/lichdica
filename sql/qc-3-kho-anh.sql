-- ═══════════════════════════════════════════════════════════════
-- QC BƯỚC 3: QUYỀN KHO ẢNH 5S (chạy trên project Supabase CỦA QC)
-- ═══════════════════════════════════════════════════════════════
-- Tách riêng vì lệnh tạo quyền trên storage.objects đôi khi bị SQL Editor từ
-- chối ("must be owner of table objects"). Nếu lỗi: Storage → s5-photos →
-- Policies → New policy → For full customization, tạo 4 policy y như dưới,
-- Target roles: anon, authenticated. (Giống sql/5s-storage-fix.sql của SX.)
drop policy if exists s5_photos_read   on storage.objects;
drop policy if exists s5_photos_write  on storage.objects;
drop policy if exists s5_photos_update on storage.objects;
drop policy if exists s5_photos_delete on storage.objects;

-- Xem ảnh
create policy s5_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 's5-photos');

-- Tải ảnh lên
create policy s5_photos_write on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 's5-photos');

-- Ghi đè khi tải lại cùng đường dẫn
create policy s5_photos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 's5-photos')
  with check (bucket_id = 's5-photos');

-- Xoá ảnh bị bỏ khỏi phiếu (không để file rác ăn dần dung lượng miễn phí)
create policy s5_photos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 's5-photos');

-- KIỂM TRA: phải ra 4 dòng s5_photos_*
--   select policyname from pg_policies where tablename = 'objects' and policyname like 's5_photos%';
