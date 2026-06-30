// 환경변수를 읽고 검증한다. 필수값이 비면 즉시 종료해 운영 사고를 빨리 드러낸다.
const REQUIRED = [
  'PB_URL',
  'PB_SUPERUSER_EMAIL',
  'PB_SUPERUSER_PASSWORD',
  'VAPID_SUBJECT',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

export function loadConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[config] 필수 환경변수 누락: ${missing.join(', ')}`);
    process.exit(1);
  }

  return {
    pbUrl: process.env.PB_URL,
    superuserEmail: process.env.PB_SUPERUSER_EMAIL,
    superuserPassword: process.env.PB_SUPERUSER_PASSWORD,
    vapidSubject: process.env.VAPID_SUBJECT,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 60_000),
    // 알림 TTL(초). 푸시 서비스가 이 시간까지만 배달을 시도한다.
    pushTtlSeconds: Number(process.env.PUSH_TTL_SECONDS ?? 86_400),
  };
}
