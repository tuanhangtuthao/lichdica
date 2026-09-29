-- ═══════════════════════════════════════════════════════════════
-- MỞ QUYỀN TẢI ẢNH LÊN BUCKET s5-photos
--
-- Phần storage trong 5s-setup.sql KHÔNG ăn: bảng s5_checks ghi được,
-- bucket đã tạo, đọc ảnh được, nhưng tải ảnh lên báo
--   "new row violates row-level security policy"
-- => policy INSERT trên storage.objects chưa được tạo.
--
-- Nguyên nhân thường gặp: lệnh "create policy ... on storage.objects"
-- chạy từ SQL Editor hay bị từ chối vì role hiện tại không sở hữu bảng
-- storage.objects. Nếu chạy file này vẫn báo lỗi quyền thì dùng CÁCH 2
-- (bấm trên giao diện) ở cuối file - cách đó chắc ăn.
-- ═══════════════════════════════════════════════════════════════

-- ── CÁCH 1: CHẠY SQL ──────────────────────────────────────────
drop policy if exists s5_photos_read   on storage.objects;
drop policy if exists s5_photos_write  on storage.objects;
drop policy if exists s5_photos_update on storage.objects;
drop policy if exists s5_photos_delete on storage.objects;

-- Xem ảnh
create policy s5_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 's5-photos');

-- Tải ảnh lên  ← đây là cái đang thiếu
create policy s5_photos_write on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 's5-photos');

-- Ghi đè khi tải lại cùng đường dẫn
create policy s5_photos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 's5-photos')
  with check (bucket_id = 's5-photos');

-- Xoá ảnh: cần để khi bỏ ảnh khỏi phiếu thì file cũng được dọn,
-- không thì file rác nằm lại mãi và ăn dần 1GB miễn phí.
create policy s5_photos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 's5-photos');

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Phải ra đủ 4 dòng s5_photos_*:
--   select policyname, cmd, roles from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname like 's5_photos%';

-- ── CÁCH 2: LÀM TRÊN GIAO DIỆN (nếu cách 1 báo lỗi quyền) ─────
-- Supabase → Storage → chọn bucket s5-photos → tab Policies
-- → New policy → For full customization
-- Tạo 4 policy, mỗi cái:
--     Policy name : s5_photos_write   (rồi read / update / delete)
--     Allowed operation : INSERT      (rồi SELECT / UPDATE / DELETE)
--     Target roles : anon, authenticated
--     USING / WITH CHECK expression :  bucket_id = 's5-photos'
-- Xong bấm Review → Save policy.
