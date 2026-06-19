const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const API_KEY = process.env.GEMINI_API_KEY;

// Models in priority order — tries each until one works
const MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-1.0-pro',
];

const SYSTEM_PROMPT = `Eres un asistente de marketing digital especializado en análisis de campañas en redes sociales de La Ibérica AQP.
Responde ÚNICAMENTE con base en los datos de la campaña que se te proporcionan.
Sé conciso, directo y útil. Usa números exactos del dataset.
Responde siempre en español.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });

  const { mensaje, historial = [], contexto = '' } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo "mensaje"' });

  const contents = [
    { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nDATOS DE LA CAMPAÑA:\n${contexto}` }] },
    { role: 'model', parts: [{ text: 'Entendido. Listo para responder sobre la campaña.' }] },
    ...historial.slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: mensaje }] },
  ];

  const body = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
  });

  // Try each model in order, pick the first that responds
  let lastError = '';
  for (const model of MODELS) {
    // Try v1 first, then v1beta
    for (const apiVersion of ['v1', 'v1beta']) {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${API_KEY}`;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await r.json();
        if (r.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
          return res.status(200).json({ respuesta: text, modelo: `${model} (${apiVersion})` });
        }
        // 404 = model not found, try next; 429/400/401 = stop or try next model
        lastError = data?.error?.message || `HTTP ${r.status}`;
        if (r.status === 404) break; // this apiVersion doesn't have the model, skip apiVersion loop
        if (r.status === 401 || r.status === 403) {
          return res.status(r.status).json({ error: 'Clave de Gemini inválida o sin permisos. Verifica GEMINI_API_KEY en Vercel.' });
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }

  return res.status(500).json({ error: `Ningún modelo de Gemini disponible para esta clave. Último error: ${lastError}` });
}
