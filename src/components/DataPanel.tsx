import { ReactNode, useMemo, useState } from 'react';
import { nextSortState, sortRows, SortState } from '../lib/sortUtils';

export type DataColumn<TItem> = {
  key: string;
  header: string;
  render: (item: TItem) => ReactNode;
  sortValue?: (item: TItem) => unknown;
};

type DataPanelProps<TItem> = {
  columns: DataColumn<TItem>[];
  items: TItem[];
  title: string;
  description: string;
};

function textFromNode(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textFromNode).join(' ');
  if (typeof value === 'object' && 'props' in value) return textFromNode((value as { props?: { children?: ReactNode } }).props?.children);
  return '';
}

export function DataPanel<TItem>({ columns, description, items, title }: DataPanelProps<TItem>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const sortedItems = useMemo(
    () =>
      sortRows(items, sort, (item, key) => {
        const column = columns.find((entry) => entry.key === key);
        return column?.sortValue ? column.sortValue(item) : textFromNode(column?.render(item));
      }),
    [columns, items, sort]
  );

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
                  <button
                    aria-label={`Sort by ${column.header}`}
                    aria-sort={sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`data-sort-button ${sort?.key === column.key ? 'data-sort-button--active' : ''}`}
                    onClick={() => setSort((current) => nextSortState(current, column.key))}
                    type="button"
                  >
                    <span>{column.header}</span>
                    <span aria-hidden="true">{sort?.key === column.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => (
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
