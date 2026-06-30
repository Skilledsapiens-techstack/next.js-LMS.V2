import { AlertCircle, Info } from 'lucide-react';
import { ReactNode } from 'react';

type StateBlockProps = {
  title: string;
  children: ReactNode;
  tone?: 'info' | 'warning';
};

export function StateBlock({ title, children, tone = 'info' }: StateBlockProps) {
  const Icon = tone === 'warning' ? AlertCircle : Info;

  return (
    <section className={`state-block state-block--${tone}`}>
      <Icon size={20} />
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </section>
  );
}
