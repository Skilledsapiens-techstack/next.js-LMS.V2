export function normalizeLinkedInProfileUrl(value: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return '';
  const withProtocol = /^https?:\/\//i.test(cleanValue) ? cleanValue : `https://${cleanValue}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com')) return '';
    if (!/^\/in\/[A-Za-z0-9._%-]+\/?$/i.test(url.pathname)) return '';
    url.protocol = 'https:';
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function isValidLinkedInProfileUrl(value: string) {
  return Boolean(normalizeLinkedInProfileUrl(value));
}
