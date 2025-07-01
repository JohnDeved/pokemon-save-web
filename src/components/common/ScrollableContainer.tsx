import React, { useState, useEffect, useRef } from 'react';

interface ScrollableContainerProps {
    children: React.ReactNode;
    className?: string;
}

// Reusable component for a scrollable container with dynamic fade effects
export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({ children, className }) => {
    const [scrollState, setScrollState] = useState('none');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkScroll = () => {
            const el = containerRef.current;
            if (!el) return;

            const isScrollable = el.scrollHeight > el.clientHeight;
            if (!isScrollable) {
                setScrollState('none');
                return;
            }

            const atTop = el.scrollTop === 0;
            const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1; // More robust check

            if (atTop && !atBottom) {
                setScrollState('bottom');
            } else if (!atTop && atBottom) {
                setScrollState('top');
            } else if (!atTop && !atBottom) {
                setScrollState('both');
            } else {
                setScrollState('none');
            }
        };

        const el = containerRef.current;
        checkScroll(); // Initial check

        el?.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll); // Re-check on resize

        return () => {
            el?.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [children]); // Re-run effect if children change

    const fadeClass = {
        top: 'scroll-fade-top',
        bottom: 'scroll-fade-bottom',
        both: 'scroll-fade-both',
        none: ''
    }[scrollState];

    return (
        <div ref={containerRef} className={`scroll-container ${className} ${fadeClass}`}>
            {children}
        </div>
    );
};
