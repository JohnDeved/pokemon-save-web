import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface ScrollableContainerProps {
    children: React.ReactNode;
    className?: string;
}

type ScrollState = 'none' | 'top' | 'bottom' | 'both';

const fadeClassMap: Record<ScrollState, string> = {
    top: 'scroll-fade-top',
    bottom: 'scroll-fade-bottom',
    both: 'scroll-fade-both',
    none: ''
};

// Scrollable container with dynamic fade effects
export const ScrollableContainer: React.FC<ScrollableContainerProps> = ({ children, className }) => {
    const [scrollState, setScrollState] = useState<ScrollState>('none');
    const containerRef = useRef<HTMLDivElement>(null);

    const checkScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return setScrollState('none');
        if (el.scrollHeight <= el.clientHeight) return setScrollState('none');
        const atTop = el.scrollTop === 0;
        const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1;
        if (!atTop && !atBottom) return setScrollState('both');
        if (atTop && !atBottom) return setScrollState('bottom');
        if (!atTop && atBottom) return setScrollState('top');
        setScrollState('none');
    }, []);

    useLayoutEffect(() => {
        checkScroll();
    }, [checkScroll, children]);

    useEffect(() => {
        const el = containerRef.current;
        el?.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
            el?.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll]);

    return (
        <div
            ref={containerRef}
            className={cn('scroll-container geist-font', className, fadeClassMap[scrollState])}
        >
            {children}
        </div>
    );
};
