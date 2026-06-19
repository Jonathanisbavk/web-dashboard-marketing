import { agrupar } from './kpis.js';

const PALETTE = ['#6366f1','#22d3ee','#f59e0b','#10b981','#ef4444','#a78bfa','#fb923c'];

function getOrCreate(id, type, data, options = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getCSSVar('--text') } } }, ...options } });
}

function getCSSVar(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

export function renderAll(rows) {
  renderAlcancePlataforma(rows);
  renderConversionesCampaña(rows);
  renderTipoContenido(rows);
  renderEvolucion(rows);
  renderDispersion(rows);
}

function renderAlcancePlataforma(rows) {
  const g = agrupar(rows, 'plataforma');
  const labels = Object.keys(g);
  getOrCreate('chartPlataforma', 'bar', {
    labels,
    datasets: [{
      label: 'Alcance',
      data: labels.map(k => g[k].alcance),
      backgroundColor: PALETTE,
      borderRadius: 6,
    }]
  }, { scales: { x: { ticks: { color: getCSSVar('--text-muted') } }, y: { ticks: { color: getCSSVar('--text-muted') }, grid: { color: getCSSVar('--border') } } } });
}

function renderConversionesCampaña(rows) {
  const g = agrupar(rows, 'campaña');
  const labels = Object.keys(g);
  getOrCreate('chartCampaña', 'bar', {
    labels,
    datasets: [
      { label: 'Conversiones', data: labels.map(k => g[k].conversiones), backgroundColor: '#6366f1', borderRadius: 6 },
      { label: 'Costo S/', data: labels.map(k => g[k].costo), backgroundColor: '#f59e0b', borderRadius: 6 },
    ]
  }, { scales: { x: { ticks: { color: getCSSVar('--text-muted') } }, y: { ticks: { color: getCSSVar('--text-muted') }, grid: { color: getCSSVar('--border') } } } });
}

function renderTipoContenido(rows) {
  const g = agrupar(rows, 'tipo');
  const labels = Object.keys(g);
  getOrCreate('chartTipo', 'doughnut', {
    labels,
    datasets: [{ data: labels.map(k => g[k].alcance), backgroundColor: PALETTE, borderWidth: 2 }]
  });
}

function renderEvolucion(rows) {
  const sorted = [...rows].sort((a, b) => a.fecha - b.fecha);
  getOrCreate('chartEvolucion', 'line', {
    labels: sorted.map(r => r.fechaStr),
    datasets: [
      { label: 'Alcance', data: sorted.map(r => r.alcance), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', tension: 0.4, fill: true, pointRadius: 4 },
      { label: 'Interacciones', data: sorted.map(r => r.interacciones), borderColor: '#22d3ee', backgroundColor: 'transparent', tension: 0.4, pointRadius: 4 },
    ]
  }, { scales: { x: { ticks: { color: getCSSVar('--text-muted'), maxRotation: 45 } }, y: { ticks: { color: getCSSVar('--text-muted') }, grid: { color: getCSSVar('--border') } } } });
}

function renderDispersion(rows) {
  getOrCreate('chartDispersion', 'scatter', {
    datasets: [{
      label: 'Publicaciones',
      data: rows.map(r => ({ x: r.costo, y: r.conversiones, label: r.id })),
      backgroundColor: rows.map(r => r.logica?.rendimiento === 'Alto' ? '#10b981' : r.logica?.rendimiento === 'Medio' ? '#f59e0b' : '#ef4444'),
      pointRadius: 8,
    }]
  }, {
    plugins: {
      tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: S/${ctx.raw.x} costo / ${ctx.raw.y} conv` } },
      legend: { display: false },
    },
    scales: {
      x: { title: { display: true, text: 'Costo (S/)', color: getCSSVar('--text-muted') }, ticks: { color: getCSSVar('--text-muted') }, grid: { color: getCSSVar('--border') } },
      y: { title: { display: true, text: 'Conversiones', color: getCSSVar('--text-muted') }, ticks: { color: getCSSVar('--text-muted') }, grid: { color: getCSSVar('--border') } },
    }
  });
}
