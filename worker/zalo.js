// ═══════════════════════════════════════════════════════════════
// GỌI ZALO BOT API  (tài liệu: https://bot.zapps.me/docs/)
// ═══════════════════════════════════════════════════════════════
const API = 'https://bot-api.zaloplatforms.com/bot';
const TOI_DA = 2000;   // sendMessage nhận 1-2000 ký tự

async function goi(env, method, body) {
  // ZALO_API_BASE chỉ dùng khi chạy thử ở máy (trỏ sang Zalo giả lập).
  // Trên Cloudflare không đặt biến này -> luôn gọi Zalo thật.
  const base = env.ZALO_API_BASE || API;
  const goiMotLan = () => fetch(`${base}${env.ZALO_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Gửi 2 tin liền nhau (vd báo người bị thay + menu người mới) từng gặp
  // "Network connection lost" -> thử lại 1 lần sau 0,5 giây rồi mới chịu lỗi.
  let res;
  try { res = await goiMotLan(); }
  catch (e) {
    console.warn(`[zalo] ${method} đứt mạng, thử lại:`, e.message);
    await new Promise(r => setTimeout(r, 500));
    res = await goiMotLan();
  }
  const kq = await res.json().catch(() => ({ ok: false, description: 'HTTP ' + res.status }));
  if (!kq.ok) console.error(`[zalo] ${method} lỗi:`, JSON.stringify(kq));
  return kq;
}

export async function guiTin(env, chatId, text) {
  let t = String(text || '').trim() || '...';
  if (t.length > TOI_DA) t = t.slice(0, TOI_DA - 1) + '…';
  const kq = await goi(env, 'sendMessage', { chat_id: chatId, text: t, parse_mode: 'markdown' });
  if (kq.ok) return kq;
  // markdown hỏng (vd thừa dấu *) thì gửi lại chữ trơn, đừng để người hỏi chờ suông
  return goi(env, 'sendMessage', { chat_id: chatId, text: t.replace(/\*\*/g, '') });
}

export function datWebhook(env, url) {
  return goi(env, 'setWebhook', { url, secret_token: env.ZALO_SECRET });
}
