import { Fragment, ReactNode } from 'react';

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

export function AnnouncementRichText({ className, text }: { className?: string; text: string }) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let bulletItems: string[] = [];

  function flushBullets() {
    if (bulletItems.length === 0) return;
    const currentItems = bulletItems;
    bulletItems = [];
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {currentItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderBoldText(item)}</li>
        ))}
      </ul>
    );
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }

    if (trimmed === '---') {
      flushBullets();
      nodes.push(<hr key={`rule-${nodes.length}`} />);
      return;
    }

    if (trimmed.startsWith('- ')) {
      bulletItems.push(trimmed.slice(2).trim());
      return;
    }

    flushBullets();
    nodes.push(<p key={`paragraph-${nodes.length}`}>{renderBoldText(trimmed)}</p>);
  });

  flushBullets();

  return <div className={className ?? 'announcement-rich-text'}>{nodes.length > 0 ? nodes : <p>{text}</p>}</div>;
}
