export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  const candidate = e as Partial<BeforeInstallPromptEvent>
  return typeof candidate.prompt === 'function' && typeof candidate.userChoice !== 'undefined'
}
