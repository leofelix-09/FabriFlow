import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-6 transition-all duration-200 shadow-none border-none ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
