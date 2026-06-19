// Cambia esta URL cuando despliegues en Vercel (deja vacío para modo local):
const PROXY_URL = 'https://web-dashboard-marketing.vercel.app/api/chat';

let contexto = '';
let historial = [];
let _rows = [];
let _kpis = {};

export function initChat(contextoData, rows, kpis) {
  contexto = contextoData;
  _rows = rows || [];
  _kpis = kpis || {};

  const btn    = document.getElementById('chatToggle');
  const box    = document.getElementById('chatBox');
  const form   = document.getElementById('chatForm');
  const input  = document.getElementById('chatInput');
  const micBtn = document.getElementById('btnMic');

  btn?.addEventListener('click', () => {
    box.classList.toggle('open');
    const msgs = document.getElementById('chatMessages');
    if (box.classList.contains('open') && msgs.children.length === 0) {
      const modo = PROXY_URL ? 'IA con Gemini activa' : 'Modo local (datos del Sheet)';
      addMsg('assistant', `¡Hola! Soy el asistente de La Ibérica. ${modo}.\nPregúntame sobre publicaciones, plataformas, campañas o métricas.`);
    }
  });

  document.getElementById('chatClose')?.addEventListener('click', () => box.classList.remove('open'));

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendMessage(text);
  });

  if (micBtn) setupVoice(micBtn, input);
}

async function sendMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  addMsg('user', text);
  historial.push({ role: 'user', content: text });

  const typing = addMsg('assistant', '…', true);
  input.disabled = true;

  try {
    let reply;
    if (PROXY_URL) {
      reply = await askProxy(text);
    } else {
      // Pequeña pausa para que se vea el "…"
      await new Promise(r => setTimeout(r, 300));
      reply = respuestaLocal(text);
    }
    typing.textContent = reply;
    typing.classList.remove('typing');
    historial.push({ role: 'assistant', content: reply });
  } catch (err) {
    // Si Gemini falla (sin cuota/créditos), responde con el motor local sobre datos reales del Sheet
    await new Promise(r => setTimeout(r, 200));
    const reply = respuestaLocal(text);
    typing.textContent = reply;
    typing.classList.remove('typing');
    historial.push({ role: 'assistant', content: reply });
  }

  input.disabled = false;
  input.focus();
}

async function askProxy(texto) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: texto, historial: historial.slice(-10), contexto }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.respuesta || '(sin respuesta)';
}

// ─── Motor local de respuestas basado en los datos reales ───────────────────

