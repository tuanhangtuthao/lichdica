# Bot Zalo — Trợ Lý Phân Xưởng 1

Nhân viên nhắn bot Zalo kiểu *"mai tôi làm ca gì"*, *"xếp loại tháng này của tôi"*, *"tôi vi phạm 5S mấy lần"*, rồi Claude (Haiku 4.5) tra dữ liệu thật trên Supabase và trả lời.

```
Zalo ──webhook──▶ Cloudflare Worker /api/zalo ──▶ Claude API (chọn công cụ)
                         │                              │
                         ◀──── công cụ tra Supabase ◀────┘
                         └──sendMessage──▶ Zalo
```

| File | Việc |
|---|---|
| `index.js` | Nhận webhook, kiểm tra secret, liên kết Zalo ↔ MSNV, gửi trả lời |
| `tro-ly-ai.js` | Vòng gọi Claude + công cụ, tối đa 4 vòng/câu |
| `du-lieu.js` | Các công cụ tra cứu. Lịch ca lấy từ `../lich-ca.js`, tiêu chí 5S từ `../5s-tieu-chi.js`, nên luôn khớp với web |
| `zalo.js` | Gọi Zalo Bot API |

## Menu số
Nhân viên nhắn số để tra cứu ngay, không qua AI. Quản lý (Trưởng Ca / Tổ Trưởng / Trưởng Phòng) có thêm menu quản lý xem toàn xưởng. Đặc tả đầy đủ: [MENU-ZALO.md](MENU-ZALO.md). Câu hỏi tự do vẫn qua AI: nhân viên 10 câu/ngày, quản lý 40 câu/ngày.

## Báo 5S chưa đạt
Cron 5 phút/lần: lượt 5S chưa đạt mới thì nhắn riêng người bị đánh giá, kèm ảnh. Người chưa liên kết thì bỏ qua và được báo bù khi liên kết. Đặc tả: [BAO-5S-ZALO.md](BAO-5S-ZALO.md).

## Tổng kết xếp loại tháng + xác nhận online
Quản lý duyệt xếp loại → bot nhắn riêng nhân viên tổng kết và yêu cầu xác nhận trước ngày 4 (1 Đồng ý · 2 Xem lại · 3 Không đồng ý), nhắc 8:00 hằng ngày, quá hạn báo Trưởng Phòng. Menu quản lý mục 13 xem trạng thái. Đặc tả và cách vận hành: [TONG-KET-THANG-ZALO.md](TONG-KET-THANG-ZALO.md). Người nhận báo: `XAC_NHAN_BAO_MSNV` trong `wrangler.jsonc`.

## Bản tin nhân sự 8:00 sáng
Cron `0 1 * * *` (01:00 UTC = 8:00 giờ VN) gửi danh sách người đi làm hôm nay: **Ca Sáng, Ca Tối, Hành Chính**, và **Ca 1 / Ca 2 / Ca 3** (mã ca gán tay cho nhóm Ca Xoay, chỉ hiện khi có người). Không qua AI. Code: `worker/ban-tin.js`.
- **Người nhận:** `BAN_TIN_MSNV` trong `wrangler.jsonc` (cách nhau bằng dấu phẩy, vd `"1050,1049"`), gửi tới tài khoản Zalo đang liên kết. Chưa liên kết thì bỏ qua và ghi log.
- Ngày không ai đi làm (Chủ nhật, lễ) thì **không gửi**. Tin quá 1800 ký tự được chia nhỏ.
- Đổi giờ: sửa cron trong `wrangler.jsonc` **và** chuỗi `'0 1 * * *'` trong `worker/index.js` (hai chỗ phải giống nhau). Cron tính theo UTC, trừ 7 giờ so với giờ VN.

## Bảo mật đã chọn

- **Chỉ cần MSNV**, giống trang Tra Cứu. Lần đầu nhắn, bot hỏi MSNV rồi nhớ tài khoản Zalo đó. Ai gõ MSNV người khác thì xem được dữ liệu người đó.
- **Chỉ dữ liệu của chính người hỏi.** Không công cụ nào có tham số MSNV; MSNV được gắn cứng phía server. Hỏi về người khác thì bot không có cách nào tra.
- **Không trả lời trong nhóm Zalo**, vì cả nhóm đọc được.
- **Giới hạn câu hỏi tự do (qua AI) mỗi ngày:** nhân viên 10, quản lý 40, để chặn spam đốt tiền API. Nhắn số trong menu không bị tính. Đổi ở `GIOI_HAN_NV` / `GIOI_HAN_QL` trong `du-lieu.js`.

## Cài đặt (làm 1 lần)

### 1. Tạo bảng trên Supabase
Supabase → SQL Editor → dán nội dung `sql/zalo-lien-ket.sql` → **Run**.

