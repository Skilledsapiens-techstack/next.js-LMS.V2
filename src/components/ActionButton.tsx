import { LucideIcon } from 'lucide-react';
import { ButtonHTMLAttributes } from 'react';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  tone?: 'primary' | 'secondary' | 'disabled';
};

export function ActionButton({ icon: Icon, label, tone = 'secondary', type = 'button', ...props }: ActionButtonProps) {
  return (
    <button className={`action-button action-button--${tone}`} type={type} {...props}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
