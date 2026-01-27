export function formatDateTimeUtc(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const iso = date.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const [day, timeWithMs] = iso.split("T");
  const time = timeWithMs.replace("Z", "").slice(0, 8);
  return `${day} ${time} UTC`;
}