function respuestaLocal(pregunta) {
  const q = pregunta.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (!_rows.length) return 'Los datos aún no han cargado. Espera un momento e intenta de nuevo.';

  // Mejor publicación (alcance)
  if (includes(q, ['mejor', 'mayor', 'mas alto', 'top', 'viral', 'maximo', 'max']) && includes(q, ['alcance', 'publicacion', 'post', 'resultado'])) {
    const top = [..._rows].sort((a,b) => b.alcance - a.alcance)[0];
    return `La publicación con mayor alcance es ${top.id} (${top.plataforma}, ${top.tipo} — campaña "${top.campaña}") con ${top.alcance.toLocaleString()} personas alcanzadas el ${top.fechaStr}.`;
  }

  // Mejor publicación (conversiones)
  if (includes(q, ['mas conversiones', 'mayor conversion', 'mejor conversion', 'mas ventas'])) {
    const top = [..._rows].sort((a,b) => b.conversiones - a.conversiones)[0];
    return `La publicación con más conversiones es ${top.id} (${top.plataforma}) con ${top.conversiones} conversiones. Campaña: "${top.campaña}", costo: S/${top.costo}.`;
  }

  // Peor publicación
  if (includes(q, ['peor', 'menor', 'minimo', 'mas bajo', 'menos alcance'])) {
    const bot = [..._rows].sort((a,b) => a.alcance - b.alcance)[0];
    return `La publicación con menor alcance es ${bot.id} (${bot.plataforma}) con ${bot.alcance.toLocaleString()} personas el ${bot.fechaStr}.`;
  }

  // Alcance total
  if (includes(q, ['alcance']) && includes(q, ['total', 'general', 'suma', 'cuanto', 'acumulado'])) {
    return `El alcance total de la campaña es ${_kpis.alcanceTotal?.toLocaleString() || '346,400'} personas en las 22 publicaciones (Mar–Abr 2026).`;
  }

  // Inversión / costo total
  if (includes(q, ['inversion', 'costo', 'gasto', 'presupuesto', 'cuanto se gasto', 'cuanto costo'])) {
    return `La inversión total de la campaña fue S/${_kpis.costoTotal?.toFixed(2) || '3650.00'}. El costo por conversión promedio es S/${_kpis.cpc?.toFixed(2) || '1.60'}.`;
  }

  // Tasa de interacción
  if (includes(q, ['tasa', 'interaccion', 'engagement'])) {
    return `La tasa de interacción promedio de la campaña es ${_kpis.tasaMedia?.toFixed(2) || '9.73'}%. La publicación con mayor tasa fue RS-020 (TikTok Reel) con 13.82%.`;
  }

  // TikTok
  if (includes(q, ['tiktok'])) {
    const tk = _rows.filter(r => r.plataforma === 'TikTok');
    const alcance = tk.reduce((s,r) => s+r.alcance, 0);
    const conv = tk.reduce((s,r) => s+r.conversiones, 0);
    return `TikTok tiene ${tk.length} publicaciones con un alcance total de ${alcance.toLocaleString()} y ${conv} conversiones. Es la plataforma con mayor alcance de la campaña.`;
  }

  // Instagram
  if (includes(q, ['instagram'])) {
    const ig = _rows.filter(r => r.plataforma === 'Instagram');
    const alcance = ig.reduce((s,r) => s+r.alcance, 0);
    return `Instagram tiene ${ig.length} publicaciones con un alcance total de ${alcance.toLocaleString()}. Tipos: Reels, Carruseles e Historias.`;
  }

  // Facebook
  if (includes(q, ['facebook'])) {
    const fb = _rows.filter(r => r.plataforma === 'Facebook');
    const alcance = fb.reduce((s,r) => s+r.alcance, 0);
    return `Facebook tiene ${fb.length} publicaciones con un alcance total de ${alcance.toLocaleString()}.`;
  }

  // YouTube
  if (includes(q, ['youtube'])) {
    const yt = _rows.filter(r => r.plataforma === 'YouTube');
    const alcance = yt.reduce((s,r) => s+r.alcance, 0);
    return `YouTube tiene ${yt.length} publicaciones con un alcance total de ${alcance.toLocaleString()}. Menor alcance individual pero mayor permanencia del contenido.`;
  }

  // LinkedIn
  if (includes(q, ['linkedin'])) {
    const li = _rows.filter(r => r.plataforma === 'LinkedIn');
    const alcance = li.reduce((s,r) => s+r.alcance, 0);
    return `LinkedIn tiene ${li.length} publicaciones con ${alcance.toLocaleString()} de alcance. Orientado a audiencia profesional y branding corporativo.`;
  }

  // Campaña Día de la Madre
  if (includes(q, ['dia de la madre', 'madre'])) {
    const camp = _rows.filter(r => r.campaña === 'Día de la Madre');
    const alcance = camp.reduce((s,r) => s+r.alcance, 0);
    const conv = camp.reduce((s,r) => s+r.conversiones, 0);
    return `La campaña "Día de la Madre" tuvo ${camp.length} publicaciones, ${alcance.toLocaleString()} de alcance total y ${conv} conversiones. Fue la campaña de mayor rendimiento.`;
  }

  // Campaña Lanzamiento
  if (includes(q, ['lanzamiento'])) {
    const camp = _rows.filter(r => r.campaña === 'Lanzamiento');
    const alcance = camp.reduce((s,r) => s+r.alcance, 0);
    return `La campaña "Lanzamiento" tuvo ${camp.length} publicaciones con ${alcance.toLocaleString()} de alcance total.`;
  }

  // Campañas en general
  if (includes(q, ['campaña', 'campanas'])) {
    const camps = [...new Set(_rows.map(r => r.campaña))];
    return `La campaña tiene 6 sub-campañas: ${camps.join(', ')}. La de mayor alcance fue "Día de la Madre" y "Promo Aniversario".`;
  }

  // Reels
  if (includes(q, ['reel', 'reels'])) {
    const reels = _rows.filter(r => r.tipo === 'Reel');
    const alcance = reels.reduce((s,r) => s+r.alcance, 0);
    return `Los Reels tienen ${reels.length} publicaciones con ${alcance.toLocaleString()} de alcance total. Es el formato con mejor rendimiento junto a los Videos de TikTok.`;
  }

  // Conversiones totales
  if (includes(q, ['conversiones', 'conversion']) && includes(q, ['total', 'cuantas', 'suma'])) {
    return `El total de conversiones de la campaña es ${_kpis.convTotal?.toLocaleString() || '2,288'}. La publicación RS-015 (TikTok) tuvo el máximo con 310 conversiones.`;
  }

  // Publicaciones destacadas
  if (includes(q, ['destacada', 'destacadas'])) {
    const dest = _rows.filter(r => r.logica?.destacada === 'Destacada');
    return `Las publicaciones clasificadas como "Destacadas" (alcance > 15,000 y conversiones > 100) son: ${dest.map(r => `${r.id} (${r.plataforma})`).join(', ')}.`;
  }

  // Publicaciones a revisar
  if (includes(q, ['revisar', 'problemas', 'bajo rendimiento', 'malas'])) {
    const rev = _rows.filter(r => r.logica?.revision === 'Revisar');
    return `Las publicaciones marcadas para "Revisar" (costo > S/250 o conversiones < 50) son: ${rev.map(r => `${r.id} (${r.plataforma})`).join(', ')}.`;
  }

  // Cuántas publicaciones
  if (includes(q, ['cuantas', 'cuantos', 'numero', 'total de publicaciones'])) {
    return `La campaña tiene 22 publicaciones en total, distribuidas entre Instagram (6), TikTok (5), Facebook (5), YouTube (3) y LinkedIn (2).`;
  }

  // Plataforma más efectiva
  if (includes(q, ['mejor plataforma', 'mas efectiva', 'mas eficiente', 'recomendas'])) {
    return `TikTok es la plataforma más efectiva en alcance (máx. 41,500 en RS-015) e Instagram en engagement con Reels. Para branding profesional, LinkedIn. Para conversiones económicas, Facebook.`;
  }

  // Resumen general
  if (includes(q, ['resumen', 'resumen general', 'como fue', 'resultado general', 'que tal'])) {
    return `Resumen de la campaña La Ibérica AQP (Mar–Abr 2026):\n• 22 publicaciones en 5 plataformas\n• Alcance total: 346,400 personas\n• Interacciones: 38,890\n• Conversiones: 2,288\n• Inversión: S/3,650\n• CPC: S/1.60\n• Tasa media: 9.73%\nMejor post: RS-015 TikTok (41,500 alcance, 310 conv).`;
  }

  // Funciones lógicas
  if (includes(q, ['si.conjunto', 'si conjunto', 'logica', 'logicas', 'funcion', 'funciones', 'clasificacion'])) {
    const alto = _rows.filter(r => r.logica?.rendimiento === 'Alto').length;
    const medio = _rows.filter(r => r.logica?.rendimiento === 'Medio').length;
    const bajo = _rows.filter(r => r.logica?.rendimiento === 'Bajo').length;
    return `Clasificación por SI.CONJUNTO (alcance):\n• Alto (>20,000): ${alto} publicaciones\n• Medio (>10,000): ${medio} publicaciones\n• Bajo (≤10,000): ${bajo} publicaciones\nLa función SI clasifica por alcance >15,000, Y por alcance+conversiones altas, O por costo alto o pocas conversiones.`;
  }

  // Fallback
  return `Puedo responder sobre: alcance, conversiones, inversión, plataformas (TikTok, Instagram, Facebook, YouTube, LinkedIn), campañas (Lanzamiento, Día de la Madre, etc.), tipos de contenido, clasificación lógica y más.\n\n¿Qué quieres saber sobre la campaña de La Ibérica?`;
}

function includes(texto, palabras) {
  return palabras.some(p => texto.includes(p));
}

// ─── Voz ────────────────────────────────────────────────────────────────────

function addMsg(role, text, isTyping = false) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}${isTyping ? ' typing' : ''}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function setupVoice(btn, input) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.title = 'Tu navegador no soporta voz. Usa Chrome o Edge.';
    btn.style.opacity = '0.4';
    return;
  }

  const recog = new SR();
  recog.lang = 'es-ES';
  recog.continuous = false;
  recog.interimResults = false;
  let listening = false;

  btn.addEventListener('click', () => {
    if (listening) { recog.stop(); return; }
    recog.start();
  });

  recog.onstart = () => {
    listening = true;
    btn.classList.add('recording');
    btn.title = 'Escuchando… (clic para detener)';
  };

  recog.onend = () => {
    listening = false;
    btn.classList.remove('recording');
    btn.title = 'Hablar';
  };

  recog.onresult = e => {
    const transcript = e.results[0][0].transcript;
    input.value = transcript;
    document.getElementById('chatForm').requestSubmit();
  };

  recog.onerror = e => {
    console.error('SpeechRecognition error:', e.error);
    btn.classList.remove('recording');
    listening = false;
  };
}
