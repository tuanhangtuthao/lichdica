// ═══════════════════════════════════════════════════════════════
// GỌI CLAUDE ĐỂ TRẢ LỜI CÂU HỎI QUA ZALO
// ═══════════════════════════════════════════════════════════════
// Vòng gọi tool tự viết (không dùng tool runner bản beta) để:
//   · chặn cứng số vòng, không để một câu hỏi đốt tiền vô hạn
//   · MSNV gắn sẵn trong công cụ, Claude không chọn được người khác
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { DINH_NGHIA_CONG_CU, DFUL, NHOM, dKey, homNayVN } from './du-lieu.js';

// Haiku 4.5: rẻ và nhanh, đủ cho tra cứu lịch ca / điểm. Muốn thông minh
// hơn thì đổi sang 'claude-opus-5-5' (đắt hơn khoảng 4-5 lần).
const MODEL = 'claude-haiku-4-5';
const VONG_TOI_DA = 4;          // 1 câu hỏi thường chỉ cần 1-2 vòng
const MAX_TOKENS = 1500;        // câu trả lời Zalo ngắn, tối đa 2000 ký tự

function lichMuoiBonNgay() {
  const t = homNayVN(), dong = [];
  for (let i = -1; i < 14; i++) {
    const d = new Date(t); d.setDate(d.getDate() + i);
    const ghi = i === -1 ? ' (hôm qua)' : i === 0 ? ' (HÔM NAY)' : i === 1 ? ' (ngày mai)' : '';
    dong.push(`${dKey(d)} ${DFUL[d.getDay()]}${ghi}`);
  }
  return dong.join('\n');
}

function taoSystem(nv) {
  const t = homNayVN();
  return `Bạn là Trợ Lý Phân Xưởng 1 của xưởng cơ khí BachTung, trả lời nhân viên qua Zalo.

Người đang nhắn: ${nv.name} - MSNV ${nv.id} - ${NHOM[nv.kip] || ''}${nv.role ? ' - ' + nv.role : ''}.
Hôm nay: ${DFUL[t.getDay()]} ${dKey(t)} (giờ Việt Nam). Tuần tính từ Thứ 2 đến Chủ nhật.

Lịch ngày để quy đổi "mai", "thứ 5", "tuần sau":
${lichMuoiBonNgay()}

Quy tắc:
- Bạn chỉ tra được thông tin CỦA CHÍNH người đang nhắn: lịch ca, ngày nghỉ, tăng ca, nghỉ phép, đánh giá / xếp loại, vi phạm 5S, và tiêu chí 5S chung của xưởng.
- Mọi con số, ca làm, ngày tháng phải lấy từ công cụ. Không có dữ liệu thì nói là chưa có, tuyệt đối không đoán.
- Nếu hỏi về người khác, hoặc chuyện ngoài các mục trên (lương, nội quy, chuyện riêng...), nói lịch sự rằng bạn chỉ tra được các thông tin cá nhân kể trên.
- Ở xưởng này "Nghỉ" là ngày nghỉ, "Ca Chiều" là ca 18h đến 6h sáng hôm sau. Dùng đúng nhãn ca mà công cụ trả về.
- Trả lời tiếng Việt, xưng "mình", gọi "bạn", ngắn gọn thân thiện, dưới 1200 ký tự.
- Định dạng cho Zalo: được dùng **in đậm** và gạch đầu dòng "- ". Không dùng bảng, không dùng tiêu đề #.
- Ghi ngày dạng "Thứ 5 15/10".`;
}

function layChu(res) {
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

export async function hoiAI({ env, cauHoi, nhanVien, congCu }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const system = taoSystem(nhanVien);
  const messages = [{ role: 'user', content: cauHoi }];

  for (let vong = 0; vong < VONG_TOI_DA; vong++) {
    const res = await client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS, system, tools: DINH_NGHIA_CONG_CU, messages,
    });

    if (res.stop_reason === 'refusal')
      return 'Câu này mình không trả lời được. Bạn hỏi về lịch ca, đánh giá hay 5S của bạn nhé.';
    if (res.stop_reason !== 'tool_use')
      return layChu(res) || 'Mình chưa hiểu câu hỏi. Bạn hỏi lại ngắn gọn hơn giúp mình nhé.';

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
