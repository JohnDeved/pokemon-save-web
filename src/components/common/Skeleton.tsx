import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

// Skeleton primitives that mirror actual content
export const Skeleton = {
  // Mirrored text that maintains exact text dimensions
  Text: ({ 
    children, 
    className, 
    as,
    ...props 
  }: SkeletonProps & { 
    as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  }) => {
    const Component = as || 'span';
    
    // Create props object with proper typing
    const componentProps = {
      className: cn("bg-slate-700/50 animate-pulse rounded", className),
      'aria-hidden': true as const,
      ...props
    };

    return React.createElement(
      Component, 
      componentProps,
      React.createElement('span', { className: 'invisible' }, children || 'Placeholder text')
    );
  },

  // Basic rectangular skeleton
  Box: ({ className, ...props }: SkeletonProps) => (
    <div className={cn("bg-slate-700/50 animate-pulse rounded", className)} {...props} />
  ),

  // Button skeleton that preserves button dimensions exactly
  Button: ({ children, className, ...props }: SkeletonProps) => (
    <button 
      className={cn("bg-slate-700/50 animate-pulse", className)}
      disabled
      aria-hidden="true"
      {...props}
    >
      <span className="invisible">{children}</span>
    </button>
  ),

  // Image skeleton that maintains aspect ratio
  Image: ({ className, ...props }: SkeletonProps) => (
    <div 
      className={cn("bg-slate-700/50 animate-pulse", className)}
      {...props}
    />
  ),

  // Container that preserves layout exactly
  Container: ({ className, children, ...props }: SkeletonProps) => (
    <div className={className} {...props}>
      {children}
    </div>
  )
};

// Utility hook for skeleton state
export const useSkeleton = (isLoading: boolean, delay: number = 0) => {
  const [shouldShow, setShouldShow] = React.useState(delay === 0 ? isLoading : false);

  React.useEffect(() => {
    if (isLoading && delay > 0) {
      const timer = setTimeout(() => setShouldShow(true), delay);
      return () => clearTimeout(timer);
    } else {
      setShouldShow(isLoading);
    }
  }, [isLoading, delay]);

  return shouldShow;
};
