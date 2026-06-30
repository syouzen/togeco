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

  if (!body.imageBase64) {
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
          { text: '이 한국 기프티콘 이미지에서 정보를 추출해 JSON으로 반환해. 브랜드와 상품명을 합쳐 name으로 만들고, 금액권이면 amount는 원 단위 정수로, 금액이 없으면 amount=null, isExchange=true. 유효기간은 YYYY-MM-DD만, 상대표현이거나 불명확하면 expiry=null.' },
          { inline_data: { mime_type: 'image/jpeg', data: body.imageBase64 } },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            amount: { type: 'INTEGER', nullable: true },
            expiry: { type: 'STRING', nullable: true },
            isExchange: { type: 'BOOLEAN' },
          },
          required: ['name', 'amount', 'expiry', 'isExchange'],
        },
      },
    }),
    timeout: 30,
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return e.json(502, { message: 'Gemini scan request failed', status: res.statusCode });
  }

  const text = res.json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return e.json(502, { message: 'Gemini scan response was empty' });
  }

  return e.json(200, JSON.parse(text));
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

cronAdd('personal-gifticon-reminders', '0 9 * * *', () => {
  try {
    const now = new Date().toISOString();
    const reminders = $app.findRecordsByFilter(
      'reminders',
      'sent = false && remind_at <= {:now}',
      'remind_at',
      200,
      0,
      { now },
    );

    reminders.forEach((reminder) => {
      try {
        const user = reminder.get('user');
        const tokens = $app.findRecordsByFilter('push_tokens', 'user = {:user}', '', 50, 0, { user });
        const gifticon = $app.findRecordById('gifticons', reminder.get('gifticon'));
        const name = gifticon.get('name') || '기프티콘';
        const messages = tokens.map((token) => ({
          to: token.get('token'),
          title: '기프티콘 알림',
          body: name + ' 잊지 말고 쓰세요!',
          sound: null,
          data: { type: 'reminder', gifticon: reminder.get('gifticon') },
        })).filter((message) => message.to);
        sendExpoPushMessages(messages);
        reminder.set('sent', true);
        $app.save(reminder);
      } catch (err) {
        console.log('personal reminder push failed', err);
      }
    });
  } catch (err) {
    console.log('personal reminder cron failed', err);
  }
});
