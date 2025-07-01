import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
    return (
        <section {...props} className={cn("bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-800 relative", className)}>
            {children}
        </section>
    );
};
