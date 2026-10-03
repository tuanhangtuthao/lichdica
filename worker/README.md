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

## Bảo mật đã chọn

- **Chỉ cần MSNV**, giống trang Tra Cứu. Lần đầu nhắn, bot hỏi MSNV rồi nhớ tài khoản Zalo đó. Ai gõ MSNV người khác thì xem được dữ liệu người đó.
- **Chỉ dữ liệu của chính người hỏi.** Không công cụ nào có tham số MSNV; MSNV được gắn cứng phía server. Hỏi về người khác thì bot không có cách nào tra.
- **Không trả lời trong nhóm Zalo**, vì cả nhóm đọc được.
- **Tối đa 40 câu / tài khoản / ngày** để chặn spam đốt tiền API. Đổi số ở `GIOI_HAN` trong `du-lieu.js`.

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
