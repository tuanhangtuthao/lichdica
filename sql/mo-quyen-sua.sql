/* MỞ QUYỀN SỬA CHO CÁC BẢNG WEB ĐANG SỬA DỮ LIỆU
   Chạy trên CẢ HAI project Supabase (SX và QC): SQL Editor, New query, dán, Run.

   Lỗi đã gặp: bảng lịch ca (emp_schedule) thêm được, xoá được nhưng KHÔNG sửa
   được, và database không báo lỗi gì. Web ghi ca / nghỉ đè lên khoảng lịch cũ
   thì phải cắt ngắn khoảng cũ (= sửa) -> cắt không được, hai khoảng chồng nhau,
   lịch hiện sai ca.

   Chỉ đụng các bảng mà code web có gọi sửa (.update / .upsert), và chỉ thêm
   quyền sửa khi bảng đó CHƯA có quyền nào cho phép sửa. Bảng đã sửa được thì
   để nguyên. Không đụng app_secrets (mật khẩu) hay bảng của ứng dụng khác.
   Chạy lại nhiều lần không sao. Kết quả là bảng liệt kê từng bảng đã làm gì.

   Đặt trong hàm tạm pg_temp vì SQL Editor của Supabase hay báo lỗi lạ với
   khối lệnh lớn ở cấp ngoài (xem qc-1-xuat-cau-truc.sql). */
create or replace function pg_temp.mo_quyen_sua()
returns table (bang text, ket_qua text) language plpgsql as $f$
declare
  t text;
begin
  foreach t in array array[
    'emp_schedule', 'employees', 'leave_requests', 'overtime',
    'monthly_reviews', 'ratings_new', 'rating_config'
  ] loop
    bang := t;
    if to_regclass('public.' || t) is null then
      ket_qua := 'không có bảng này - bỏ qua';
    elsif not (select c.relrowsecurity from pg_class c where c.oid = ('public.' || t)::regclass) then
      ket_qua := 'không bật RLS - vốn sửa được';
    elsif exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t
        and p.cmd in ('UPDATE', 'ALL') and p.permissive = 'PERMISSIVE'
        and ('anon' = any(p.roles) or 'public' = any(p.roles))
    ) then
      ket_qua := 'đã có quyền sửa - để nguyên';
    else
      execute format('drop policy if exists web_sua on public.%I', t);
      execute format('create policy web_sua on public.%I for update to anon, authenticated using (true) with check (true)', t);
      ket_qua := 'ĐÃ MỞ quyền sửa';
    end if;
    return next;
  end loop;
end $f$;
select * from pg_temp.mo_quyen_sua();
