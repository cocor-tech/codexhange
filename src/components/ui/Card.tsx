import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={`glass-card ${className ?? ''}`}>
      {children}
    </div>
  );
}
