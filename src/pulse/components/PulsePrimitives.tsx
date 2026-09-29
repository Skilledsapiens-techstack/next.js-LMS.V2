import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReactNode } from 'react';

type PulseButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  icon?: LucideIcon;
  to?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type PulseCardProps = {
  children: ReactNode;
  className?: string;
};

type PulseBadgeProps = {
  children: ReactNode;
  tone?: 'brand' | 'gold' | 'blue' | 'green' | 'coral';
};

type PulseMetricCardProps = {
  label: string;
  value: string;
};

type PulseFeatureCardProps = {
  description: string;
  icon: LucideIcon;
  title: string;
};

export function PulseButton({ children, className = '', href, icon: Icon = ArrowRight, to, variant = 'primary' }: PulseButtonProps) {
  const buttonClassName = `pulse-button pulse-button--${variant} ${className}`.trim();
  const content = (
    <>
      <span>{children}</span>
      <Icon size={18} />
    </>
  );

  if (to) {
    return (
      <Link className={buttonClassName} to={to}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a className={buttonClassName} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button className={buttonClassName} type="button">
      {content}
    </button>
  );
}

export function PulseCard({ children, className = '' }: PulseCardProps) {
  return <article className={`pulse-card ${className}`.trim()}>{children}</article>;
}

export function PulseBadge({ children, tone = 'brand' }: PulseBadgeProps) {
  return <span className={`pulse-badge pulse-badge--${tone}`}>{children}</span>;
}

export function PulseMetricCard({ label, value }: PulseMetricCardProps) {
  return (
    <PulseCard className="pulse-metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </PulseCard>
  );
}

export function PulseFeatureCard({ description, icon: Icon, title }: PulseFeatureCardProps) {
  return (
    <PulseCard className="pulse-feature-card">
      <span className="pulse-feature-card__icon">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </PulseCard>
  );
}
