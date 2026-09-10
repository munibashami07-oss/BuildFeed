import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base = `
    inline-flex items-center justify-center font-semibold rounded-xl
    transition-all duration-150 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    // Indigo accent — primary CTA
    primary:   'bg-accent text-white hover:bg-accentHover shadow-purple hover:shadow-purpleHover active:scale-[0.98]',
    // Subtle surface button — works in both light and dark
    secondary: 'bg-surface text-primary border border-borderPaper hover:bg-raised hover:border-cardHoverBorder dark:hover:bg-raised',
    // Explicit accent alias (kept for consumers that pass variant="accent")
    accent:    'bg-accent text-white hover:bg-accentHover shadow-purple hover:shadow-purpleHover active:scale-[0.98]',
    // Ghost — text only
    ghost:     'text-secondary hover:text-primary hover:bg-raised',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none" viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
};
