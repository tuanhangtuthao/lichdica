# Menu số cho bot Zalo — ĐẶC TẢ

Chốt và triển khai ngày 05/10/2026. Code: `worker/menu.js` (trả lời theo số), `worker/du-lieu-xuong.js` (dữ liệu toàn xưởng cho quản lý), `worker/index.js` (điều phối). Đổi menu thì sửa code và cập nhật file này cùng lúc.

**Cần chạy 1 lần:** `sql/zalo-menu.sql` (thêm cột nhớ menu). Chưa chạy thì quản lý không sang được menu cá nhân bằng số 12.

## Menu

Gửi khi nhân viên chào (*chào, xin chào, hi, hello, alo, menu…*), khi nhắn `0`, và ngay sau khi liên kết MSNV xong.

```
👋 Chào <Tên> (<Kíp>)
Nhắn SỐ để xem:

1️⃣ Ca ngày mai
2️⃣ Lịch 7 ngày tới
3️⃣ Vi phạm 5S tháng này
4️⃣ Điểm & xếp loại tháng này
5️⃣ Ngày nghỉ sắp tới
6️⃣ Tăng ca tháng này
7️⃣ Nghỉ phép tháng này
8️⃣ Tiêu chí 5S
0️⃣ Xem lại menu
💬 Hoặc gõ câu hỏi bất kỳ, vd: "thứ 6 tuần sau tôi làm ca gì?"
```

So với bản đề xuất đầu: **bỏ "Ca hôm nay"**, đổi thứ tự (vi phạm 5S và điểm lên vị trí 3, 4), còn 8 mục.

## Mỗi số trả lời gì

Mẫu chi tiết có trong lịch sử trao đổi ngày 05/10/2026. Tóm tắt:

| Số | Nội dung | Công cụ dùng (worker/du-lieu.js) |
|---|---|---|
| 1 | Ca ngày mai: thứ, ngày, ca kèm giờ | `tra_lich_ca` (mai → mai) |
| 2 | 7 ngày từ hôm nay, mỗi dòng `T2 05/10 ☀️ Sáng`, cuối ghi "Đi làm x/7 ngày" | `tra_lich_ca` (hôm nay → +6) |
| 3 | Số lần 5S chưa đạt tháng này + từng lượt: ngày, máy, mục, ghi chú. Không có thì "✅ … Giữ vững nhé!" | `tra_vi_pham_5s` |
| 4 | Điểm /10, %, xếp loại, đã duyệt chưa, số ngày đã chấm, ghi chú quản lý | `tra_danh_gia` |
| 5 | Đợt nghỉ gần nhất (từ → đến, số ngày), còn mấy ngày nữa | `tim_ngay_nghi_toi` |
| 6 | Tổng giờ + từng lần tăng ca tháng này | `tra_tang_ca` |
| 7 | Các đợt nghỉ phép / vắng mặt tháng này | `tra_nghi_phep` |
| 8 | 5 mục kiểm tra 5S + mô tả | `tra_tieu_chi_5s` |
| 0 | Gửi lại menu | — |
| số khác | "Mình chưa có mục số N. Nhắn 0 để xem menu nhé." | — |

- Cuối mỗi câu trả lời theo số có dòng: `↩️ Nhắn 0 về menu · nhắn số khác để xem tiếp`
- Ca Hành Chính hiện là `🏢 Hành Chính (7h30–16h30)`.
- Số menu chỉ có 1 chữ số (0–8); MSNV 3–6 chữ số, nên không lẫn với nhau.

## Cách chạy (đã xác nhận 05/10/2026)
- **Trả lời theo số: KHÔNG qua AI.** Gọi công cụ trong `du-lieu.js` rồi điền thẳng vào mẫu. Kết quả là trả lời tức thì, không tốn tiền key, và **không tính** vào giới hạn 40 câu/ngày.
- **Câu hỏi tự do: VẪN chuyển cho AI** như hiện tại. **Giới hạn 10 câu/ngày** cho mỗi tài khoản Zalo (chốt 05/10/2026, hạ từ 40). Khi làm: đổi `GIOI_HAN` trong `du-lieu.js` từ 40 xuống 10, và chỉ đếm câu đi qua AI.
- Hết lượt thì báo: "Hôm nay bạn đã hỏi 10 câu tự do rồi. Bạn vẫn dùng menu số được nhé — nhắn 0 để xem."

## Không bao giờ im lặng (chốt 05/10/2026)
Mọi tin nhắn đều phải nhận đúng **một** câu trả lời. Các trường hợp, câu nào cũng kèm gợi ý nhắn 0:

| Trường hợp | Bot trả lời |
|---|---|
| Không hiểu câu hỏi (AI trả rỗng / không xác định được) | 🤔 Mình chưa hiểu câu này. Bạn nhắn **0** để xem menu, hoặc hỏi lại ngắn gọn, vd: "mai tôi làm ca gì?" |
| Ngoài phạm vi (lương, người khác…) | Mình chỉ tra được lịch ca, điểm, 5S, tăng ca, nghỉ phép **của chính bạn**. Nhắn **0** để xem menu nhé. (sửa system prompt để AI luôn kèm câu này) |
| Số không có trong menu | Mình chưa có mục số N. Nhắn **0** để xem menu nhé. |
| Sticker / ảnh / ghi âm | Mình chỉ đọc được tin nhắn chữ. Nhắn **0** để xem menu nhé. |
| Hết 10 câu tự do/ngày | Hôm nay bạn đã hỏi 10 câu tự do rồi. Bạn vẫn dùng menu số được nhé — nhắn **0** để xem. |
| AI quá 24 giây | Trợ lý đang chậm, bạn hỏi lại sau ít phút nhé. (đã có) |
| Lỗi hệ thống / key hết tiền | Trợ lý đang gặp sự cố, bạn hỏi lại sau nhé. (đã có) |

