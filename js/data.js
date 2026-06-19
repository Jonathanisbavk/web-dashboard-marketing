const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4waeyRVWC1KD9NdgtZaZA-vkHdfu-cXNBUCWT0lwnL32gyctPPNEeFkUdfWiM-Q/pub?gid=187954927&single=true&output=csv';

function parseNum(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.\-]/g, '')) || 0;
}

function parsePct(val) {
  return parseFloat(String(val).replace('%', '').replace(',', '.')) || 0;
}

function parseDate(val) {
  const [d, m, y] = String(val).split('/');
  return new Date(`${y}-${m}-${d}`);
}

export async function loadData() {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('No se pudo cargar el Google Sheet CSV');
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV sin datos');

  const headers = rows[0];
  return rows.slice(1).filter(r => r[0] && r[0].startsWith('RS-')).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h.trim()] = r[i] !== undefined ? String(r[i]).trim() : '');
    return {
      id:               o['ID'],
      fecha:            parseDate(o['Fecha']),
      fechaStr:         o['Fecha'],
      plataforma:       o['Plataforma'],
      tipo:             o['Tipo_Contenido'],
      campaña:          o['Campaña'],
      alcance:          parseNum(o['Alcance']),
      interacciones:    parseNum(o['Interacciones']),
      conversiones:     parseNum(o['Conversiones']),
      costo:            parseNum(o['Costo']),
      tasaInteraccion:  parsePct(o['Tasa_Interaccion']),
    };
  });
}

function parseCSV(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const row = [];
    while (i < text.length && text[i] !== '\n') {
      if (text[i] === '"') {
        i++;
        let cell = '';
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { cell += text[i++]; }
        }
        row.push(cell);
        if (text[i] === ',') i++;
      } else {
        let cell = '';
        while (i < text.length && text[i] !== ',' && text[i] !== '\n') cell += text[i++];
        row.push(cell.trim());
        if (text[i] === ',') i++;
      }
    }
    if (text[i] === '\n') i++;
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}
