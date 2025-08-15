import {
  SkeletonBox,
  SkeletonButton,
  SkeletonContainer,
  SkeletonImage,
  SkeletonLoadingProvider,
  SkeletonText,
} from './Skeleton'

export { Card } from './Card'
export { ScrollableContainer } from './ScrollableContainer'
export { PWAInstallPrompt } from './PWAInstallPrompt'

const Skeleton = {
  Text: SkeletonText,
  Box: SkeletonBox,
  Button: SkeletonButton,
  Image: SkeletonImage,
  LoadingProvider: SkeletonLoadingProvider,
  Container: SkeletonContainer,
}

export { Skeleton }
