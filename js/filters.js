export function setupFilters(allRows, onFilter) {
  const plataformas = [...new Set(allRows.map(r => r.plataforma))].sort();
  const campañas    = [...new Set(allRows.map(r => r.campaña))].sort();
  const tipos       = [...new Set(allRows.map(r => r.tipo))].sort();

  populate('filterPlataforma', plataformas);
  populate('filterCampaña', campañas);
  populate('filterTipo', tipos);

  ['filterPlataforma', 'filterCampaña', 'filterTipo', 'searchInput'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => onFilter(applyFilters(allRows)));
    document.getElementById(id)?.addEventListener('input',  () => onFilter(applyFilters(allRows)));
  });

  document.getElementById('btnClearFilters')?.addEventListener('click', () => {
    ['filterPlataforma', 'filterCampaña', 'filterTipo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const s = document.getElementById('searchInput');
    if (s) s.value = '';
    onFilter(allRows);
  });
}

function populate(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    el.appendChild(opt);
  });
}

function applyFilters(rows) {
  const plat  = document.getElementById('filterPlataforma')?.value || '';
  const camp  = document.getElementById('filterCampaña')?.value || '';
  const tipo  = document.getElementById('filterTipo')?.value || '';
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();

  return rows.filter(r => {
    if (plat && r.plataforma !== plat) return false;
    if (camp && r.campaña !== camp) return false;
    if (tipo && r.tipo !== tipo) return false;
    if (query) {
      const haystack = `${r.id} ${r.plataforma} ${r.tipo} ${r.campaña}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
