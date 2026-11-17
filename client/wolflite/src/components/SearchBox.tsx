interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder, also used as the accessible name */
  label: string;
  autoFocus?: boolean;
  className?: string;
}

// Search field with a magnifying glass and a themed clear (×) button.
// Used by the members and likes popups and the Discover den search.
export default function SearchBox({ value, onChange, label, autoFocus = false, className = "" }: SearchBoxProps) {
  return (
    <div className={`search-box ${className}`}>
      <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input
        type="search"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoFocus={autoFocus}
      />
      {value && (
        <button type="button" className="icon-btn search-box-clear" onClick={() => onChange("")} aria-label="Clear search">
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
