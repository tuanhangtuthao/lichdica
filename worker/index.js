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
import {
  taoSb, timNV, layLienKet, luuMenu, duocHoiTiep, taoCongCu, laQuanLy, boDau,
  ghiChoXacNhan, huyChoXacNhan, xacNhanLienKet, goLienKet, NHOM,
  GIOI_HAN_NV, GIOI_HAN_QL,
} from './du-lieu.js';
import { taoCongCuQuanLy } from './du-lieu-xuong.js';
import { menuCaNhan, menuQuanLy, traLoiCaNhan, traLoiQuanLy, SO_SANG_CA_NHAN } from './menu.js';
import { hoiAI, cauBaoLoi } from './tro-ly-ai.js';
import { guiTin, datWebhook } from './zalo.js';
import { quetBao5S, baoBuKhiLienKet } from './bao-5s.js';

// Bỏ mọi khoảng trắng / ký tự vô hình. Dán chuỗi vào Terminal trên Windows
// hay dính thêm dấu cách, \r, ký tự BOM ở cuối mà mắt không thấy được, làm
// key trong link không bao giờ khớp. Chuỗi bí mật vốn chỉ gồm chữ và số nên
// bỏ mấy ký tự này không mất gì.
function sach(s) {
  return String(s || '').replace(/[\s​-‍⁠﻿]/g, '');
}

// Bản env đã làm sạch cả 3 secret, dùng cho mọi lời gọi Zalo / Claude
function lamSachEnv(env) {
  return { ...env, ZALO_SECRET: sach(env.ZALO_SECRET),
    ZALO_BOT_TOKEN: sach(env.ZALO_BOT_TOKEN), ANTHROPIC_API_KEY: sach(env.ANTHROPIC_API_KEY),
    // Thư viện Claude tự thêm /v1/messages, nên bỏ /v1 nếu bên bán ghi kèm
    // (vd https://api.vilao.ai/v1 -> https://api.vilao.ai)
    ANTHROPIC_BASE_URL: sach(env.ANTHROPIC_BASE_URL).replace(/\/+$/, '').replace(/\/v1$/, '') || undefined,
    CLAUDE_MODEL: sach(env.CLAUDE_MODEL) || undefined };
}

