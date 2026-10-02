-- ═══════════════════════════════════════════════════════════════
-- SIẾT QUYỀN GHI BẢNG 5S  (s5_checks + kho ảnh s5-photos)
-- ═══════════════════════════════════════════════════════════════
-- VẤN ĐỀ ĐANG CÓ
-- Khoá anon nằm sẵn trong mã nguồn trang web (ai xem source cũng thấy), mà
-- policy hiện tại cho anon làm mọi thứ. Nghĩa là màn khoá mật khẩu ở trang
-- 5S chỉ che giao diện: người rành kỹ thuật vẫn gọi thẳng Supabase để thêm,
-- sửa, xoá kết quả 5S của người khác.
--
-- CÁCH SIẾT
-- Tách đôi quyền:
--   ĐỌC  - để nguyên cho anon. Trang Đánh Giá cần nó để nhân viên tự xem kết
--          quả 5S của mình, và thẻ <img> cần đọc ảnh trong kho.
--   GHI  - chỉ tài khoản đã đăng nhập. Người đi kiểm gõ mật khẩu ở màn khoá
--          trang 5S, trang đăng nhập thật vào tài khoản dùng chung, token
--          đăng nhập mới là thứ mở quyền ghi. Không có mật khẩu thì database
--          từ chối, bất kể gọi bằng đường nào.
--
-- ❗ CHẠY THEO ĐÚNG THỨ TỰ, nếu không trang 5S sẽ không lưu được:
--   B1. Tạo tài khoản dùng chung (Authentication → Users → Add user):
--         Email          : kiem5s@bachtung.vn
--         Password       : đặt đúng mật khẩu muốn người đi kiểm gõ
--         Auto Confirm   : BẬT  (không bật thì không đăng nhập được)
--   B2. Đẩy bản web mới lên (trang 5S phải biết đăng nhập đã).
--   B3. Mới chạy file này.
--
-- Đổi mật khẩu sau này: Authentication → Users → chọn tài khoản → Reset
-- password. Không phải sửa code, không phải chạy lại SQL.
-- ═══════════════════════════════════════════════════════════════


-- ── 1. BẢNG s5_checks ─────────────────────────────────────────
alter table public.s5_checks enable row level security;

-- Bỏ policy cũ "anon làm được mọi thứ"
drop policy if exists s5_checks_anon_all on public.s5_checks;
drop policy if exists s5_checks_doc      on public.s5_checks;
drop policy if exists s5_checks_them     on public.s5_checks;
drop policy if exists s5_checks_sua      on public.s5_checks;
drop policy if exists s5_checks_xoa      on public.s5_checks;

-- Ai cũng xem được (trang Đánh Giá cho nhân viên tự xem kết quả của mình)
create policy s5_checks_doc on public.s5_checks
  for select to anon, authenticated using (true);

-- Chỉ người đã đăng nhập mới ghi được
create policy s5_checks_them on public.s5_checks
  for insert to authenticated with check (true);

create policy s5_checks_sua on public.s5_checks
  for update to authenticated using (true) with check (true);

create policy s5_checks_xoa on public.s5_checks
  for delete to authenticated using (true);


-- ── 2. KHO ẢNH s5-photos ──────────────────────────────────────
-- Siết luôn, nếu không thì chặn được bảng mà vẫn ai cũng đổ ảnh rác vào kho
-- (dung lượng Supabase có hạn, đầy kho là hỏng cả tính năng chụp ảnh).
--
-- ⚠ Nếu khối này báo "must be owner of table objects" thì SQL Editor không
-- có quyền sửa policy kho ảnh. Làm bằng tay thay thế:
--   Storage → s5-photos → Policies → sửa 3 policy write/update/delete,
--   đổi ô "Target roles" từ  anon, authenticated  thành  authenticated.
--   Giữ nguyên policy read để ảnh vẫn hiện trên trang Đánh Giá.
drop policy if exists s5_photos_write  on storage.objects;
drop policy if exists s5_photos_update on storage.objects;
drop policy if exists s5_photos_delete on storage.objects;

create policy s5_photos_write on storage.objects
  for insert to authenticated with check (bucket_id = 's5-photos');

create policy s5_photos_update on storage.objects
  for update to authenticated using (bucket_id = 's5-photos');

create policy s5_photos_delete on storage.objects
  for delete to authenticated using (bucket_id = 's5-photos');

-- policy đọc giữ nguyên cho anon, KHÔNG đụng vào:
--   s5_photos_read  for select to anon, authenticated using (bucket_id='s5-photos')


-- ── KIỂM TRA SAU KHI CHẠY ─────────────────────────────────────
-- Phải thấy đúng: doc = {anon,authenticated}, 3 cái còn lại = {authenticated}
--   select policyname, cmd, roles from pg_policies
--   where tablename = 's5_checks' order by policyname;
--
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'objects' and policyname like 's5_photos%' order by policyname;
