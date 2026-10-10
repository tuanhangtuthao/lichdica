// ═══════════════════════════════════════════════════════════════
// CẤU HÌNH XƯỞNG - nạp ĐẦU TIÊN ở mọi trang (trước mọi script khác)
// ═══════════════════════════════════════════════════════════════
// Cùng một bộ code phục vụ nhiều "xưởng", mỗi xưởng một DATABASE RIÊNG nên
// không xem được dữ liệu của nhau, kể cả gọi thẳng vào database:
//
//   https://<web>/...       -> Sản xuất (Phân Xưởng 1) - database hiện tại
//   https://<web>/qc/...    -> QC                      - database riêng của QC
//
// Xưởng chọn theo ĐƯỜNG DẪN, không theo lựa chọn lưu trên máy: mở link nào là
// đúng xưởng đó, không có chuyện điện thoại "kẹt" ở nhầm xưởng.
// Trang chỉ cần đọc CAU_HINH.SB_URL / CAU_HINH.SB_KEY thay vì ghi cứng.
//
// THÊM XƯỞNG MỚI: thêm 1 mục vào XUONG bên dưới (tiền tố đường dẫn + database),
// và cho worker/index.js chuyển tiền tố đó về cùng bộ file web.
(function () {
  'use strict';

  const XUONG = {
    SX: {
      ma: 'SX', ten: 'Phân Xưởng 1', tien_to: '',
      SB_URL: 'https://xtutpuwesganunktrxcv.supabase.co',
      SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dXRwdXdlc2dhbnVua3RyeGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzQzMjksImV4cCI6MjA5MjI1MDMyOX0.0LWgIofa8QuMqP5Sjr3QdAK1tbH6aOljbqqXdrtrLc4',
    },
    // Điền SB_URL / SB_KEY khi đã tạo project Supabase cho QC.
    QC: {
      ma: 'QC', ten: 'QC', tien_to: '/qc',
      SB_URL: '',
      SB_KEY: '',
    },
  };

  const duong = location.pathname.toLowerCase();
  const ma = (duong === '/qc' || duong.startsWith('/qc/')) ? 'QC' : 'SX';
  const ch = Object.assign({}, XUONG[ma]);
  ch.SB_OK = /^https:\/\//.test(ch.SB_URL) && !!ch.SB_KEY;
  window.CAU_HINH = ch;

  // ── Tách dữ liệu nhớ trên trình duyệt giữa các xưởng ──
  // Hai xưởng chung một tên miền nên chung localStorage / sessionStorage: không
  // tách thì MSNV đã xem gần đây, tên người kiểm 5S... của SX hiện sang QC.
  // Thêm tiền tố "qc:" vào mọi khoá khi đang ở QC. SX giữ nguyên khoá cũ nên
  // dữ liệu đã nhớ trên máy của SX không mất.
  if (ma !== 'SX') {
    const tt = ma.toLowerCase() + ':';
    const P = Storage.prototype;
    const get = P.getItem, set = P.setItem, rem = P.removeItem;
    P.getItem    = function (k)    { return get.call(this, tt + k); };
    P.setItem    = function (k, v) { return set.call(this, tt + k, v); };
    P.removeItem = function (k)    { return rem.call(this, tt + k); };
  }

  // Xưởng chưa có database (chưa cấu hình) thì báo rõ thay vì trang trắng
  if (!ch.SB_OK) {
    document.addEventListener('DOMContentLoaded', function () {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#F4F5F3;font:600 16px/1.5 system-ui,sans-serif;color:#16202B;text-align:center';
      d.textContent = 'Xưởng "' + ch.ten + '" chưa được nối với database. Liên hệ người quản lý web.';
      document.body.appendChild(d);
    });
  }
})();
