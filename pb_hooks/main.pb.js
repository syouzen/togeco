function sendExpoPushMessages(messages) {
  if (!messages.length) return;
  $http.send({
    url: 'https://exp.host/--/api/v2/push/send',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(messages),
    timeout: 15,
  });
}

function pushTokenRecords(excludeUserId) {
  const records = $app.findRecordsByFilter('push_tokens', '', '', 500, 0);
  return records.filter((record) => {
    const user = record.get('user');
    const token = record.get('token');
    return token && (!excludeUserId || user !== excludeUserId);
  });
}

function sendGifticonPush(title, body, excludeUserId) {
  const messages = pushTokenRecords(excludeUserId).map((record) => ({
    to: record.get('token'),
    title,
    body,
    sound: null,
    data: { type: 'gifticon' },
  }));
  sendExpoPushMessages(messages);
}

routerAdd('POST', '/api/scan', (e) => {
  const body = new DynamicModel({ imageBase64: '' });
  e.bindBody(body);

  let img = body.imageBase64 || '';
  if (img.startsWith('data:')) img = img.slice(img.indexOf(',') + 1);

  if (!img) {
    return e.json(400, { message: 'imageBase64 is required' });
  }

  const key = $os.getenv('GEMINI_API_KEY');
  if (!key) {
    return e.json(500, { message: 'GEMINI_API_KEY is not configured' });
  }

  const res = $http.send({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: '이 한국 기프티콘 이미지에서 정보를 추출해 JSON으로 반환해. brand는 브랜드/매장명만(예: 스타벅스, GS25, BBQ), name은 상품명만. 브랜드를 못 찾으면 brand=null. 금액권이면 amount는 원 단위 정수, 금액이 없으면(교환권) amount=null, isExchange=true. 유효기간은 expired_at에 YYYY-MM-DD로 정규화해 넣어. 2026.12.31, 26/12/31, 2026년 12월 31일 형식은 모두 YYYY-MM-DD로 변환해. 상대표현이거나 불명확하면 expired_at=null. 화면에 실제로 보이는 값만 사용하고, 안 보이면 절대 추측하지 말고 null.' },
          { inline_data: { mime_type: 'image/jpeg', data: img } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            brand: { type: 'STRING', nullable: true },
            name: { type: 'STRING' },
            amount: { type: 'INTEGER', nullable: true },
            expired_at: { type: 'STRING', nullable: true },
            isExchange: { type: 'BOOLEAN' },
          },
          required: ['brand', 'name', 'amount', 'expired_at', 'isExchange'],
        },
      },
    }),
    timeout: 30,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return e.json(502, { error: 'gemini_request_failed', status: res.statusCode, raw: res.json });
  }

  const cand = res.json?.candidates?.[0];
  if (!cand) {
    return e.json(502, { error: 'no_result', raw: res.json });
  }

  const text = cand.content?.parts?.[0]?.text;
  if (!text) {
    return e.json(502, { error: 'empty_result', raw: res.json });
  }

  try {
    return e.json(200, JSON.parse(text));
  } catch {
    return e.json(502, { error: 'invalid_json', raw: res.json });
  }
}, $apis.requireAuth());

onRecordAfterCreateSuccess((e) => {
  try {
    const name = e.record.get('name') || '기프티콘 추가됨';
    sendGifticonPush('새 기프티콘', name, e.record.get('owner'));
  } catch (err) {
    console.log('gifticon push failed', err);
  }
  e.next();
}, 'gifticons');

cronAdd('expiring-gifticon-push', '0 9 * * *', () => {
  try {
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const startText = now.toISOString().slice(0, 10) + ' 00:00:00.000Z';
    const endText = end.toISOString().slice(0, 10) + ' 23:59:59.999Z';
    const gifticons = $app.findRecordsByFilter(
      'gifticons',
      'status = "AVAILABLE" && expired_at >= {:start} && expired_at <= {:end}',
      'expired_at',
      50,
      0,
      { start: startText, end: endText },
    );
    if (!gifticons.length) return;
    const names = gifticons.slice(0, 3).map((record) => record.get('name') || '이름 없는 기프티콘').join(', ');
    const more = gifticons.length > 3 ? ' 외 ' + (gifticons.length - 3) + '개' : '';
    sendGifticonPush('만료 임박 기프티콘', names + more + ' 확인해주세요.', '');
  } catch (err) {
    console.log('expiring gifticon push failed', err);
  }
});
