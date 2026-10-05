# Bot Zalo gửi tổng kết xếp loại tháng + xác nhận online — ĐÃ TRIỂN KHAI 05/10/2026

Chốt phạm vi ngày 05/10/2026: **chỉ tổng kết khi quản lý chốt (duyệt) xếp loại cuối tháng.** KHÔNG báo điểm đánh giá hằng ngày (lý do: điểm nhập theo đợt cho cả kíp ~27 người/ngày, 85% là điểm 9; ngày nghỉ phép cũng bị ghi 7 kèm ghi chú "nghỉ" nên báo sẽ gây hiểu lầm).

## Khi nào gửi
- Cron 5 phút/lần sẵn có (`*/5 * * * *`) đọc `monthly_reviews`: dòng `approved = true`, `grade` không trống, chưa từng báo cho người đó ở tháng đó → nhắn riêng nhân viên đã liên kết bot. Mỗi người quản lý duyệt tới đâu nhận tin tới đó.
- Chỉ xét các tháng từ `2026-10` trở đi (hằng số kiểu `BAT_DAU` trong code), để lúc bật tính năng không dội tổng kết tháng 5–9 (đã duyệt sẵn 39–46 người mỗi tháng).
- Không qua AI → không tốn tiền key.
- Đánh dấu "đã báo" ở bảng riêng (cần 1 câu SQL), khoá = (emp_id, month_key), kèm hạng đã báo để biết khi quản lý sửa hạng.

## Mẫu tin (dữ liệu thật tháng 9 của 2718, chỉ để minh hoạ)
```
📋 TỔNG KẾT THÁNG 09/2026
👤 Trương Thanh Tuấn (Kíp 1)

⭐ Xếp loại: C  (tháng 8: B ⬇️)
📊 Điểm: 7/10 · đã chấm 16 ngày
📝 Nhận xét của quản lý: <note>

📅 Đi làm: 16 ngày
🧹 5S chưa đạt: 0 lần
⏰ Tăng ca: 0 giờ
🏖️ Nghỉ phép / vắng: 0 ngày

Nhắn 4 để xem điểm tháng này.
```
- Hạng: `monthly_reviews.grade`. Mũi tên so với tháng trước theo thứ tự A+ > A > B > C > D: ⬆️ lên, ⬇️ xuống, ➡️ giữ nguyên. Không có tháng trước thì bỏ phần ngoặc.
- Điểm: `final_score` nếu có, không thì trung bình `ratings_new` của tháng (cùng công thức `tra_danh_gia`).
- Đi làm: số ngày có ca làm trong tháng theo lịch (không tính Nghỉ / Lễ / Nghỉ Phép / Vắng / Chưa phân ca).
- 5S: số lượt chưa đạt (cùng công thức rating.html). Tăng ca: tổng giờ (+ số lần cả ca). Nghỉ phép/vắng: tổng số NGÀY trong tháng.
- Tái dùng công cụ cá nhân sẵn có: `tra_danh_gia`, `tra_vi_pham_5s`, `tra_tang_ca`, `tra_nghi_phep`, `tra_lich_ca`.

## ĐÃ CHỐT 05/10/2026 ("ok" cho cả 3 đề xuất)
1. **Nhận xét của quản lý: gửi kèm** (trang Tra Cứu trên web đã hiển thị cho nhân viên).
2. **Quản lý sửa hạng sau khi đã gửi:** gửi 1 tin ngắn "Xếp loại tháng 09 của bạn đã được điều chỉnh: C → B".
3. **Nhân viên liên kết bot muộn:** gửi bù tổng kết của **tháng gần nhất đã duyệt** ngay sau menu.

## ĐÃ LÀM (05/10/2026): TẤT CẢ XÁC NHẬN ONLINE QUA ZALO
Code: `worker/xep-loai.js` (nối vào cron 5 phút, báo bù khi liên kết, và bắt câu trả lời trong `worker/index.js`). SQL: `sql/zalo-xep-loai.sql` (đã chạy). Không qua AI.

