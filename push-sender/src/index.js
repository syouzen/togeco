import PocketBase from 'pocketbase';
import webpush from 'web-push';

import { loadConfig } from './config.js';

const config = loadConfig();

webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

const pb = new PocketBase(config.pbUrl);
pb.autoCancellation(false); // 폴링 루프에서 중복 요청 자동취소를 끈다

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// superuser 인증. 토큰이 유효하면 재사용하고, 아니면 다시 로그인한다.
async function ensureAuth() {
  if (pb.authStore.isValid) return;
  await pb.collection('_superusers').authWithPassword(config.superuserEmail, config.superuserPassword);
  log('[auth] superuser 인증 완료');
}

// 웹 SW push 핸들러와의 계약: { title, body, url, tag }
function buildPayload(reminder, gifticon) {
  const name = gifticon?.name?.trim() || '기프티콘';
  return JSON.stringify({
    title: '기프티콘 만료 알림',
    body: `${name} 곧 만료돼요 (D-${reminder.offset_days})`,
    url: `/gifticons/${reminder.gifticon}`,
    tag: `reminder-${reminder.id}`,
  });
}

// 한 reminder의 모든 구독으로 발송. 만료된 구독(404/410)은 정리한다.
async function sendToUser(userId, payload) {
  const subs = await pb.collection('push_subscriptions').getFullList({
    filter: pb.filter('user = {:user}', { user: userId }),
  });
  if (!subs.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: config.pushTtlSeconds },
      );
      sent += 1;
    } catch (err) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await pb.collection('push_subscriptions').delete(sub.id).catch(() => undefined);
        removed += 1;
      } else {
        log('[send] 발송 실패', sub.id, status ?? err?.message ?? err);
      }
    }
  }
  return { sent, removed };
}

async function processReminder(reminder) {
  const gifticon = reminder.expand?.gifticon;

  // 사용완료/만료(없거나 AVAILABLE 아님)면 알림 의미가 없으니 발송 없이 처리만 한다.
  if (gifticon && gifticon.status === 'AVAILABLE') {
    const result = await sendToUser(reminder.user, buildPayload(reminder, gifticon));
    log(`[reminder] ${reminder.id} (D-${reminder.offset_days}) → 발송 ${result.sent} / 만료구독 정리 ${result.removed}`);
  } else {
    log(`[reminder] ${reminder.id} 스킵 (기프티콘 없음/미사용가능)`);
  }

  // 중복 발송 방지를 위해 처리 직후 sent=true. 실패한 발송은 앱 내 임박 배지로 폴백된다.
  await pb.collection('reminders').update(reminder.id, { sent: true });
}

async function tick() {
  await ensureAuth();

  const now = new Date().toISOString();
  const due = await pb.collection('reminders').getFullList({
    filter: pb.filter('remind_at <= {:now} && sent = false', { now }),
    expand: 'gifticon',
    sort: 'remind_at',
  });

  if (!due.length) return;
  log(`[tick] 발송 대상 reminder ${due.length}건`);

  for (const reminder of due) {
    try {
      await processReminder(reminder);
    } catch (err) {
      log('[reminder] 처리 실패', reminder.id, err?.message ?? err);
    }
  }
}

let running = false;
async function safeTick() {
  if (running) return; // 직전 tick이 길어지면 중첩 실행 방지
  running = true;
  try {
    await tick();
  } catch (err) {
    log('[tick] 실패', err?.message ?? err);
    pb.authStore.clear(); // 인증/네트워크 문제면 다음 tick에서 재인증
  } finally {
    running = false;
  }
}

log(`[start] togeco push-sender 시작 — PB=${config.pbUrl}, 폴링 ${config.pollIntervalMs}ms`);
safeTick();
const timer = setInterval(safeTick, config.pollIntervalMs);

function shutdown(signal) {
  log(`[stop] ${signal} 수신 — 종료`);
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
