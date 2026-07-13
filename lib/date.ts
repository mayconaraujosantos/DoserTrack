/**
 * Data local (não UTC) no formato YYYY-MM-DD. `scheduled_time` e outras datas
 * do app são gravadas/comparadas em horário local -- usar `toISOString()`
 * (UTC) para "hoje" faz a data pular pra amanhã à noite em fusos atrás de UTC
 * (ex.: Brasil, a partir de ~21h).
 */
export function localDateStr(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
