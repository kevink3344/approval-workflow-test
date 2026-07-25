interface StatusBadgeProps {
  variant: 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate';
  label: string;
  className?: string;
}

export default function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const variantClass = `badge badge-${variant}`;
  return <span className={`${variantClass} ${className}`}>{label}</span>;
}