import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  loading?: boolean; // Indicates if skeleton should be shown
  children?: React.ReactNode;
}

// Context for loading state
const SkeletonLoadingContext = React.createContext<boolean | undefined>(undefined);

export const SkeletonLoadingProvider = ({ loading, children }: { loading: boolean, children: React.ReactNode }) => (
  <SkeletonLoadingContext.Provider value={loading}>{children}</SkeletonLoadingContext.Provider>
);

function useSkeletonLoading(loading?: boolean) {
  const contextLoading = React.useContext(SkeletonLoadingContext);
  return loading !== undefined ? loading : contextLoading ?? true;
}

// Mirrored text that maintains exact text dimensions
export const SkeletonText = ({ 
  children, 
  className,
  loading, // no default here
  as,
  ...props 
}: SkeletonProps & { 
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
}) => {
  const isLoading = useSkeletonLoading(loading);
  const Component = as || 'span';
  if (!isLoading) {
    // If not loading, render children directly
    return React.createElement(Component, { className, ...props }, children);
  }
  
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
};

// Basic rectangular skeleton
export const SkeletonBox = ({ className, loading, children, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading);
  if (!isLoading) {
    return <>{children}</>;
  }
  return (
    <div className={cn("bg-slate-700/50 animate-pulse rounded", className)} {...props} />
  );
};

// Button skeleton that preserves button dimensions exactly
export const SkeletonButton = ({ children, className, loading, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading);
  if (!isLoading) {
    return <>{children}</>;
  }
  return (
    <button 
      className={cn("bg-slate-700/50 animate-pulse", className)}
      disabled
      aria-hidden="true"
      {...props}
    >
      <span className="invisible">{children}</span>
    </button>
  );
};

// Image skeleton that maintains aspect ratio
export const SkeletonImage = ({ className, loading, children, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading);
  if (!isLoading) {
    return <>{children}</>;
  }
  return (
    <div 
      className={cn("bg-slate-700/50 animate-pulse", className)}
      {...props}
    />
  );
};

// Container that preserves layout exactly
export const SkeletonDiv = ({ className, children, ...props }: SkeletonProps) => (
  <div className={className} {...props}>
    {children}
  </div>
);

/*
Usage example for SkeletonLoadingProvider context:

import {
  SkeletonLoadingProvider,
  SkeletonText,
  SkeletonBox,
  SkeletonButton,
  SkeletonImage,
  SkeletonContainer
} from './Skeleton';

function MyComponent({ loading, data }) {
  return (
    <SkeletonLoadingProvider loading={loading}>
      <SkeletonText as="h2">{data?.title}</SkeletonText>
      <SkeletonBox style={{ width: 200, height: 100 }} />
      <SkeletonButton>Submit</SkeletonButton>
      <SkeletonImage style={{ width: 100, height: 100 }} />
      <SkeletonContainer>
        <SkeletonText>More content...</SkeletonText>
      </SkeletonContainer>
    </SkeletonLoadingProvider>
  );
}
*/