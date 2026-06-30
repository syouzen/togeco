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
