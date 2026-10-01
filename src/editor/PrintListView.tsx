import type { PrintListStep } from './printList';

interface PrintListViewProps {
  title: string;
  steps: PrintListStep[];
  onPrint: () => void;
  onClose: () => void;
}

export function PrintListView({ title, steps, onPrint, onClose }: PrintListViewProps) {
  return (
    <article className="print-list" data-testid="print-list">
      <div className="print-list-actions">
        <button type="button" className="btn" data-testid="btn-print-list-print" onClick={onPrint}>
          Print
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-print-list-close"
          onClick={onClose}
        >
          Sluiten
        </button>
      </div>
      <h1 data-testid="print-list-title">{title}</h1>
      {steps.length === 0 ? (
        <p data-testid="print-list-empty">Geen open placeholders.</p>
      ) : (
        <ol className="print-list-steps">
          {steps.map((step, index) => (
            <li key={`${step.stepName}-${String(index)}`}>
              <h2>{step.stepName}</h2>
              <ul>
                {step.items.map((item) => (
                  <li key={item.place} data-testid={`print-list-item-${String(index)}`}>
                    <p className="print-list-place">{item.place}</p>
                    {item.text ? <p className="print-list-text">{item.text}</p> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
