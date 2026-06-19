import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Update with your GitHub Pages URL before deploying
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mensaje, historial = [], contexto = '' } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo "mensaje"' });

  const systemPrompt = `Eres un asistente de marketing digital especializado en análisis de campañas en redes sociales.
Responde ÚNICAMENTE con base en los datos de la campaña que se te proporcionan a continuación.
Sé conciso, directo y útil. Usa números exactos del dataset cuando los menciones.
Si la pregunta no tiene relación con los datos de la campaña, indícalo amablemente y ofrece ayuda con los datos disponibles.
Responde siempre en español.

DATOS DE LA CAMPAÑA:
${contexto}`;

  const messages = [
    ...historial.slice(-8).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: mensaje },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const respuesta = response.content[0]?.text || '(sin respuesta)';
    return res.status(200).json({ respuesta });
  } catch (err) {
    console.error('Anthropic error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al contactar la IA' });
  }
}
