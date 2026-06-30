type StatusBadgeProps = {
  children: string;
  tone?: 'neutral' | 'safe' | 'warning' | 'danger';
};

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
