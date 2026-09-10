import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
  labelRightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  rightElement,
  labelRightElement,
  className = '',
  id,
  type,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || labelRightElement) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-secondary">
              {label}
            </label>
          )}
          {labelRightElement}
        </div>
      )}

      <div className="relative flex items-center w-full">
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`editorial-input w-full ${rightElement ? 'pr-10' : ''} ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''
          } ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center justify-center text-secondary hover:text-primary">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <span className="text-xs text-red-600 font-medium mt-0.5 animate-fade-in">{error}</span>
      )}
      {helperText && !error && (
        <span className="text-xs text-secondary mt-0.5">{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
