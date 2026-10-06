// ═══════════════════════════════════════════════════════════════
// NỘI DUNG KIỂM TRA 5S - NGUỒN DUY NHẤT
// ═══════════════════════════════════════════════════════════════
// Cả 5s.html (trang chấm) và rating.html (trang Đánh Giá) đều nạp file
// này. Sửa ở đây là CẢ HAI TRANG đổi theo - trước đây danh sách nằm ở hai
// nơi nên đổi một bên là bên kia hiện sai tên mục.
//
// k   = tên cột trong bảng s5_checks (s1..s5), giữ trung tính vì nội dung
//       còn có thể đổi. Đổi nội dung thì nhớ cập nhật cả comment của cột
//       trong Supabase (xem sql/5s-tieu-chi-moi-5-muc.sql).
// name  = tên đầy đủ, hiện trong phiếu chấm và file Excel
// short = tên ngắn, hiện trên thẻ vi phạm và bảng cho đỡ chật
// desc  = mô tả để người đi kiểm biết soi cái gì
//
// THÊM / BỚT MỤC: thêm hoặc bớt dòng ở đây, rồi chạy SQL thêm/bớt cột
// tương ứng trong bảng s5_checks. Mọi chỗ khác (số điểm, thẻ vi phạm,
// cột Excel, ràng buộc ảnh) đều tự suy theo danh sách này.

const S_DEFS = [
  {k:'s1', name:'Đường đi, sàn nhà, đường line', short:'Đường đi / Sàn',
   desc:'Đường đi có rác không, có vết bẩn, dầu mỡ không'},
  {k:'s2', name:'Bàn thao tác', short:'Bàn thao tác',
   desc:'Bàn thao tác đã để đúng quy định chưa'},
  {k:'s3', name:'Thân máy', short:'Thân máy',
   desc:'Xung quanh máy có vật dụng thừa, vết bẩn, dầu nhớt bám trên máy không'},
  {k:'s4', name:'Rổ đựng hàng', short:'Rổ đựng hàng',
   desc:'Khi nhận máy đầu ca, các rổ đựng sản phẩm không được còn sản phẩm của ca trước'},
  {k:'s5', name:'Bộ cấp phôi', short:'Bộ cấp phôi',
   desc:'Kiểm tra tình trạng bộ cấp phôi, trên bộ cấp chỉ để 1 mã hàng'},
];

// Số mục kiểm - đừng gõ số cứng ở nơi khác, dùng biến này
const N_TC = S_DEFS.length;

// ═══════════════════════════════════════════════════════════════
// KHU VỰC NGOÀI SƠ ĐỒ MÁY: QC, Kỹ thuật, Đóng gói
// ═══════════════════════════════════════════════════════════════
// Mỗi khu là một ô riêng dưới sơ đồ máy, chấm y như một máy. Lưu chung bảng
// s5_checks, cell_id bắt đầu bằng "kv_" để phân biệt với máy.
// nhom = nhóm người phụ trách trong bảng s5_nguoi (KT / QC / DG).
const KHU_VUC = [
  {id:'kv_qc', ten:'QC',       nhom:'QC'},
  {id:'kv_kt', ten:'Kỹ thuật', nhom:'KT'},
  {id:'kv_dg', ten:'Đóng gói', nhom:'DG'},
  {id:'kv_sx', ten:'Sản xuất', nhom:'SX'},
];
// Nhóm người phụ trách. THÊM KHU MỚI: thêm 1 dòng ở KHU_VUC, 1 nhóm ở đây, rồi
// mở nhóm mới trong ràng buộc bảng s5_nguoi (xem sql/5s-khu-san-xuat.sql).
const NHOM_5S = {KT:'Kỹ thuật', QC:'QC', DG:'Đóng gói', SX:'Sản xuất'};

// Tiêu chí cho khu vực. 5 mục máy ở trên ("Thân máy", "Bộ cấp phôi"...) không
// áp dụng cho bàn QC hay khu đóng gói. ĐÂY LÀ BẢN MẪU - sửa chữ thoải mái,
// nhưng GIỮ ĐÚNG 5 MỤC và khoá s1..s5 vì dùng chung cột với máy.
const S_DEFS_KHU = [
  {k:'s1', name:'Đường đi, sàn nhà', short:'Đường đi / Sàn',
   desc:'Sàn sạch, không rác, không dầu mỡ, lối đi thông thoáng'},
  {k:'s2', name:'Bàn làm việc', short:'Bàn làm việc',
   desc:'Bàn gọn gàng, chỉ để đồ đang dùng, không để đồ cá nhân'},
  {k:'s3', name:'Dụng cụ, tài liệu', short:'Dụng cụ / Tài liệu',
   desc:'Dụng cụ đo, tài liệu, check sheet để đúng vị trí quy định'},
  {k:'s4', name:'Hàng hoá', short:'Hàng hoá',
   desc:'Hàng phân loại rõ ràng (đạt / chờ / lỗi), có tem nhãn'},
  {k:'s5', name:'Vật dụng thừa', short:'Vật dụng thừa',
   desc:'Không có thùng hộp hư, vật dụng thừa, rác tồn đọng'},
];

