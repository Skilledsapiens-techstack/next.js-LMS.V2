import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

const TOAST_DURATION_MS = 4000;

type PortalToastTone = 'error' | 'success' | 'warning';

export function PortalToast({
  icon,
  message,
  onDismiss,
  title,
  tone = 'success'
}: {
  icon?: ReactNode;
  message: string;
  onDismiss: () => void;
  title: string;
  tone?: PortalToastTone;
}) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismissRef.current(), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message, title, tone]);

  const fallbackIcon = tone === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />;

  return (
    <div className={`portal-toast portal-toast--${tone}`} role="status" aria-live="polite">
      <div className="portal-toast__icon">{icon ?? fallbackIcon}</div>
      <div className="portal-toast__copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <button aria-label="Dismiss message" onClick={onDismiss} type="button">
        <X size={16} />
      </button>
      <span className="portal-toast__timer" key={`${tone}-${title}-${message}`} />
    </div>
  );
}