export default {
  // Cron 5 phút/lần (wrangler.jsonc "triggers"): báo 5S chưa đạt qua Zalo
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(quetBao5S(lamSachEnv(env)).catch(e => console.error('[bao5s]', e)));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const envSach = lamSachEnv(env);
    const biMat = envSach.ZALO_SECRET;

    if (url.pathname === '/api/zalo' && request.method === 'POST') {
      const hdr = sach(request.headers.get('X-Bot-Api-Secret-Token'));
      if (!biMat || hdr !== biMat) {
        // Ghi lý do từ chối để dò lỗi - chỉ độ dài, không bao giờ ghi giá trị
        console.warn('[zalo] từ chối POST', JSON.stringify({
          ua: request.headers.get('user-agent'), co_header: hdr.length > 0,
          dai_header: hdr.length, dai_bi_mat: biMat.length,
          ten_header: [...request.headers.keys()].filter(k => !/cookie|authorization/i.test(k)),
        }));
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json().catch(() => null);
      // Trả lời Zalo ngay, xử lý (gọi Claude mất vài giây) chạy nền
      ctx.waitUntil(xuLy(update, envSach).catch(e => console.error('[zalo]', e)));
      return Response.json({ message: 'Success' });
    }

    if (url.pathname === '/api/zalo' && request.method === 'GET') {
      // "co_" = có đặt chưa; "hop_le_" = độ dài / dạng trông đúng chưa (dán
      // vào Terminal Windows từng bị cắt còn 1 ký tự). Không lộ nội dung.
      const tok = sach(env.ZALO_BOT_TOKEN), key = sach(env.ANTHROPIC_API_KEY);
      // chữ giữ chỗ trong file mẫu zalo-secrets.json (DAN_..._VAO_DAY) từng bị
      // nạp nhầm lên vì quên lưu file -> coi là chưa hợp lệ
      const giuCho = s => /VAO_DAY/i.test(s);
      return Response.json({
        ok: true,
        co_ZALO_BOT_TOKEN: !!env.ZALO_BOT_TOKEN,
        co_ZALO_SECRET: !!env.ZALO_SECRET,
        co_ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
        hop_le_ZALO_BOT_TOKEN: tok.length >= 20 && !giuCho(tok),
        hop_le_ZALO_SECRET: biMat.length >= 8 && biMat.length <= 256 && !giuCho(biMat),
        // key chính chủ luôn là sk-ant-...; key bên thứ 3 thì dạng tuỳ bên bán
        hop_le_ANTHROPIC_API_KEY: envSach.ANTHROPIC_BASE_URL
          ? key.length >= 20 && !giuCho(key)
          : key.startsWith('sk-ant-') && key.length >= 40,
        may_chu_claude: envSach.ANTHROPIC_BASE_URL
          ? (() => { try { return new URL(envSach.ANTHROPIC_BASE_URL).host + ' (bên thứ 3)'; }
                     catch { return 'ANTHROPIC_BASE_URL sai dạng'; } })()
          : 'api.anthropic.com (chính chủ)',
        model: envSach.CLAUDE_MODEL || 'claude-haiku-4-5',
        dia_chi_webhook: sach(env.ZALO_WEBHOOK_URL) || `${url.origin}/api/zalo`,
      });
    }

    if (url.pathname === '/api/zalo/cai-dat') {
      const nhap = sach(url.searchParams.get('key'));
      if (!biMat || nhap !== biMat)
        // Chỉ báo độ dài để dò lỗi gõ / dán, không bao giờ lộ nội dung
        return new Response(`Sai key: chuỗi trong link dài ${nhap.length} ký tự, `
          + `ZALO_SECRET đã lưu dài ${biMat.length} ký tự.`, { status: 403 });
      // Đăng ký đúng chuỗi đã làm sạch -> header Zalo gửi về sẽ khớp biMat.
      // ZALO_WEBHOOK_URL: địa chỉ trạm chuyển tiếp Supabase, vì workers.dev
      // chặn User-Agent Java của Zalo (lỗi 1010). Không đặt thì Zalo gửi thẳng
      // vào worker (dùng được khi worker có tên miền riêng đã tắt BIC).
      const dich = sach(env.ZALO_WEBHOOK_URL) || `${url.origin}/api/zalo`;
      const kq = await datWebhook(envSach, dich);
      return Response.json(kq);
    }

    return env.ASSETS.fetch(request);
  },
};

// ── Liên kết an toàn: xác nhận tên, 1 MSNV = 1 tài khoản Zalo ──
function hoiXacNhan(nv) {
  return `Bạn là **${nv.name}**${nv.role ? ' – ' + nv.role : ''} (${NHOM[nv.kip] || ''})?\n`
    + '1️⃣ Đúng\n2️⃣ Không phải, nhập lại';
}
const BAO_BI_THAY = ms => `⚠️ MSNV ${ms} vừa được liên kết với một tài khoản Zalo khác.\n`
  + `Nếu không phải bạn, báo ngay cho quản lý.\nTài khoản này đã ngừng nhận thông tin của MSNV ${ms}.`;
const BAO_BI_GO = ms => `ℹ️ Quản lý đã gỡ tài khoản Zalo này khỏi MSNV ${ms}.\n`
  + 'Nếu đúng là bạn, nhắn lại MSNV để liên kết.';
// Báo cho tài khoản khác; lỗi gửi không được làm hỏng câu trả lời chính
async function baoNguoiKhac(env, ds, text) {
  for (const id of ds) {
    try { await guiTin(env, id, text); } catch (e) { console.error('[zalo] báo người khác lỗi:', e); }
  }
}

