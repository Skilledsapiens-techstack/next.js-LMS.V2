import { ReactNode } from 'react';

type PageHeaderProps = {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeader({ actions, eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="page-heading">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-heading__actions">{actions}</div> : null}
    </section>
  );
}
