import React from 'react';

// Context for loading state
export const SkeletonLoadingContext = React.createContext<boolean | undefined>(undefined);

export const SkeletonLoadingProvider = ({ loading, children }: { loading: boolean, children: React.ReactNode }) => (
  <SkeletonLoadingContext.Provider value={loading}>{children}</SkeletonLoadingContext.Provider>
);

export function useSkeletonLoading(loading?: boolean) {
  const contextLoading = React.useContext(SkeletonLoadingContext);
  return loading !== undefined ? loading : contextLoading ?? true;
}
