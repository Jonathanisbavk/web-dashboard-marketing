// Update this URL after deploying to Vercel:
const PROXY_URL = 'https://web-dashboard-marketing.vercel.app/api/chat';

let contexto = '';
let historial = [];

export function initChat(contextoData) {
  contexto = contextoData;

  const btn    = document.getElementById('chatToggle');
  const box    = document.getElementById('chatBox');
  const form   = document.getElementById('chatForm');
  const input  = document.getElementById('chatInput');
  const micBtn = document.getElementById('btnMic');
  const msgs   = document.getElementById('chatMessages');

  btn?.addEventListener('click', () => {
    box.classList.toggle('open');
    if (box.classList.contains('open') && msgs.children.length === 0) {
      addMsg('assistant', '¡Hola! Soy tu asistente de campaña 📊. Pregúntame cualquier cosa sobre las publicaciones, métricas, plataformas o rendimiento.');
    }
  });

  document.getElementById('chatClose')?.addEventListener('click', () => box.classList.remove('open'));

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendMessage(text, msgs);
  });

  if (micBtn) setupVoice(micBtn, input);
}

async function sendMessage(text, msgs) {
  addMsg('user', text);
  historial.push({ role: 'user', content: text });

  const typing = addMsg('assistant', '…', true);
  document.getElementById('chatInput').disabled = true;

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: text, historial: historial.slice(-10), contexto }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const data = await res.json();
    const reply = data.respuesta || '(sin respuesta)';
    typing.textContent = reply;
    typing.classList.remove('typing');
    historial.push({ role: 'assistant', content: reply });
  } catch (err) {
    typing.textContent = `⚠️ ${err.message}`;
    typing.classList.add('error');
    typing.classList.remove('typing');
    historial.pop();
  }

  document.getElementById('chatInput').disabled = false;
  document.getElementById('chatInput').focus();
}

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
    btn.title = 'Escuchando… (haz clic para detener)';
  };

  recog.onend = () => {
    listening = false;
    btn.classList.remove('recording');
    btn.title = 'Hablar';
  };

  recog.onresult = e => {
    const transcript = e.results[0][0].transcript;
    input.value = transcript;
    input.dispatchEvent(new Event('input'));
    document.getElementById('chatForm').requestSubmit();
  };

  recog.onerror = e => {
    console.error('SpeechRecognition error:', e.error);
    btn.classList.remove('recording');
    listening = false;
  };
}
