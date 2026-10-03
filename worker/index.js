// ═══════════════════════════════════════════════════════════════
// WORKER lichdica: phục vụ web tĩnh + nhận webhook của Zalo Bot
// ═══════════════════════════════════════════════════════════════
// Mọi đường dẫn có file tĩnh (index.html, lich-ca.js...) Cloudflare trả thẳng,
// không chạy qua đây. Chỉ /api/... (không có file tương ứng) mới vào worker.
//
//   POST /api/zalo            Zalo gửi tin nhắn tới
//   GET  /api/zalo            kiểm tra đã đặt đủ secret chưa
//   GET  /api/zalo/cai-dat?key=<ZALO_SECRET>
//                             đăng ký webhook với Zalo (chạy 1 lần)
//
// Secret cần đặt trên Cloudflare (không bao giờ ghi vào code):
//   ZALO_BOT_TOKEN     token của bot Zalo
//   ZALO_SECRET        chuỗi tự đặt 8-256 ký tự, Zalo gửi kèm để ta biết
//                      request đúng là từ Zalo
//   ANTHROPIC_API_KEY  key Claude API
// Hướng dẫn cài đặt: worker/README.md
// ═══════════════════════════════════════════════════════════════
import { taoSb, timNV, layLienKet, luuLienKet, duocHoiTiep, taoCongCu, NHOM, GIOI_HAN } from './du-lieu.js';
import { hoiAI, cauBaoLoi } from './tro-ly-ai.js';
import { guiTin, datWebhook } from './zalo.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/zalo' && request.method === 'POST') {
      if (!env.ZALO_SECRET || request.headers.get('X-Bot-Api-Secret-Token') !== env.ZALO_SECRET)
        return new Response('forbidden', { status: 403 });
      const update = await request.json().catch(() => null);
      // Trả lời Zalo ngay, xử lý (gọi Claude mất vài giây) chạy nền
      ctx.waitUntil(xuLy(update, env).catch(e => console.error('[zalo]', e)));
      return Response.json({ message: 'Success' });
    }

    if (url.pathname === '/api/zalo' && request.method === 'GET') {
      return Response.json({
        ok: true,
        co_ZALO_BOT_TOKEN: !!env.ZALO_BOT_TOKEN,
        co_ZALO_SECRET: !!env.ZALO_SECRET,
        co_ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
      });
    }

    if (url.pathname === '/api/zalo/cai-dat') {
      if (!env.ZALO_SECRET || url.searchParams.get('key') !== env.ZALO_SECRET)
        return new Response('Sai key', { status: 403 });
      const kq = await datWebhook(env, `${url.origin}/api/zalo`);
      return Response.json(kq);
    }

    return env.ASSETS.fetch(request);
  },
};

// Bỏ dấu để nhận "đổi MSNV", "doi msnv"...
function boDau(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

const GOI_Y = '- Mai tôi làm ca gì?\n- Lịch tuần sau của tôi\n- Khi nào tôi được nghỉ?\n'
  + '- Xếp loại tháng này của tôi\n- Tôi vi phạm 5S mấy lần?';

async function xuLy(update, env) {
  // Zalo có thể gói trong { ok, result } hoặc gửi thẳng result
  const ev = update && (update.result || update);
  const msg = ev && ev.message;
  if (!msg || !msg.chat || !msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id, zaloId = msg.from.id;
  const gui = text => guiTin(env, chatId, text);

  // Trong nhóm ai cũng đọc được câu trả lời -> không trả dữ liệu cá nhân ở đó
  if (msg.chat.chat_type && msg.chat.chat_type !== 'PRIVATE')
    return gui('Mình chỉ trả lời tin nhắn riêng để giữ kín thông tin cá nhân. Bạn nhắn riêng cho mình nhé.');
  if (ev.event_name !== 'message.text.received' || !msg.text)
    return gui('Mình chỉ đọc được tin nhắn chữ thôi bạn nhé.');

  // Lỗi gì cũng phải trả lời, đừng để người nhắn chờ suông
  try {
    await xuLyTin(msg, zaloId, gui, env);
  } catch (e) {
    console.error('[zalo] xử lý lỗi:', e);
    await gui('Trợ lý đang gặp sự cố, bạn hỏi lại sau ít phút nhé.');
  }
}

async function xuLyTin(msg, zaloId, gui, env) {
  const text = msg.text.trim();
  const sb = taoSb();
  const lk = await layLienKet(sb, zaloId);

  // ── nhập / đổi MSNV ──
  const doi = boDau(text).match(/^(?:doi )?msnv:? ?([a-z0-9]+)$/);
  const chiLaSo = /^\d{3,6}$/.test(text);
  if (doi || (!lk && chiLaSo)) {
    const ma = doi ? doi[1] : text;
    const nv = await timNV(sb, ma);
    if (!nv) return gui(`Không tìm thấy MSNV **${ma}**. Bạn kiểm tra lại giúp mình nhé.`);
    await luuLienKet(sb, zaloId, nv.id, msg.from.display_name);
    return gui(`Chào **${nv.name}** (${NHOM[nv.kip] || ''}) 👋\n`
      + `Từ giờ bạn cứ hỏi thẳng, ví dụ:\n${GOI_Y}\n\nCần đổi người thì nhắn "đổi MSNV 1234".`);
  }

  if (!lk)
    return gui(`Chào ${msg.from.display_name || 'bạn'} 👋 Mình là Trợ Lý Phân Xưởng 1.\n`
      + 'Bạn nhắn **MSNV** của mình (ví dụ: 1049) để bắt đầu nhé.');

  if (!(await duocHoiTiep(sb, lk)))
    return gui(`Hôm nay bạn đã hỏi ${GIOI_HAN} câu rồi, mai hỏi tiếp nhé.`);

  const nv = await timNV(sb, lk.msnv);
  if (!nv) return gui(`MSNV ${lk.msnv} không còn trong danh sách. Nhắn "đổi MSNV <số>" để cập nhật.`);

  let traLoi;
  try {
    traLoi = await hoiAI({ env, cauHoi: text, nhanVien: nv, congCu: taoCongCu(sb, nv) });
  } catch (e) {
    console.error('[claude]', e);
    traLoi = cauBaoLoi(e);
  }
  await gui(traLoi);
}
