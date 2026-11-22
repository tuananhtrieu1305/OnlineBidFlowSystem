type Props = {
  prefix: string;
  title: string;
  clueLabel: string;
  clues: string[];
  minimum: number;
  maximum: number;
  onChange: (clues: string[]) => void;
  error?: string;
};

export default function BlindCluePoolFields({
  prefix, title, clueLabel, clues, minimum, maximum, onChange, error
}: Props) {
  return <>
    <label htmlFor={`${prefix}-count`}>{title}
      <select id={`${prefix}-count`} value={clues.length}
        onChange={event => {
          const length = Number(event.target.value);
          onChange(Array.from({ length }, (_, index) => clues[index] ?? ''));
        }}>
        {Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index)
          .map(count => <option key={count} value={count}>{count}</option>)}
      </select>
    </label>
    {clues.length > 0 && <div className="auction-grid blind-admin-clues">
      {clues.map((clue, index) => <label key={index} htmlFor={`${prefix}-${index}`}>{clueLabel} {index + 1}
        <textarea id={`${prefix}-${index}`} rows={3} maxLength={500} value={clue}
          aria-describedby={error ? `${prefix}-error` : undefined}
          onChange={event => onChange(clues.map((item, current) => current === index ? event.target.value : item))} />
      </label>)}
    </div>}
    {error && <p className="product-field-error" id={`${prefix}-error`} role="alert">{error}</p>}
  </>;
}
