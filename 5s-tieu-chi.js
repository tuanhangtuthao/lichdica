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
