import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface AlertProps {
  type?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  className?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'error',
  title,
  message,
  className = '',
  onDismiss,
}) => {
  const typeStyles = {
    error:   'bg-red-500/8 border-red-500/25 text-red-400 dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-400',
    success: 'bg-emerald-500/8 border-emerald-500/25 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-400',
    info:    'bg-raised border-borderPaper text-primary',
  };

  const icons = {
    error:   <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
    success: <CheckCircle  className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />,
    info:    <Info         className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />,
  };

  return (
    <div className={`flex items-start gap-3 p-3.5 border rounded-xl text-sm ${typeStyles[type]} ${className}`}>
      {icons[type]}
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        <p className="leading-snug opacity-90">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