- **Không ký giấy.** Từ lúc quản lý duyệt xếp loại, mỗi nhân viên xác nhận qua bot, hạn **hết ngày 4** tháng sau. Chu kỳ đầu tiên: xếp loại tháng 10, hạn 04/11. Chỉ xét tháng từ `2026-10` (`BAT_DAU_THANG`).
- **Menu xác nhận (chốt 05/10): 1 Đồng ý · 2 Xem lại chi tiết · 3 Không đồng ý / có thắc mắc.** Số 2 do bên làm đặt để không bấm nhầm vào lựa chọn có hậu quả; muốn đổi thì sửa bảng ánh xạ `{ 1:..., 2:..., 3:... }` trong `xuLyXacNhan`.
- Số 1/2/3 chỉ là xác nhận trong **12 giờ** sau lần hỏi gần nhất (cột `menu = 'xac_nhan'` + `hoi_luc`), nhắn **0** thì thoát ngay; sau đó số lại là mục menu thường. Gõ chữ "đồng ý" / "không đồng ý" thì lúc nào cũng có tác dụng, kể cả đổi ý trước hạn.
- **Không đồng ý:** ghi nhận, báo Trưởng Phòng ngay (`XAC_NHAN_BAO_MSNV` trong wrangler.jsonc), tin nhắn tiếp theo trong 2 giờ được ghi làm lý do và báo tiếp.
- **Nhắc nhở:** từ 8:00 giờ VN mỗi ngày cho người chưa xác nhận (chạy trong cron 5 phút, không có cron 8:00 riêng, vì gửi cả xưởng một lúc sẽ vượt giới hạn lệnh gọi mạng của Cloudflare gói miễn phí). Mỗi lần chạy gửi tối đa 6 người.
- **Quá hạn:** ngày hôm sau báo Trưởng Phòng danh sách chưa xác nhận (📵 = chưa liên kết bot). Chỉ báo một lần mỗi tháng.
- **Duyệt trễ** (sau ngày 4): hạn = 3 ngày sau lúc bot phát hiện.
- **Quản lý sửa hạng sau khi nhân viên đã xác nhận:** xác nhận cũ hết hiệu lực, bot báo "điều chỉnh: D → C" kèm yêu cầu xác nhận lại.
- **Người chưa liên kết bot:** có bản ghi nhưng chưa gửi; khi họ liên kết, bot gửi bù tổng kết kèm yêu cầu xác nhận.
- **Menu quản lý mục 13** xem đồng ý / không đồng ý (kèm lý do) / chờ / chưa liên kết bot. "Menu cá nhân" dời thành 14.
- Hạng, nhận xét lấy từ `monthly_reviews` (`approved = true`). Điểm = `final_score` nếu có, không thì trung bình điểm ngày. Dữ liệu cả tháng nạp một lần rồi tính cho từng người.

## Đã thử (05/10/2026, Zalo giả lập, dữ liệu thật tháng 9, đã dọn sạch)
Liên kết → nhận tổng kết đúng nội dung; cron không gửi trùng; 2 (xem lại), 3 (không đồng ý + báo + lý do), gõ "đồng ý" đổi ý; bấm 1 sau đó là "Ca ngày mai" chứ không phải đồng ý; nhắc nhở không lặp trong ngày; báo quá hạn một lần; báo điều chỉnh khi đổi hạng; mục 13. Lỗi tìm ra khi thử: nhắn 0 để vào menu mà vẫn giữ chế độ xác nhận → bấm 1 sau đó sẽ bị ghi thành đồng ý (đã sửa).

## Chưa thử trong thực tế
Chưa có xếp loại tháng 10 nào được duyệt nên luồng thật chưa chạy lần nào. Điều kiện để hiệu quả: cả xưởng phải vào bot trước đầu tháng 11.
