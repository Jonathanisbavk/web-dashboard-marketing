// Reproduces the logical rules from the FuncionesLogicas sheet
// SI: Alcance > 15000 → "Alto alcance"
// Y:  alcance > 15000 AND conversiones > 100 → "Destacada"
// O:  costo > 250 OR conversiones < 50 → "Revisar"
// SI.CONJUNTO: alcance > 20000 → "Alto"; > 10000 → "Medio"; else "Bajo"
// SI.ERROR: costo / conversiones (safe)

export function clasificar(row) {
  const alcanceLabel = row.alcance > 15000 ? 'Alto alcance' : 'Bajo alcance';

  const destacada = (row.alcance > 15000 && row.conversiones > 100) ? 'Destacada' : 'Normal';

  const revision = (row.costo > 250 || row.conversiones < 50) ? 'Revisar' : 'OK';

  const costoConv = row.conversiones > 0
    ? `S/${(row.costo / row.conversiones).toFixed(2)}`
    : 'N/A';

  let rendimiento;
  if (row.alcance > 20000) rendimiento = 'Alto';
  else if (row.alcance > 10000) rendimiento = 'Medio';
  else rendimiento = 'Bajo';

  return { alcanceLabel, destacada, revision, costoConv, rendimiento };
}

export function enrichData(rows) {
  return rows.map(r => ({ ...r, logica: clasificar(r) }));
}
