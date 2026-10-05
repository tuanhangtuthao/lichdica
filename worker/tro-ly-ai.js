// ═══════════════════════════════════════════════════════════════
// GỌI CLAUDE ĐỂ TRẢ LỜI CÂU HỎI QUA ZALO
// ═══════════════════════════════════════════════════════════════
// Vòng gọi tool tự viết (không dùng tool runner bản beta) để:
//   · chặn cứng số vòng, không để một câu hỏi đốt tiền vô hạn
//   · MSNV gắn sẵn trong công cụ, Claude không chọn được người khác
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { DFUL, NHOM, dKey, homNayVN } from './du-lieu.js';

// Haiku 4.5: rẻ và nhanh, đủ cho tra cứu lịch ca / điểm. Muốn thông minh
// hơn thì đổi sang 'claude-opus-5-5' (đắt hơn khoảng 4-5 lần).
// Secret CLAUDE_MODEL (tuỳ chọn) đè giá trị này nếu bên cung cấp key đặt tên model khác.
const MODEL = 'claude-haiku-4-5';
const VONG_TOI_DA = 4;          // 1 câu hỏi thường chỉ cần 1-2 vòng
const MAX_TOKENS = 1500;        // câu trả lời Zalo ngắn, tối đa 2000 ký tự
// Cloudflare chỉ cho chạy tiếp tối đa 30 giây sau khi đã trả lời Zalo. Qua
// máy chủ bên thứ 3, một câu đo được tới 23,6 giây. Quá mốc này thì dừng và
// báo chậm, thay vì bị Cloudflare cắt ngang làm người hỏi chờ suông.
const HAN_CHOT_MS = 24000;
export const CAU_CHAM = 'Trợ lý đang chậm, bạn hỏi lại sau ít phút nhé.';
// Không bao giờ im lặng: AI không ra được câu trả lời thì dùng câu này
export const CAU_CHUA_HIEU = '🤔 Mình chưa hiểu câu này.\nBạn nhắn **0** để xem menu, hoặc hỏi lại ngắn gọn, vd: "mai tôi làm ca gì?"';

function lichMuoiBonNgay() {
  const t = homNayVN(), dong = [];
  for (let i = -1; i < 14; i++) {
    const d = new Date(t); d.setDate(d.getDate() + i);
    const ghi = i === -1 ? ' (hôm qua)' : i === 0 ? ' (HÔM NAY)' : i === 1 ? ' (ngày mai)' : '';
    dong.push(`${dKey(d)} ${DFUL[d.getDay()]}${ghi}`);
  }
  return dong.join('\n');
}

function taoSystem(nv, laQL) {
  const t = homNayVN();
  return `Bạn là Trợ Lý Phân Xưởng 1 của xưởng cơ khí BachTung, trả lời nhân viên qua Zalo.

Người đang nhắn: ${nv.name} - MSNV ${nv.id} - ${NHOM[nv.kip] || ''}${nv.role ? ' - ' + nv.role : ''}.
Hôm nay: ${DFUL[t.getDay()]} ${dKey(t)} (giờ Việt Nam). Tuần tính từ Thứ 2 đến Chủ nhật.

Lịch ngày để quy đổi "mai", "thứ 5", "tuần sau":
${lichMuoiBonNgay()}

Quy tắc:
${laQL ? QUYEN_QUAN_LY : QUYEN_NHAN_VIEN}
- Mọi con số, ca làm, ngày tháng phải lấy từ công cụ. Không có dữ liệu thì nói là chưa có, tuyệt đối không đoán.
- Không hiểu câu hỏi thì nói thẳng là chưa hiểu và gợi ý nhắn **0** để xem menu.
- Ở xưởng này "Nghỉ" là ngày nghỉ, "Ca Chiều" là ca 18h đến 6h sáng hôm sau. Dùng đúng nhãn ca mà công cụ trả về.
- Trả lời tiếng Việt, xưng "mình", gọi "bạn", ngắn gọn thân thiện, dưới 1200 ký tự.
- Định dạng cho Zalo: được dùng **in đậm** và gạch đầu dòng "- ". Không dùng bảng, không dùng tiêu đề #.
- Ghi ngày dạng "Thứ 5 15/10".`;
}

