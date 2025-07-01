import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
    return (
        <section {...props} className={`bg-slate-800/50 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-800 relative ${className}`}>
            {children}
        </section>
    );
};