// Ô này là khu vực hay máy
function laKhu(r){ return String((r && r.cell_id) || '').startsWith('kv_'); }
// Bộ tiêu chí đúng cho một lượt kiểm. Cùng khoá s1..s5 nên đếm đạt/chưa đạt
// không đổi; chỉ TÊN mục khác - hiện tên mục chưa đạt thì phải dùng hàm này.
function tieuChiCua(r){ return laKhu(r) ? S_DEFS_KHU : S_DEFS; }

// LỖI 5S TÍNH CHO AI. Lỗi 5S kéo theo bot Zalo nhắn báo lỗi và dòng "5S chưa
// đạt" trong tổng kết xếp loại tháng, nên MỌI CHỖ gán lỗi cho người (web lẫn
// bot) đều phải đi qua các hàm dưới đây.
//
// Máy có kỹ thuật đang dùng (tech_name) thì người kiểm chọn ai chịu lỗi, cột
// chiu_loi: 'kt' = kỹ thuật (mặc định) | 'tho' = thợ | 'ca_hai' = cả hai.
// Lượt cũ chưa có cột này (hoặc để trống) mà có kỹ thuật -> coi như 'kt'.
// Không có kỹ thuật -> lỗi của thợ (hoặc người phụ trách khu) như thường.
const CHIU_LOI = {kt:'Kỹ thuật', tho:'Thợ', ca_hai:'Cả hai'};
function chiuLoiCua(r){
  r = r || {};
  if(!String(r.tech_name || '').trim()) return 'tho';
  return CHIU_LOI[r.chiu_loi] ? r.chiu_loi : 'kt';
}
// Danh sách người chịu lỗi của một lượt (1 hoặc 2 người)
function dsNguoiChiu5S(r){
  r = r || {};
  const tho = {ten: r.worker_name || '', msnv: r.worker_id || '', vai: laKhu(r) ? 'Phụ trách' : 'Thợ'};
  const kt  = {ten: r.tech_name || '',   msnv: r.tech_id || '',   vai: 'Kỹ thuật'};
  const c = chiuLoiCua(r);
  return c === 'kt' ? [kt] : c === 'ca_hai' ? [kt, tho] : [tho];
}
// Người chịu lỗi chính - dùng để hiển thị gọn một tên
function nguoiChiu5S(r){ return dsNguoiChiu5S(r)[0]; }
// Lượt này có tính lỗi cho người này không. Khớp MSNV trước; bản cũ chưa có
// MSNV thì so tên. chuan = cách chuẩn hoá tên (bot Zalo dùng bỏ dấu).
function laLoiCua5S(r, msnv, ten, chuan){
  chuan = chuan || (s => String(s || '').trim().toLowerCase());
  const t = ten ? chuan(ten) : '';
  return dsNguoiChiu5S(r).some(p => p.msnv ? String(p.msnv) === String(msnv) : (!!t && chuan(p.ten) === t));
}

// BỘ PHẬN của một người chịu lỗi (dùng để lọc lịch sử): thợ đứng máy -> Sản
// xuất, kỹ thuật -> Kỹ thuật, người phụ trách khu -> nhóm của khu (QC / KT /
// DG / SX). Lượt "Cả hai" thuộc cả Kỹ thuật lẫn Sản xuất.
function boPhanNguoi5S(r, p){
  if(p && p.vai === 'Kỹ thuật') return 'KT';
  if(laKhu(r)){ const k = KHU_VUC.find(x => x.id === r.cell_id); return k ? k.nhom : 'SX'; }
  return 'SX';
}
function boPhanCua5S(r){ return [...new Set(dsNguoiChiu5S(r).map(p => boPhanNguoi5S(r, p)))]; }

// Cho bot Zalo (worker/) dùng chung danh sách này.
globalThis.TieuChi5S = { S_DEFS, N_TC, S_DEFS_KHU, KHU_VUC, NHOM_5S, CHIU_LOI, laKhu, tieuChiCua,
                          chiuLoiCua, dsNguoiChiu5S, nguoiChiu5S, laLoiCua5S, boPhanNguoi5S, boPhanCua5S };