const QUYEN_NHAN_VIEN = `- Bạn chỉ tra được thông tin CỦA CHÍNH người đang nhắn: lịch ca, ngày nghỉ, tăng ca, nghỉ phép, đánh giá / xếp loại, vi phạm 5S, và tiêu chí 5S chung của xưởng.
- Nếu hỏi về người khác, hoặc chuyện ngoài các mục trên (lương, nội quy, chuyện riêng...), trả lời đúng ý: "Mình chỉ tra được lịch ca, điểm, 5S, tăng ca, nghỉ phép **của chính bạn**. Nhắn **0** để xem menu nhé."`;

const QUYEN_QUAN_LY = `- Người đang nhắn là QUẢN LÝ, được xem dữ liệu của CẢ XƯỞNG: ai làm ca nào, quân số, điểm / xếp loại, vi phạm 5S, tăng ca, nghỉ phép của bất kỳ ai, đơn xin nghỉ chờ duyệt.
- Hỏi về một người cụ thể theo tên thì dùng tim_nhan_vien để lấy MSNV trước, rồi dùng du_lieu_nhan_vien. Tên trùng nhiều người thì liệt kê để người hỏi chọn.
- "Ca tối" hay "ca đêm" chính là Ca Chiều (mã C, 18h-6h). Hỏi về chính người đang nhắn thì dùng các công cụ cá nhân.
- Chuyện ngoài các mục trên (lương, nội quy...) thì nói lịch sự là chưa tra được, gợi ý nhắn **0** để xem menu.`;

function layChu(res) {
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// congCu: { dinhNghia, chay } - bộ cá nhân (nhân viên) hoặc bộ quản lý
export async function hoiAI({ env, cauHoi, nhanVien, congCu, laQL }) {
  // ANTHROPIC_BASE_URL: đang dùng key mua qua bên thứ 3 nên phải gọi qua máy
  // chủ của họ (họ phải hỗ trợ đúng định dạng Messages API của Anthropic).
  // LƯU Ý: khi đặt biến này, dữ liệu nhân sự trong câu hỏi đi qua máy chủ bên
  // thứ 3 trước khi tới Claude. Đổi sang key chính chủ: xoá secret này đi.
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
  });
  const model = env.CLAUDE_MODEL || MODEL;
  const system = taoSystem(nhanVien, laQL);
  const messages = [{ role: 'user', content: cauHoi }];

  const batDau = Date.now();
  for (let vong = 0; vong < VONG_TOI_DA; vong++) {
    const conLai = HAN_CHOT_MS - (Date.now() - batDau);
    if (conLai < 2000) return CAU_CHAM;
    // không tự thử lại: thử lại là vượt luôn hạn chót
    const res = await client.messages.create({
      model, max_tokens: MAX_TOKENS, system, tools: congCu.dinhNghia, messages,
    }, { timeout: conLai, maxRetries: 0 });

    if (res.stop_reason === 'refusal')
      return 'Câu này mình không trả lời được. Nhắn **0** để xem menu nhé.';
    if (res.stop_reason !== 'tool_use')
      return layChu(res) || CAU_CHUA_HIEU;

    messages.push({ role: 'assistant', content: res.content });
    const ketQua = [];
    for (const b of res.content) {
      if (b.type !== 'tool_use') continue;
      try {
        const out = await congCu.chay(b.name, b.input);
        ketQua.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      } catch (e) {
        ketQua.push({ type: 'tool_result', tool_use_id: b.id, content: 'Lỗi: ' + e.message, is_error: true });
      }
    }
    // Trả hết kết quả trong MỘT lượt user (đúng quy ước gọi tool song song)
    messages.push({ role: 'user', content: ketQua });
  }
  return 'Câu này hơi phức tạp, bạn tách ra hỏi từng ý giúp mình nhé.';
}

// Đổi lỗi API thành câu dễ hiểu cho nhân viên; chi tiết thật thì ghi log
export function cauBaoLoi(e) {
  if (e instanceof Anthropic.APIConnectionTimeoutError)
    return CAU_CHAM;
  if (e instanceof Anthropic.RateLimitError)
    return 'Trợ lý đang quá tải, bạn hỏi lại sau ít phút nhé.';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return 'Trợ lý đang bảo trì, bạn báo quản lý giúp mình nhé.';
  if (e instanceof Anthropic.APIConnectionError)
    return 'Mạng đang chập chờn, bạn hỏi lại sau chút nhé.';
  if (e instanceof Anthropic.APIError)
    return 'Trợ lý đang gặp sự cố, bạn hỏi lại sau nhé.';
  return 'Có lỗi khi tra dữ liệu, bạn hỏi lại sau nhé.';
}
