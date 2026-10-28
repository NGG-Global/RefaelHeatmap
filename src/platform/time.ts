/** Israel-time formatting (Asia/Jerusalem handles the DST switch). */

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "YYYY-MM-DD HH:mm:ss" in Israel time — a format Excel reads as a date-time. */
export function israelDateTime(iso: string): string {
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(new Date(iso))) p[type] = value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** "DD.MM.YYYY HH:mm" in Israel time, for on-screen lists. */
export function israelShort(iso: string): string {
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(new Date(iso))) p[type] = value;
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}
