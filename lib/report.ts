import { getDosesForDateRange } from '@/lib/database';
import type { Dose } from '@/types';

interface ReportOptions {
  profileName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface MedicineSummary {
  name: string;
  taken: number;
  skipped: number;
  total: number;
  pct: number;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): string {
  if (status === 'taken') return 'Tomado';
  if (status === 'skipped') return 'Pulado';
  if (status === 'snoozed') return 'Soneca';
  return 'Pendente';
}

function statusColor(status: string): string {
  if (status === 'taken') return '#27AE60';
  if (status === 'skipped') return '#E74C3C';
  if (status === 'snoozed') return '#F39C12';
  return '#95A5A6';
}

function buildMedicineSummaries(doses: Dose[]): MedicineSummary[] {
  const map = new Map<string, MedicineSummary>();
  for (const d of doses) {
    const name = d.medicineName ?? 'Desconhecido';
    if (!map.has(name)) map.set(name, { name, taken: 0, skipped: 0, total: 0, pct: 0 });
    const s = map.get(name)!;
    s.total++;
    if (d.status === 'taken') s.taken++;
    else if (d.status === 'skipped') s.skipped++;
  }
  for (const s of map.values()) {
    s.pct = s.total > 0 ? Math.round((s.taken / s.total) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function barHtml(pct: number): string {
  const color = pct >= 80 ? '#27AE60' : pct >= 50 ? '#F39C12' : '#E74C3C';
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <div style="flex:1;background:#eee;border-radius:4px;height:12px;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:4px;"></div>
      </div>
      <span style="font-size:12px;color:#666;width:35px;text-align:right;">${pct}%</span>
    </div>`;
}

export async function generateAdherenceReport(opts: ReportOptions): Promise<string> {
  const doses = await getDosesForDateRange(opts.startDate, opts.endDate);
  const nonPending = doses.filter((d) => d.status !== 'pending');
  const taken = nonPending.filter((d) => d.status === 'taken').length;
  const total = nonPending.length;
  const overallPct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const summaries = buildMedicineSummaries(nonPending);

  const summaryRows = summaries.map((s) => `
    <tr>
      <td>${s.name}</td>
      <td style="text-align:center;color:#27AE60;">${s.taken}</td>
      <td style="text-align:center;color:#E74C3C;">${s.skipped}</td>
      <td style="text-align:center;">${s.total}</td>
      <td style="text-align:center;">
        ${barHtml(s.pct)}
      </td>
    </tr>`).join('');

  const recentRows = nonPending.slice(0, 60).map((d) => `
    <tr>
      <td>${fmtDate(d.scheduledTime)}</td>
      <td>${fmtTime(d.scheduledTime)}</td>
      <td>${d.medicineName ?? '-'}</td>
      <td>${d.dosage ?? '-'}</td>
      <td style="color:${statusColor(d.status)};font-weight:600;">${statusLabel(d.status)}</td>
      <td>${d.takenTime ? fmtTime(d.takenTime) : '-'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; color: #2C3E50; padding: 32px; font-size: 13px; }
    h1 { font-size: 22px; color: #4A90D9; }
    h2 { font-size: 15px; margin: 24px 0 10px; color: #2C3E50; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .meta { color: #7F8C8D; font-size: 12px; margin-top: 4px; }
    .summary { background: #4A90D9; color: #fff; border-radius: 12px; padding: 20px; display: flex; gap: 32px; margin-bottom: 24px; }
    .big { font-size: 48px; font-weight: 800; line-height: 1; }
    .label { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .stat { font-size: 13px; opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F0F4F8; text-align: left; padding: 8px 10px; font-size: 12px; color: #7F8C8D; }
    td { padding: 8px 10px; border-bottom: 1px solid #F0F4F8; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; text-align: center; color: #BDC3C7; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Doser — Relatório de Adesão</h1>
      <div class="meta">Perfil: <strong>${opts.profileName}</strong></div>
      <div class="meta">Período: ${fmtDate(opts.startDate + 'T12:00:00')} a ${fmtDate(opts.endDate + 'T12:00:00')}</div>
      <div class="meta">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>

  <div class="summary">
    <div>
      <div class="big">${overallPct}%</div>
      <div class="label">Taxa de adesão</div>
    </div>
    <div style="display:flex;flex-direction:column;justify-content:center;gap:4px;">
      <div class="stat">✅ ${taken} doses tomadas</div>
      <div class="stat">❌ ${total - taken} doses perdidas</div>
      <div class="stat">📊 ${total} doses registradas</div>
    </div>
  </div>

  <h2>Por Medicamento</h2>
  <table>
    <thead>
      <tr>
        <th>Medicamento</th>
        <th style="text-align:center;">Tomadas</th>
        <th style="text-align:center;">Puladas</th>
        <th style="text-align:center;">Total</th>
        <th>Adesão</th>
      </tr>
    </thead>
    <tbody>${summaryRows || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:16px;">Nenhum dado no período</td></tr>'}</tbody>
  </table>

  <h2>Doses Recentes (últimas 60)</h2>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Horário</th><th>Medicamento</th><th>Dosagem</th><th>Status</th><th>Hora tomada</th>
      </tr>
    </thead>
    <tbody>${recentRows || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:16px;">Nenhum registro</td></tr>'}</tbody>
  </table>

  <div class="footer">Doser — Gerado automaticamente pelo app</div>
</body>
</html>`;
}
