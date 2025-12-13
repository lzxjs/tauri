export function normalizedUrl(input) {
  const str = (input || '').trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return `https://${str}`;
}

export function safeResolveUrl(baseUrl, maybeUrl) {
  const raw = (maybeUrl || '').trim();
  if (!raw) return raw;
  try {
    return new URL(raw, baseUrl).toString();
  } catch (_) {
    return raw;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)));
}

export function buildHeadersObject(headersList) {
  const headers = {};
  (headersList || []).forEach((h) => {
    if (h && h.key && h.value) headers[h.key] = h.value;
  });
  return headers;
}

export function downloadFile(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((k) => {
          let val = row?.[k] ?? '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(','),
    ),
  ];
  return lines.join('\n');
}

export function toTxt(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return '';
  return rows
    .map((row) => {
      return Object.entries(row || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    })
    .join('\n\n--------------------------------------------------\n\n');
}
