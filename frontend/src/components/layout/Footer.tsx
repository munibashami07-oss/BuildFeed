import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-borderPaper bg-paper py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <span className="font-heading font-semibold text-primary">BuildFeed.</span>
          <span>&mdash; Editorial discovery & project platform</span>
        </div>
        <p>&copy; {new Date().getFullYear()} buildfeed. All rights reserved.</p>
      </div>
    </footer>
  );
};
