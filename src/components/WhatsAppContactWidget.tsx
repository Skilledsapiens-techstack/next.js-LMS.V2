import { MessageCircle } from 'lucide-react';
import { FeatureControl } from '../features/useFeatureControls';

type WhatsAppContactWidgetProps = {
  feature?: Pick<FeatureControl, 'settings' | 'status' | 'upcomingMessage'> | null;
};

function normalizeWhatsAppNumber(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/[^\d]/g, '');
}

export function WhatsAppContactWidget({ feature }: WhatsAppContactWidgetProps) {
  const whatsappNumber = normalizeWhatsAppNumber(feature?.settings?.whatsapp_number ?? feature?.settings?.whatsappNumber);
  const whatsappLabel = feature?.upcomingMessage?.trim() || 'Contact Program Coordinator';
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I need help with my Skilled Sapiens LMS account.')}`
    : '';

  if (feature?.status !== 'show' || !whatsappUrl) return null;

  return (
    <a className="whatsapp-contact-widget" href={whatsappUrl} rel="noreferrer" target="_blank">
      <MessageCircle size={18} />
      <span>{whatsappLabel}</span>
    </a>
  );
}
