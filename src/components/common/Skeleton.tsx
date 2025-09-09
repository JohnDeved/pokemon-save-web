import { createContext, useContext } from 'react'
import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  loading?: boolean // Indicates if skeleton should be shown
  children?: React.ReactNode
}

// Context for loading state
const SkeletonLoadingContext = createContext<boolean | undefined>(undefined)

export const SkeletonLoadingProvider = ({ loading, children }: { loading: boolean; children: React.ReactNode }) => <SkeletonLoadingContext.Provider value={loading}>{children}</SkeletonLoadingContext.Provider>

function useSkeletonLoading(loading?: boolean) {
  const contextLoading = useContext(SkeletonLoadingContext)
  return loading ?? contextLoading ?? true
}

// Mirrored text that maintains exact text dimensions
export const SkeletonText = ({
  children,
  className,
  loading, // no default here
  as,
  ...props
}: SkeletonProps & {
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
}) => {
  const isLoading = useSkeletonLoading(loading)
  const Component = as ?? 'span'
  if (!isLoading) {
    // If not loading, render children directly using JSX
    return (
      <Component className={className} {...props}>
        {children}
      </Component>
    )
  }

  // Create props object with proper typing
  const componentProps = {
    className: cn('bg-foreground/5 animate-pulse rounded', className),
    'aria-hidden': true as const,
    ...props,
  }

  return (
    <Component {...componentProps}>
      <span className="invisible">{children ?? 'Placeholder text'}</span>
    </Component>
  )
}

// Basic rectangular skeleton
export const SkeletonBox = ({ className, loading, children, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading)
  if (!isLoading) {
    return children
  }
  return <div className={cn('bg-foreground/5 animate-pulse rounded', className)} {...props} />
}

// Button skeleton that preserves button dimensions exactly
export const SkeletonButton = ({ children, className, loading, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading)
  if (!isLoading) {
    return children
  }
  return (
    <button className={cn('bg-foreground/5 animate-pulse', className)} disabled aria-hidden="true" {...props}>
      <span className="invisible">{children}</span>
    </button>
  )
}

// Image skeleton that maintains aspect ratio and forwards img props
export const SkeletonImage = ({ className, loading, ...props }: SkeletonProps & React.ImgHTMLAttributes<HTMLImageElement>) => {
  const isLoading = useSkeletonLoading(loading)
  if (!isLoading) {
    // Render actual image with all img props
    return <img className={className} {...props} />
  }
  // Render skeleton placeholder
  return (
    <div
      className={cn('bg-foreground/5 animate-pulse', className)}
      style={{
        aspectRatio: props.width && props.height ? `${props.width} / ${props.height}` : undefined,
        ...props.style,
      }}
    />
  )
}

// with the Container we just take the children, but make them invisible and non-interactive, then make the container itself pulse with the skeleton class
export const SkeletonContainer = ({ className, children, loading, ...props }: SkeletonProps) => {
  const isLoading = useSkeletonLoading(loading)
  if (!isLoading) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }

  return <div className={cn(className, 'bg-foreground/5 animate-pulse children-invisible rounded border-none')}>{children}</div>
}

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
