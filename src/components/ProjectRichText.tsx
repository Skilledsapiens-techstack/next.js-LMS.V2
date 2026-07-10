function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function isSafeHref(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function sanitizeProjectHtml(value: string | undefined) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';
  const source = looksLikeHtml(rawValue) ? rawValue : plainTextToHtml(rawValue);

  if (typeof document === 'undefined') return source;

  const allowedTags = new Set(['A', 'B', 'BR', 'EM', 'I', 'LI', 'OL', 'P', 'STRONG', 'U', 'UL']);
  const template = document.createElement('template');
  template.innerHTML = source;

  function cleanNode(node: Node) {
    Array.from(node.childNodes).forEach(cleanNode);
    if (!(node instanceof HTMLElement)) return;

    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      if (node.tagName === 'A' && attribute.name === 'href' && isSafeHref(attribute.value)) return;
      node.removeAttribute(attribute.name);
    });

    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer');
    }
  }

  cleanNode(template.content);
  return template.innerHTML.trim();
}

export function ProjectRichText({ className, html }: { className?: string; html?: string }) {
  const cleanHtml = sanitizeProjectHtml(html);
  if (!cleanHtml) return null;
  return <div className={className ?? 'project-rich-text'} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}
