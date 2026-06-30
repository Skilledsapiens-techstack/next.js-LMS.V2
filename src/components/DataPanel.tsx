import { ReactNode } from 'react';

export type DataColumn<TItem> = {
  key: string;
  header: string;
  render: (item: TItem) => ReactNode;
};

type DataPanelProps<TItem> = {
  columns: DataColumn<TItem>[];
  items: TItem[];
  title: string;
  description: string;
};

export function DataPanel<TItem>({ columns, description, items, title }: DataPanelProps<TItem>) {
  return (
    <section className="data-panel">
      <div className="data-panel__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