// Lời chào -> gửi menu. Chỉ tính khi tin ngắn (≤ 3 từ): "chào, mai tôi làm
// ca gì" là câu hỏi thật, phải đưa cho AI.
const LOI_CHAO = /^(chao|xin chao|hi|hello|helo|alo|hey|menu|bat dau|start)\b/;

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
    return gui('Mình chỉ đọc được tin nhắn chữ. Nhắn **0** để xem menu nhé.');

  // Lỗi gì cũng phải trả lời, đừng để người nhắn chờ suông
  try {
    await xuLyTin(msg, zaloId, gui, env);
  } catch (e) {
    console.error('[zalo] xử lý lỗi:', e);
    await gui('Trợ lý đang gặp sự cố, bạn hỏi lại sau ít phút nhé.');
  }
}

// Đặc tả: worker/MENU-ZALO.md
async function xuLyTin(msg, zaloId, gui, env) {
  const text = msg.text.trim();
  const tx = boDau(text);
  const sb = taoSb();
  const lk = await layLienKet(sb, zaloId);

  const doi = tx.match(/^(?:doi )?msnv:? ?([a-z0-9]+)$/);
  const laMa = /^\d{3,6}$/.test(text);
  const daLK = !!(lk && lk.msnv);

  // ── đang chờ xác nhận "Bạn là <tên>?" ──
  if (lk && lk.msnv_cho) {
    if (text === '1') {
      const nvMoi = await timNV(sb, lk.msnv_cho);
      if (!nvMoi) {
        await huyChoXacNhan(sb, zaloId);
        return gui(`MSNV ${lk.msnv_cho} không còn trong danh sách. Bạn nhắn lại MSNV giúp mình nhé.`);
      }
      const qlMoi = laQuanLy(nvMoi);
      const biThay = await xacNhanLienKet(sb, zaloId, nvMoi.id, msg.from.display_name, qlMoi ? 'quan_ly' : 'ca_nhan');
      await baoNguoiKhac(env, biThay, BAO_BI_THAY(nvMoi.id));
      await gui(qlMoi ? menuQuanLy(nvMoi) : menuCaNhan(nvMoi, false));
      // Báo bù các lượt 5S chưa đạt tháng này chưa từng báo cho người này.
      // Hỏng thì chỉ ghi log - menu đã gửi rồi, không báo lỗi cho người dùng.
      try { await baoBuKhiLienKet(env, nvMoi, zaloId, qlMoi); }
      catch (e) { console.error('[bao5s] báo bù lỗi:', e); }
      return;
    }
    if (text === '2') {
      await huyChoXacNhan(sb, zaloId);
      return gui(daLK ? `Đã huỷ. Bạn vẫn dùng MSNV **${lk.msnv}** như cũ. Nhắn **0** để xem menu.`
                      : 'Bạn nhắn lại MSNV giúp mình nhé (ví dụ: 1049).');
    }
    if (!doi && !laMa) {
      const nvCho = await timNV(sb, lk.msnv_cho);
      return gui('Bạn xác nhận giúp mình trước nhé:\n' + (nvCho ? hoiXacNhan(nvCho) : 'Nhắn **2** để nhập lại MSNV.'));
    }
    // gõ MSNV khác -> xuống dưới, đặt chờ xác nhận MSNV mới
  }

  // ── nhập / đổi MSNV -> hỏi xác nhận tên, CHƯA liên kết ──
  if (doi || (!daLK && laMa)) {
    const ma = doi ? doi[1] : text;
    const nv = await timNV(sb, ma);
    if (!nv) return gui(`Không tìm thấy MSNV **${ma}**. Bạn kiểm tra lại giúp mình nhé.`);
    if (daLK && String(nv.id) === String(lk.msnv))
      return gui(`Bạn đang dùng MSNV **${nv.id}** (${nv.name}) rồi. Nhắn **0** để xem menu.`);
    await ghiChoXacNhan(sb, zaloId, nv.id, msg.from.display_name);
    return gui(hoiXacNhan(nv));
  }

  if (!daLK)
    return gui(`Chào ${msg.from.display_name || 'bạn'} 👋 Mình là Trợ Lý Phân Xưởng 1.\n`
      + 'Bạn nhắn **MSNV** của mình (ví dụ: 1049) để bắt đầu nhé.');

  const nv = await timNV(sb, lk.msnv);
  if (!nv) return gui(`MSNV ${lk.msnv} không còn trong danh sách. Nhắn "đổi MSNV <số>" để cập nhật.`);
  const ql = laQuanLy(nv);

  // ── quản lý gỡ liên kết sai: "gỡ 1050" ──
  const go = tx.match(/^go (\d{3,6})$/);
  if (go) {
    if (!ql) return gui('Lệnh này chỉ dành cho quản lý. Nhắn **0** để xem menu nhé.');
    const biGo = await goLienKet(sb, go[1]);
    if (!biGo.length) return gui(`MSNV ${go[1]} chưa liên kết tài khoản Zalo nào.`);
    await baoNguoiKhac(env, biGo.filter(id => id !== zaloId), BAO_BI_GO(go[1]));
    return gui(`✅ Đã gỡ ${biGo.length} tài khoản Zalo khỏi MSNV ${go[1]}`
      + (biGo.includes(zaloId) ? ' (gồm cả tài khoản của bạn — nhắn MSNV để liên kết lại)' : '') + '.');
  }

  // Nhân viên luôn ở menu cá nhân. Quản lý: theo cột menu; chưa chạy
  // sql/zalo-menu.sql (chưa có cột) thì coi như đang ở menu quản lý.
  const menu = ql && lk.menu !== 'ca_nhan' ? 'quan_ly' : 'ca_nhan';

  // ── chào / 0 -> về menu "nhà" (quản lý: menu quản lý) ──
  if (text === '0' || (LOI_CHAO.test(tx) && tx.split(' ').length <= 3)) {
    if (!ql) return gui(menuCaNhan(nv, false));
    await luuMenu(sb, zaloId, 'quan_ly');
    return gui(menuQuanLy(nv));
  }

  // ── số trong menu: KHÔNG qua AI, không tính vào giới hạn ──
  if (/^\d{1,2}$/.test(text)) {
    const so = Number(text);
    if (menu === 'quan_ly') {
      if (so === SO_SANG_CA_NHAN) {
        await luuMenu(sb, zaloId, 'ca_nhan');
        return gui(menuCaNhan(nv, true));
      }
      return gui(await traLoiQuanLy(sb, so));
    }
    return gui(await traLoiCaNhan(sb, nv, so, ql));
  }

  // Gõ một MSNV khác khi đã liên kết: chỉ cách đổi, không đốt lượt AI
  if (laMa)
    return gui(`Bạn đang dùng MSNV **${nv.id}** (${nv.name}). Muốn đổi người thì nhắn: đổi MSNV ${text}`);

  // ── câu hỏi tự do -> AI ──
  const gioiHan = ql ? GIOI_HAN_QL : GIOI_HAN_NV;
  if (!(await duocHoiTiep(sb, lk, gioiHan)))
    return gui(`Hôm nay bạn đã hỏi ${gioiHan} câu tự do rồi. Bạn vẫn dùng menu số được nhé — nhắn **0** để xem.`);

  let traLoi;
  try {
    traLoi = await hoiAI({
      env, cauHoi: text, nhanVien: nv, laQL: ql,
      congCu: ql ? taoCongCuQuanLy(sb, nv) : taoCongCu(sb, nv),
    });
  } catch (e) {
    console.error('[claude]', e);
    traLoi = cauBaoLoi(e);
  }
  await gui(traLoi);
}
