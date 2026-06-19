import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const SYSTEM_PROMPT = `Eres un asistente de marketing digital especializado en análisis de campañas en redes sociales.
Responde ÚNICAMENTE con base en los datos de la campaña que se te proporcionan.
Sé conciso, directo y útil. Usa números exactos del dataset cuando los menciones.
Si la pregunta no tiene relación con los datos, indícalo amablemente.
Responde siempre en español.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mensaje, historial = [], contexto = '' } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo "mensaje"' });

  // Build Gemini chat history (role: 'user' | 'model')
  // First inject the system context as a user→model exchange
  const history = [
    {
      role: 'user',
      parts: [{ text: `${SYSTEM_PROMPT}\n\nDAT OS DE LA CAMPAÑA:\n${contexto}` }],
    },
    {
      role: 'model',
      parts: [{ text: 'Entendido. Estoy listo para responder preguntas sobre esta campaña de redes sociales.' }],
    },
    ...historial.slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(mensaje);
    const respuesta = result.response.text() || '(sin respuesta)';
    return res.status(200).json({ respuesta });
  } catch (err) {
    console.error('Gemini error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al contactar Gemini' });
  }
}
