import { X } from 'lucide-react';

type PulseTagSelectorProps = {
  label: string;
  max?: number;
  onChange: (nextValue: string[]) => void;
  options: string[];
  placeholder: string;
  value: string[];
};

export function PulseTagSelector({ label, max = 5, onChange, options, placeholder, value }: PulseTagSelectorProps) {
  const selected = value.slice(0, max);
  const selectedKeys = new Set(selected.map((item) => item.toLowerCase()));
  const availableOptions = options.filter((option) => !selectedKeys.has(option.toLowerCase()));
  const isFull = selected.length >= max;

  function addOption(option: string) {
    if (!option || isFull || selectedKeys.has(option.toLowerCase())) return;
    onChange([...selected, option].slice(0, max));
  }

  function removeOption(option: string) {
    onChange(selected.filter((item) => item !== option));
  }

  return (
    <label className="pulse-tag-selector">
      <span>{label}</span>
      <select
        disabled={isFull}
        onChange={(event) => {
          addOption(event.target.value);
          event.target.value = '';
        }}
        value=""
      >
        <option value="">{isFull ? `Maximum ${max} selected` : placeholder}</option>
        {availableOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className="pulse-tag-selector__chips" aria-label={`Selected ${label.toLowerCase()}`}>
        {selected.length ? (
          selected.map((option) => (
            <button key={option} onClick={() => removeOption(option)} type="button">
              <span>{option}</span>
              <X size={14} />
            </button>
          ))
        ) : (
          <em>No {label.toLowerCase()} selected yet.</em>
        )}
      </div>
      <small>{selected.length}/{max} selected</small>
    </label>
  );
}
