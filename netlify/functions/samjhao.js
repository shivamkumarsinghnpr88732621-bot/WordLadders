// Netlify Function: /.netlify/functions/samjhao
// Calls Google Gemini's free-tier API server-side, so the API key never
// reaches the browser. Set GEMINI_API_KEY in Netlify's environment variables.

const MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    word: { type: 'STRING' },
    wordTypes: { type: 'ARRAY', items: { type: 'STRING' } },
    phonetic: { type: 'STRING' },
    meaningEnglish: { type: 'STRING' },
    meaningHindi: { type: 'STRING' },
    sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          highlight: { type: 'STRING' },
          explanation: { type: 'STRING' },
          difficulty: { type: 'INTEGER' },
        },
        required: ['text', 'highlight', 'explanation', 'difficulty'],
      },
    },
    tip: { type: 'STRING' },
  },
  required: ['word', 'wordTypes', 'phonetic', 'meaningEnglish', 'meaningHindi', 'sentences', 'tip'],
};

function buildPrompt(word, sentenceCount) {
  return `Tum ek English vocabulary tutor ho jo Class 11 JEE-prep Indian student ko Hinglish (Hindi + English mix, Roman script) mein padhata hai.

Student ne ye word type kiya hai jo usse book padhte waqt atka: "${word}"

Ise explain karo is JSON structure mein (schema follow karo strictly):
- word: correct spelling of the word
- wordTypes: array jaise ["noun"], ["verb", "adjective"] etc — jo bhi applicable ho
- phonetic: IPA-style phonetic transcription, e.g. "/wɪstfʊl/"
- meaningEnglish: ek clear, simple English definition (1 sentence)
- meaningHindi: 2-4 chote Hindi/Hinglish synonyms ya phrases, comma se separated (jaise "jaise, ke roop mein, jab")
- sentences: exactly ${sentenceCount} example sentences, EASY se ADVANCED tak graded (difficulty 1 se ${sentenceCount}):
  - text: natural English sentence using the word
  - highlight: the exact word/phrase form used in that sentence (for highlighting)
  - explanation: ek chhoti Hinglish line jo bataye ye usage kis context/pattern mein hota hai
  - difficulty: 1 (sabse easy) se ${sentenceCount} (sabse advanced) tak
- tip: ek useful Hinglish tip — common confusion, related word se distinction, ya memory trick

Sirf valid JSON return karo, kuch aur nahi.`;
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Server par GEMINI_API_KEY set nahi hai. Netlify env vars mein add karo.' }),
    };
  }

  let word, sentenceCount;
  try {
    const body = JSON.parse(event.body || '{}');
    word = String(body.word || '').trim().slice(0, 60);
    sentenceCount = Math.min(8, Math.max(3, Number(body.sentenceCount) || 6));
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!word) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Word missing hai' }) };
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(word, sentenceCount) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Gemini API error', res.status, errText);
      const friendly =
        res.status === 429
          ? 'Free tier ki limit abhi hit ho gayi, thodi der mein try karo.'
          : 'AI se response nahi mil paya. Phir se try karo.';
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: friendly }) };
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Khaali response aaya, phir try karo.' }) };
    }

    const parsed = JSON.parse(rawText);
    return { statusCode: 200, headers: cors, body: JSON.stringify(parsed) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Kuch gadbad ho gayi server side.' }) };
  }
};
