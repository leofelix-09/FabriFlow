interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function ProgressBar({
  progress,
  className = '',
  showPercentage = true,
  color = 'primary',
  size = 'md'
}: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  
  const colorClasses = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600'
  };

  const backgroundColorClasses = {
    primary: 'bg-primary-100',
    success: 'bg-success-100',
    warning: 'bg-warning-100',
    danger: 'bg-danger-100'
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full ${backgroundColorClasses[color]} rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${safeProgress}%` }}
        />
      </div>
      {showPercentage && (
        <div className="mt-1 text-sm text-gray-600 text-center">
          {Math.round(safeProgress)}%
        </div>
      )}
    </div>
  );
}
