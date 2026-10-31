/* KT BƯỚC 1 - TẠO NGĂN RIÊNG (schema "kt") CHO KỸ THUẬT CNC TRONG DATABASE QC
   Chạy trên project Supabase của QC (lichdica-qc): SQL Editor, New query, dán, Run.
   Supabase gói miễn phí chỉ cho 2 database (SX, QC) nên KT nằm trong database QC
   nhưng ở ngăn riêng: bảng riêng, nhân viên riêng, không lẫn với bảng của QC.
   - Chép CẤU TRÚC 17 bảng web từ public (KHÔNG chép dữ liệu QC), luật RLS, hàm mật khẩu.
   - Chép cấu hình chung: thang xếp loại, ngày lễ, mật khẩu quản lý.
   Chạy lại nhiều lần không sao. Tất cả nằm trong 1 khối DO cho SQL Editor khỏi báo lỗi lạ. */
do $$
declare t text; c record; p record; seq text;
begin
  execute 'create schema if not exists kt';
  execute 'grant usage on schema kt to anon, authenticated, service_role';

  foreach t in array array['app_secrets','emp_schedule','employees','factory_layout','holidays','huong_dan_videos',
    'leave_requests','monthly_reviews','overtime','rating_config','ratings_new','s5_checks','s5_nguoi',
    'shift_roster','zalo_bao_5s','zalo_links','zalo_xep_loai'] loop
    execute format('create table if not exists kt.%I (like public.%I including all)', t, t);
    -- cột tự tăng: bộ đếm riêng của kt, không dùng chung bộ đếm với QC
    for c in select a.attname from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
             where d.adrelid = format('kt.%I', t)::regclass and pg_get_expr(d.adbin, d.adrelid) like 'nextval(%' loop
      seq := t || '_' || c.attname || '_seq';
      execute format('create sequence if not exists kt.%I owned by kt.%I.%I', seq, t, c.attname);
      execute format('alter table kt.%I alter column %I set default nextval(%L)', t, c.attname, 'kt.' || seq);
    end loop;
    execute format('alter table kt.%I enable row level security', t);
    for p in select * from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on kt.%I', p.policyname, t);
      execute format('create policy %I on kt.%I as %s for %s to %s%s%s', p.policyname, t, lower(p.permissive), p.cmd,
        array_to_string(p.roles, ', '),
        case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
        case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end);
    end loop;
  end loop;

  execute 'grant select, insert, update, delete on all tables in schema kt to anon, authenticated, service_role';
  execute 'grant usage, select on all sequences in schema kt to anon, authenticated, service_role';
  execute 'revoke all on kt.app_secrets from anon, authenticated';

  execute $f$create or replace function kt.check_app_password(pw text) returns boolean
    language sql security definer set search_path to 'kt'
    as 'select exists(select 1 from kt.app_secrets where key = ''settings_pass'' and value = pw)'$f$;
  execute 'grant execute on function kt.check_app_password(text) to anon, authenticated';

  insert into kt.rating_config select * from public.rating_config on conflict do nothing;
  insert into kt.holidays select * from public.holidays on conflict do nothing;
  insert into kt.app_secrets select * from public.app_secrets where key = 'settings_pass' on conflict do nothing;
end $$;

select 'Đã tạo ngăn kt: ' || count(*) || ' bảng' as ket_qua
from information_schema.tables where table_schema = 'kt';
