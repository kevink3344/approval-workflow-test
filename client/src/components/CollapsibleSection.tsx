import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="surface">
      <button
        type="button"
        className="collapsible-header w-full text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className={`collapsible-chevron ${isExpanded ? 'expanded' : ''}`}>
          ▸
        </span>
        <span className="text-lg font-semibold text-[--text]">{title}</span>
      </button>

      {isExpanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}