## Menu quản lý (chốt 05/10/2026)

**Ai là quản lý:** nhân viên có chức vụ (cột `employees.role`, không phân biệt hoa thường) là **Trưởng Ca**, **Tổ Trưởng** hoặc **Trưởng Phòng**. Hiện có 5 người: 3 Trưởng Ca (kíp 1, 2, 3), 1 Tổ Trưởng, 1 Trưởng Phòng.

**Quản lý nhập MSNV → hiện MENU QUẢN LÝ trước** (đây là "nhà" của quản lý):
```
👔 Chào <Tên> (<Chức vụ>)
MENU QUẢN LÝ – nhắn SỐ để xem:

1️⃣ Ai làm ca Sáng hôm nay
2️⃣ Ai làm ca Đêm hôm nay
3️⃣ Quân số hôm nay
4️⃣ Ai làm ca ngày mai
5️⃣ Ai chưa được phân ca
6️⃣ Ai chưa được chấm điểm hôm nay
7️⃣ Xếp loại tháng (A/B/C/D + DS hạng C/D)
8️⃣ Vi phạm 5S hôm nay
9️⃣ Top vi phạm 5S tháng / máy tái phạm
🔟 Tăng ca hôm nay / top tháng
1️⃣1️⃣ Đơn xin nghỉ đang chờ duyệt
1️⃣2️⃣ ➜ Menu cá nhân
0️⃣ Xem lại menu quản lý
💬 Hoặc gõ câu hỏi bất kỳ
```

| Số | Nội dung |
|---|---|
| 1 | Ai làm ca Sáng hôm nay, nhóm theo kíp → bộ phận, kèm trưởng ca, cuối có nghỉ phép / vắng |
| 2 | Như trên cho ca Đêm (mã C, 18h–6h) |
| 3 | Quân số: mỗi kíp đi làm x/y + HC/Ca Xoay, tổng đi làm, danh sách nghỉ phép / vắng mặt |
| 4 | Ca ngày mai: ai Sáng / ai Đêm (gọn, theo kíp) |
| 5 | Ai Ca Xoay chưa được phân ca hôm nay (mã UN) |
| 6 | Ai đi làm hôm nay mà chưa có điểm `ratings_new` hôm nay, nhóm theo kíp |
| 7 | Xếp loại tháng: số người mỗi hạng + danh sách hạng C/D (cùng công thức `xep_hang_danh_gia` ở tro-ly.js) |
| 8 | Lượt 5S chưa đạt hôm nay: người, máy, mục, ghi chú |
| 9 | Top người vi phạm 5S tháng + máy hay tái phạm (đếm theo `machine_code`) |
| 10 | Ai tăng ca hôm nay (giờ) + top 5 tăng ca tháng |
| 11 | Đơn `leave_requests` đang `pending`: ai, ngày nào, lý do. Chỉ xem, không duyệt qua Zalo |
| 12 | Chuyển sang menu cá nhân (8 mục như nhân viên) |
| 0 | Gửi lại menu quản lý |

- Cuối mỗi câu trả lời quản lý: `↩️ Nhắn 0 về menu quản lý · 12 sang menu cá nhân`
- Đang ở **menu cá nhân**, quản lý nhắn `0` → **về menu quản lý**. Menu cá nhân của quản lý ghi dòng cuối `0️⃣ Về menu quản lý`.
- **Phải nhớ người dùng đang ở menu nào** (số 1 ở hai menu khác nghĩa): thêm cột `menu text not null default 'ca_nhan'` vào `zalo_links` (giá trị `quan_ly` | `ca_nhan`). Cần chạy SQL thêm cột trên Supabase.
- Nhân viên thường không bao giờ thấy menu quản lý.

**Quyền (chốt):**
- Mọi quản lý (kể cả Trưởng Ca) **xem dữ liệu cả xưởng**, không giới hạn theo kíp.
- **Xác thực: chỉ cần MSNV**, kể cả với quản lý. Đã nêu rủi ro (ai biết MSNV của quản lý là xem được điểm, vi phạm cả xưởng); chủ dự án chọn không dùng PIN.
- **Câu hỏi tự do của quản lý:** AI được **đủ quyền**, tức là thêm bộ công cụ tra cả xưởng (ai làm ca X ngày Y, quân số, điểm / xếp loại / 5S / tăng ca / nghỉ phép của người khác, đơn chờ duyệt). Nhân viên thường vẫn chỉ có công cụ tra dữ liệu của chính mình.
- **Giới hạn câu hỏi tự do:** quản lý **40 câu/ngày**, nhân viên **10 câu/ngày**.

## CÒN CHỜ XÁC NHẬN
- Gửi ngay "⏳ Đang tra, bạn chờ chút nhé…" khi câu hỏi tự do chuyển cho AI (AI mất 6–24 giây)? Đã đề xuất, chưa có trả lời.
