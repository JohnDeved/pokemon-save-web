import { SkeletonText, SkeletonBox, SkeletonButton, SkeletonDiv, SkeletonImage, SkeletonLoadingProvider } from './Skeleton';

export { ScrollableContainer } from './ScrollableContainer';
export { Card } from './Card';

const Skeleton = {
  Text: SkeletonText,
  Box: SkeletonBox,
  Button: SkeletonButton,
  Div: SkeletonDiv, // Renamed for clarity
  Container: SkeletonDiv,
  Image: SkeletonImage,
  LoadingProvider: SkeletonLoadingProvider,
}

export { Skeleton };