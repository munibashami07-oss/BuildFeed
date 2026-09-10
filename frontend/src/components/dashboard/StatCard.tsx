import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;       // tailwind text-* class
  iconBg?: string;          // tailwind bg-* class
  sublabel?: string;
  to?: string;              // optional link target
  animationDelay?: number;  // ms
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-accent',
  iconBg = 'bg-accent/10',
  sublabel,
  to,
  animationDelay = 0,
}) => {
  const content = (
    <div
      className="editorial-card p-4 sm:p-5 flex items-center gap-4 animate-fade-in-up hover:border-accent/30 transition-all duration-200"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both' }}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-secondary truncate">{label}</p>
        <p className="font-heading text-xl font-bold text-primary leading-tight">{value}</p>
        {sublabel && (
          <p className="text-[10px] text-secondary mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }
  return content;
};
