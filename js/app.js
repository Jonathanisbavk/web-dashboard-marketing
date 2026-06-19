import { loadData } from './data.js';
import { enrichData } from './logic.js';
import { calcKPIs, buildContexto } from './kpis.js';
import { renderAll } from './charts.js';
import { setupFilters } from './filters.js';
import { initChat } from './chat.js';

let allRows = [];

async function init() {
  setStatus('Cargando datos del Sheet…', false);
  try {
    const raw = await loadData();
    allRows = enrichData(raw);
  } catch (e) {
    setStatus(`❌ Error: ${e.message}`, true);
    return;
  }

  setStatus(`✓ ${allRows.length} publicaciones cargadas`, false);
  renderKPIs(allRows);
  renderAll(allRows);
  renderTablaLogica(allRows);
  renderTabla(allRows);
  setupFilters(allRows, filtered => {
    renderKPIs(filtered);
    renderAll(filtered);
    renderTabla(filtered);
    renderTablaLogica(filtered);
  });

  const kpis = calcKPIs(allRows);
  initChat(buildContexto(allRows, kpis), allRows, kpis);
  setupTheme();
}

function renderKPIs(rows) {
  const k = calcKPIs(rows);
  setText('kpiPublicaciones', rows.length);
  setText('kpiAlcance',       k.alcanceTotal.toLocaleString());
  setText('kpiInteracciones', k.interTotal.toLocaleString());
  setText('kpiConversiones',  k.convTotal.toLocaleString());
  setText('kpiInversion',     `S/${k.costoTotal.toFixed(2)}`);
  setText('kpiCPC',           `S/${k.cpc.toFixed(2)}`);
  setText('kpiTasa',          `${k.tasaMedia.toFixed(2)}%`);
}

function renderTabla(rows) {
  const tbody = document.getElementById('tbodyDatos');
  if (!tbody) return;
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.fechaStr}</td>
      <td><span class="badge plat-${r.plataforma.toLowerCase()}">${r.plataforma}</span></td>
      <td>${r.tipo}</td>
      <td>${r.campaña}</td>
      <td class="num">${r.alcance.toLocaleString()}</td>
      <td class="num">${r.interacciones.toLocaleString()}</td>
      <td class="num">${r.conversiones}</td>
      <td class="num">S/${r.costo.toFixed(2)}</td>
      <td class="num">${r.tasaInteraccion}%</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('tablaCount').textContent = `${rows.length} registros`;
}

function renderTablaLogica(rows) {
  const tbody = document.getElementById('tbodyLogica');
  if (!tbody) return;
  tbody.innerHTML = '';
  rows.forEach(r => {
    const l = r.logica;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td class="num">${r.alcance.toLocaleString()}</td>
      <td class="num">${r.conversiones}</td>
      <td class="num">S/${r.costo}</td>
      <td><span class="badge ${l.alcanceLabel === 'Alto alcance' ? 'badge-green' : 'badge-gray'}">${l.alcanceLabel}</span></td>
      <td><span class="badge ${l.destacada === 'Destacada' ? 'badge-purple' : 'badge-gray'}">${l.destacada}</span></td>
      <td><span class="badge ${l.revision === 'Revisar' ? 'badge-red' : 'badge-green'}">${l.revision}</span></td>
      <td>${l.costoConv}</td>
      <td><span class="badge ${l.rendimiento === 'Alto' ? 'badge-green' : l.rendimiento === 'Medio' ? 'badge-yellow' : 'badge-red'}">${l.rendimiento}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setStatus(msg, isError) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = `status${isError ? ' error' : ''}`;
}

function setupTheme() {
  const btn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
  btn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const moon = document.getElementById('iconMoon');
  const sun  = document.getElementById('iconSun');
  if (!moon || !sun) return;
  if (theme === 'dark') {
    moon.style.display = 'none';
    sun.style.display  = '';
  } else {
    moon.style.display = '';
    sun.style.display  = 'none';
  }
}

init();
