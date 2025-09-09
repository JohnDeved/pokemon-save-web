import { SkeletonBox, SkeletonButton, SkeletonContainer, SkeletonImage, SkeletonLoadingProvider, SkeletonText } from './Skeleton'

export { Card } from './Card'
export { PWAInstallPrompt } from './PWAInstallPrompt'
export { ScrollableContainer } from './ScrollableContainer'

const Skeleton = {
  Text: SkeletonText,
  Box: SkeletonBox,
  Button: SkeletonButton,
  Image: SkeletonImage,
  LoadingProvider: SkeletonLoadingProvider,
  Container: SkeletonContainer,
}

export { Skeleton }