### 2. Lấy 2 khoá
- **Token Zalo Bot**: trong trang quản lý bot Zalo của anh ([bot.zapps.me](https://bot.zapps.me/docs/)).
- **API key Claude**: [console.anthropic.com](https://console.anthropic.com) → *API Keys* → *Create Key*. Vào *Billing* nạp tiền, nên đặt thêm **giới hạn chi tiêu tháng** ở *Limits* cho yên tâm.

### 3. Đặt 3 secret trên Cloudflare
Cloudflare → *Workers & Pages* → **lichdica** → *Settings* → *Variables and Secrets* → *Add*, chọn kiểu **Secret**:

| Tên | Giá trị |
|---|---|
| `ZALO_BOT_TOKEN` | token Zalo Bot ở bước 2 |
| `ZALO_SECRET` | **tự đặt** một chuỗi chữ + số, 8–256 ký tự, ví dụ `px1BotZalo2026xyz`. Zalo gửi kèm chuỗi này để worker biết request đúng là của Zalo |
| `ANTHROPIC_API_KEY` | API key Claude ở bước 2 |

Tuyệt đối không ghi 3 giá trị này vào code hay gửi qua chat.

### 4. Đẩy code lên (push main)
Cloudflare tự build. Vào *Deployments* xem build có xanh không. Build lỗi thì Cloudflare giữ nguyên bản web cũ, không sập.

### 5. Kiểm tra secret
Mở `https://<tên-miền-web>/api/zalo`, phải thấy cả 3 dòng `true`:
```json
{"ok":true,"co_ZALO_BOT_TOKEN":true,"co_ZALO_SECRET":true,"co_ANTHROPIC_API_KEY":true}
```

### 6. Đăng ký webhook với Zalo
Mở **một lần**: `https://<tên-miền-web>/api/zalo/cai-dat?key=<ZALO_SECRET>`
Thấy `"ok": true` là xong. Sai key thì trả 403.

### 7. Nhắn thử
Nhắn riêng cho bot: gửi MSNV (ví dụ `1049`), rồi hỏi *"mai tôi làm ca gì"*.
Đổi người: nhắn `đổi MSNV 1234`.

## Trạm chuyển tiếp Supabase (bắt buộc khi dùng workers.dev)

Zalo gửi webhook bằng User-Agent `Java/1.8...`. Tên miền `workers.dev` bật sẵn **Browser Integrity Check** của Cloudflare và chặn chữ ký đó bằng **lỗi 1010**, trước khi request tới được worker. Không tắt được trên `workers.dev`. Zalo báo lỗi này là `webhook.http.403`.

Nên đường đi thực tế là:
```
Zalo ──▶ Supabase Edge Function "zalo-webhook" ──▶ worker /api/zalo
```
- Code trạm: `supabase/functions/zalo-webhook/index.ts`. Trạm chỉ chuyển nguyên văn tin nhắn và header secret sang worker, việc kiểm tra secret vẫn do worker làm.
- `wrangler.jsonc` → `ZALO_WEBHOOK_URL`: địa chỉ trạm. `/api/zalo/cai-dat` đăng ký địa chỉ này với Zalo.
- Trên Supabase, function này phải **tắt "Enforce JWT Verification"**, vì Zalo không gửi JWT của Supabase.
- Sửa code trạm: Supabase → Edge Functions → `zalo-webhook` → *Code* → dán lại → *Deploy*.

Sau này nếu gắn tên miền riêng và tắt BIC cho `/api/zalo`: xoá `ZALO_WEBHOOK_URL`, mở lại link cài đặt, Zalo sẽ gửi thẳng vào worker.

## Đang dùng key bên thứ 3 (vilao.ai)

Key Claude hiện mua qua bên bán lại, nên `wrangler.jsonc` có khối `vars`:
- `ANTHROPIC_BASE_URL = https://api.vilao.ai`: gọi qua máy chủ của họ (định dạng Messages API của Anthropic, đã thử: trả lời thường và gọi công cụ đều chạy).
- `CLAUDE_MODEL = claude-haiku-4.5`: tên model bên đó đặt (dấu chấm, khác tên chính chủ `claude-haiku-4-5`).

Cần biết:
- **Dữ liệu nhân sự trong câu hỏi** (tên, lịch ca, điểm, 5S) đi qua máy chủ của bên bán trước khi tới Claude.
- Key bán lại có thể bị khoá bất cứ lúc nào. Khi đó bot trả lời "Trợ lý đang bảo trì".
- Lúc thử, một câu "xin chào" bị tính khoảng 1.100 token đầu vào, trong khi câu hỏi chỉ khoảng 20 token. Nghĩa là bên bán chèn thêm nội dung riêng vào mỗi lần gọi, và mình trả tiền cho phần đó.

**Đổi sang key chính chủ:** xoá khối `vars` trong `wrangler.jsonc`, đặt lại secret `ANTHROPIC_API_KEY` bằng key `sk-ant-...` từ console.anthropic.com, rồi push.

## Chi phí
Claude Haiku 4.5: $1 / $5 mỗi triệu token vào / ra. Mỗi câu hỏi thường 2 lượt gọi (1 lượt chọn công cụ, 1 lượt viết trả lời). Với 100 câu/ngày, ước khoảng **$10–20/tháng**. Muốn bot thông minh hơn thì đổi `MODEL` trong `tro-ly-ai.js` sang `claude-opus-5-5` (đắt hơn khoảng 4–5 lần).

## Xem ai đã liên kết
Chạy câu `select` ở cuối `sql/zalo-lien-ket.sql`.

## Lưu ý khi sửa code
- **Đừng chạy `wrangler dev` ở thư mục gốc.** Thư mục gốc vừa là web tĩnh vừa là chỗ wrangler ghi file tạm `.wrangler/`, nên nó tự tải lại liên tục không dừng. Muốn chạy thử ở máy thì tạo một `wrangler.jsonc` riêng ở thư mục khác, trỏ `main` và `assets.directory` về dự án này (bản deploy thật không bị ảnh hưởng).
- `.assetsignore` ở thư mục gốc chặn `worker/`, `node_modules/`, `package.json`, `wrangler.jsonc`... không cho lên web công khai. Thêm file bí mật nào ở gốc thì nhớ thêm vào đó.
- Sửa lịch ca thì chỉ sửa `lich-ca.js`: web và bot Zalo cùng đổi theo.
