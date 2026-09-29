import { Bell, ExternalLink, Inbox, Megaphone, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StudentBanner, useDismissStudentBanner, useStudentBanners } from '../features/student/useStudentBanners';
import { ProjectRichText, sanitizeProjectHtml } from './ProjectRichText';

type StudentBannerLayerProps = {
  enabled: boolean;
};

const priorityOrder: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

function sortBanners(items: StudentBanner[]) {
  return [...items].sort((left, right) => {
    const priorityDelta = (priorityOrder[right.priority] ?? 2) - (priorityOrder[left.priority] ?? 2);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
  });
}

function typeLabel(banner: StudentBanner) {
  if (banner.bannerType === 'custom') return banner.customType || 'Banner';
  return banner.bannerType.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function plainMessage(message: string) {
  const cleanHtml = sanitizeProjectHtml(message);
  if (typeof document === 'undefined') return cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const template = document.createElement('template');
  template.innerHTML = cleanHtml;
  return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function dismissalKey(banner: StudentBanner) {
  return `${banner.id}:${banner.displayType}:${banner.updatedAt ?? ''}`;
}

function BannerCta({ banner }: { banner: StudentBanner }) {
  if (!banner.ctaLabel || !banner.ctaUrl) return null;
  const isExternal = /^https?:\/\//i.test(banner.ctaUrl);
  return (
    <a className="student-banner-cta" href={banner.ctaUrl} rel={isExternal ? 'noreferrer' : undefined} target={isExternal ? '_blank' : undefined}>
      {banner.ctaLabel}
      <ExternalLink size={14} />
    </a>
  );
}

function BannerDismiss({
  banner,
  checked,
  disabled,
  compact = false,
  onCheck,
  onDismiss
}: {
  banner: StudentBanner;
  checked: boolean;
  compact?: boolean;
  disabled: boolean;
  onCheck: (checked: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <div className={`student-banner-dismiss-row${compact ? ' student-banner-dismiss-row--compact' : ''}`}>
      {banner.requireAcknowledgement ? (
        <label>
          <input checked={checked} onChange={(event) => onCheck(event.target.checked)} type="checkbox" />
          I have read this
        </label>
      ) : <span />}
      <button disabled={disabled || (banner.requireAcknowledgement && !checked)} onClick={onDismiss} type="button">
        <X size={15} />
        Dismiss
      </button>
    </div>
  );
}

export function StudentBannerLayer({ enabled }: StudentBannerLayerProps) {
  const bannersQuery = useStudentBanners({ enabled, limit: 50 });
  const dismissBanner = useDismissStudentBanner();
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [locallyDismissed, setLocallyDismissed] = useState<string[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const banners = useMemo(
    () => sortBanners((bannersQuery.data?.items ?? []).filter((banner) => !locallyDismissed.includes(dismissalKey(banner)))),
    [bannersQuery.data?.items, locallyDismissed]
  );

  if (!enabled || banners.length === 0) return null;

  const loginPopups = banners.filter((banner) => banner.displayType === 'login_popup');
  const popupBanner = loginPopups.find((banner) => banner.requireAcknowledgement) ?? loginPopups[0];
  const topRunning = banners.filter((banner) => banner.displayType === 'top_running');
  const topSticky = banners.filter((banner) => banner.displayType === 'top_sticky');
  const bottomSticky = banners.find((banner) => banner.displayType === 'bottom_sticky');
  const floatingCard = banners.find((banner) => banner.displayType === 'bottom_right_floating');
  const inboxOnly = banners.filter((banner) => banner.displayType === 'floating_bell');
  const primaryBanners = [popupBanner, bottomSticky, floatingCard, ...topRunning, ...topSticky].filter(Boolean) as StudentBanner[];
  const inboxBanners = sortBanners([...new Map([...inboxOnly, ...(banners.length > 1 ? primaryBanners : [])].map((banner) => [banner.id, banner])).values()]);
  const showInbox = inboxOnly.length > 0 || banners.length > 1;
  const layerClassName = [
    'student-banner-layer',
    bottomSticky ? 'student-banner-layer--has-bottom' : '',
    floatingCard ? 'student-banner-layer--has-floating-card' : '',
    showInbox ? 'student-banner-layer--has-inbox' : ''
  ].filter(Boolean).join(' ');

  const markDismissed = async (banner: StudentBanner) => {
    const key = dismissalKey(banner);
    const hasAcknowledged = acknowledged[banner.id] === true;
    if (banner.requireAcknowledgement && !hasAcknowledged) return;
    setLocallyDismissed((current) => (current.includes(key) ? current : [...current, key]));
    try {
      await dismissBanner.mutateAsync({ acknowledged: hasAcknowledged, bannerId: banner.id });
    } catch {
      setLocallyDismissed((current) => current.filter((item) => item !== key));
    }
  };

  return (
    <div className={layerClassName} aria-live="polite">
      {topRunning.length > 0 ? (
        <div className="student-banner-running" role="region" aria-label="Running Banners">
          <div>
            {[...topRunning, ...topRunning].map((banner, index) => (
              <span key={`${banner.id}-${index}`}>
                <Megaphone size={15} />
                <strong>{banner.title}</strong>
                {plainMessage(banner.message)}
              </span>
            ))}
          </div>
          <div className="student-banner-running__controls">
            {topRunning.slice(0, 1).map((banner) => (
              <BannerDismiss
                banner={banner}
                checked={acknowledged[banner.id] === true}
                compact
                disabled={dismissBanner.isPending}
                key={banner.id}
                onCheck={(checked) => setAcknowledged((current) => ({ ...current, [banner.id]: checked }))}
                onDismiss={() => void markDismissed(banner)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {topSticky.map((banner) => (
        <section className={`student-banner-strip ${banner.priority}`} key={banner.id}>
          <div>
            <span>{typeLabel(banner)}</span>
            <strong>{banner.title}</strong>
            <ProjectRichText className="student-banner-rich-text" html={banner.message} />
          </div>
          <BannerCta banner={banner} />
          <BannerDismiss
            banner={banner}
            checked={acknowledged[banner.id] === true}
            compact
            disabled={dismissBanner.isPending}
            onCheck={(checked) => setAcknowledged((current) => ({ ...current, [banner.id]: checked }))}
            onDismiss={() => void markDismissed(banner)}
          />
        </section>
      ))}

      {popupBanner ? (
        <div className="student-banner-modal-backdrop" role="presentation">
          <section className={`student-banner-modal ${popupBanner.priority}`} role="dialog" aria-modal="true" aria-labelledby={`banner-title-${popupBanner.id}`}>
            <span className="student-banner-type">{typeLabel(popupBanner)}</span>
            <h2 id={`banner-title-${popupBanner.id}`}>{popupBanner.title}</h2>
            <ProjectRichText className="student-banner-rich-text" html={popupBanner.message} />
            <BannerCta banner={popupBanner} />
            <BannerDismiss
              banner={popupBanner}
              checked={acknowledged[popupBanner.id] === true}
              disabled={dismissBanner.isPending}
              onCheck={(checked) => setAcknowledged((current) => ({ ...current, [popupBanner.id]: checked }))}
              onDismiss={() => void markDismissed(popupBanner)}
            />
          </section>
        </div>
      ) : null}

      {bottomSticky ? (
        <section className={`student-banner-bottom ${bottomSticky.priority}`}>
          <div>
            <strong>{bottomSticky.title}</strong>
            <ProjectRichText className="student-banner-rich-text" html={bottomSticky.message} />
          </div>
          <div className="student-banner-bottom__actions">
            <BannerCta banner={bottomSticky} />
            <BannerDismiss
              banner={bottomSticky}
              checked={acknowledged[bottomSticky.id] === true}
              disabled={dismissBanner.isPending}
              onCheck={(checked) => setAcknowledged((current) => ({ ...current, [bottomSticky.id]: checked }))}
              onDismiss={() => void markDismissed(bottomSticky)}
            />
          </div>
        </section>
      ) : null}

      {floatingCard ? (
        <section className={`student-banner-floating-card ${floatingCard.priority}`}>
          <span className="student-banner-type">{typeLabel(floatingCard)}</span>
          <h2>{floatingCard.title}</h2>
          <ProjectRichText className="student-banner-rich-text" html={floatingCard.message} />
          <BannerCta banner={floatingCard} />
          <BannerDismiss
            banner={floatingCard}
            checked={acknowledged[floatingCard.id] === true}
            disabled={dismissBanner.isPending}
            onCheck={(checked) => setAcknowledged((current) => ({ ...current, [floatingCard.id]: checked }))}
            onDismiss={() => void markDismissed(floatingCard)}
          />
        </section>
      ) : null}

      {showInbox ? (
        <div className="student-banner-inbox">
          <button aria-expanded={isInboxOpen} aria-label="Open Banner inbox" onClick={() => setIsInboxOpen((current) => !current)} type="button">
            <Bell size={20} />
            <strong>Banners</strong>
            <span>{inboxBanners.length}</span>
          </button>
          {isInboxOpen ? (
            <section className="student-banner-inbox-panel">
              <header>
                <Inbox size={18} />
                <strong>Banner inbox</strong>
              </header>
              {inboxBanners.map((banner) => (
                <article key={banner.id}>
                  <span>{typeLabel(banner)}</span>
                  <h3>{banner.title}</h3>
                  <ProjectRichText className="student-banner-rich-text" html={banner.message} />
                  <BannerCta banner={banner} />
                  <BannerDismiss
                    banner={banner}
                    checked={acknowledged[banner.id] === true}
                    disabled={dismissBanner.isPending}
                    onCheck={(checked) => setAcknowledged((current) => ({ ...current, [banner.id]: checked }))}
                    onDismiss={() => void markDismissed(banner)}
                  />
                </article>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
