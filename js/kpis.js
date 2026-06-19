export function calcKPIs(rows) {
  const total = rows.length;
  const alcanceTotal   = rows.reduce((s, r) => s + r.alcance, 0);
  const interTotal     = rows.reduce((s, r) => s + r.interacciones, 0);
  const convTotal      = rows.reduce((s, r) => s + r.conversiones, 0);
  const costoTotal     = rows.reduce((s, r) => s + r.costo, 0);
  const tasaMedia      = rows.reduce((s, r) => s + r.tasaInteraccion, 0) / total;
  const cpc            = convTotal > 0 ? costoTotal / convTotal : 0;

  return { total, alcanceTotal, interTotal, convTotal, costoTotal, tasaMedia, cpc };
}

export function agrupar(rows, campo) {
  const map = {};
  rows.forEach(r => {
    const key = r[campo];
    if (!map[key]) map[key] = { alcance: 0, interacciones: 0, conversiones: 0, costo: 0, n: 0 };
    map[key].alcance       += r.alcance;
    map[key].interacciones += r.interacciones;
    map[key].conversiones  += r.conversiones;
    map[key].costo         += r.costo;
    map[key].n++;
  });
  return map;
}

export function buildContexto(rows, kpis) {
  const lines = [
    `Campaña de redes sociales — Marca local AQP (22 publicaciones, Mar-Abr 2026)`,
    `Plataformas: Instagram, Facebook, TikTok, YouTube, LinkedIn`,
    `KPIs: Alcance total ${kpis.alcanceTotal.toLocaleString()}, Interacciones ${kpis.interTotal.toLocaleString()}, Conversiones ${kpis.convTotal}, Inversión S/${kpis.costoTotal.toFixed(2)}, Tasa media ${kpis.tasaMedia.toFixed(2)}%, CPC S/${kpis.cpc.toFixed(2)}`,
    ``,
    `ID | Fecha | Plataforma | Tipo | Campaña | Alcance | Inter | Conv | Costo | Tasa | Rendimiento`,
  ];
  rows.forEach(r => {
    lines.push(`${r.id} | ${r.fechaStr} | ${r.plataforma} | ${r.tipo} | ${r.campaña} | ${r.alcance} | ${r.interacciones} | ${r.conversiones} | S/${r.costo} | ${r.tasaInteraccion}% | ${r.logica?.rendimiento || '?'}`);
  });
  lines.push(``, `Reglas lógicas aplicadas (FuncionesLogicas):`);
  lines.push(`- SI: alcance>15000 → Alto alcance`);
  lines.push(`- Y: alcance>15000 AND conv>100 → Destacada`);
  lines.push(`- O: costo>250 OR conv<50 → Revisar`);
  lines.push(`- SI.CONJUNTO: alcance>20000→Alto; >10000→Medio; else→Bajo`);
  return lines.join('\n');
}
