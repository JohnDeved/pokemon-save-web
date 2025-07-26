import * as React from 'react'

import { useResponsiveNavigation } from '@/hooks/useResponsiveNavigation'
import {
  MobileNavigationButton,
  MobileNavigationDrawer,
  MobileNavigationItem,
  MobileNavigationSection,
  MobileNavigationSeparator,
} from '@/components/ui/mobile-navigation'
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from '@/components/ui/menubar'

interface ResponsiveNavigationProps {
  onFileOpen?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onDownload?: () => void
  onRestart?: () => void
  canSave?: boolean
  canSaveAs?: boolean
  playerName?: string
}

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  onFileOpen,
  onSave,
  onSaveAs,
  onDownload,
  onRestart,
  canSave = false,
  canSaveAs = true,
  playerName,
}) => {
  const { isMobile } = useResponsiveNavigation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Mobile Navigation Content
  const mobileNavigationContent = (
    <>
      <MobileNavigationSection title="File">
        <MobileNavigationItem onClick={() => { onFileOpen?.(); closeMobileMenu() }}>
          Open
        </MobileNavigationItem>
        <MobileNavigationItem disabled>
          Open Recent
        </MobileNavigationItem>
        <MobileNavigationSeparator/>
        <MobileNavigationItem
          onClick={() => { onSave?.(); closeMobileMenu() }}
          disabled={!canSave}
          shortcut="Ctrl+S"
        >
          Save
        </MobileNavigationItem>
        <MobileNavigationItem
          onClick={() => { onSaveAs?.(); closeMobileMenu() }}
          disabled={!canSaveAs}
        >
          Save As
        </MobileNavigationItem>
        <MobileNavigationItem onClick={() => { onDownload?.(); closeMobileMenu() }}>
          Download
        </MobileNavigationItem>
        <MobileNavigationSeparator/>
        <MobileNavigationItem disabled>
          Party
        </MobileNavigationItem>
        <MobileNavigationItem disabled>
          Player {playerName && `(${playerName})`}
        </MobileNavigationItem>
        <MobileNavigationSeparator/>
        <MobileNavigationItem disabled>
          Share
        </MobileNavigationItem>
      </MobileNavigationSection>

      <MobileNavigationSection title="Edit">
        <MobileNavigationItem disabled shortcut="Ctrl+Z">
          Undo
        </MobileNavigationItem>
        <MobileNavigationItem disabled shortcut="Ctrl+Shift+Y">
          Redo
        </MobileNavigationItem>
        <MobileNavigationSeparator/>
        <MobileNavigationItem disabled>
          Reset
        </MobileNavigationItem>
      </MobileNavigationSection>

      <MobileNavigationSection title="Help">
        <MobileNavigationItem onClick={() => { onRestart?.(); closeMobileMenu() }}>
          Restart
        </MobileNavigationItem>
        <MobileNavigationSeparator/>
        <MobileNavigationItem disabled>
          Github
        </MobileNavigationItem>
        <MobileNavigationItem disabled>
          About
        </MobileNavigationItem>
      </MobileNavigationSection>
    </>
  )

  // Desktop Navigation (existing menubar)
  const desktopNavigationContent = (
    <Menubar className="geist-font">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onFileOpen}>
            Open
          </MenubarItem>
          <MenubarItem disabled>Open Recent</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem
            disabled={!canSave}
            onClick={onSave}
          >Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            onClick={onSaveAs}
            disabled={!canSaveAs}
          >Save As
          </MenubarItem>
          <MenubarItem onClick={onDownload}>
            Download
          </MenubarItem>
          <MenubarSeparator/>
          <MenubarSub>
            <MenubarSubTrigger>Party</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem disabled>Load from File</MenubarItem>
              <MenubarItem disabled>Storage</MenubarItem>
              <MenubarSeparator/>
              <MenubarItem disabled>Save As</MenubarItem>
              <MenubarItem disabled>Download</MenubarItem>
              <MenubarItem disabled>Store</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator/>
          <MenubarSub>
            <MenubarSubTrigger>Player</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem disabled>Info <MenubarShortcut>{playerName}</MenubarShortcut></MenubarItem>
              <MenubarItem disabled>Rename</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator/>
          <MenubarItem disabled>Share</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled>Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem>
          <MenubarItem disabled>Redo <MenubarShortcut>Ctrl+Shift+Y</MenubarShortcut></MenubarItem>
          <MenubarSeparator/>
          <MenubarItem disabled>Reset</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onRestart}>Restart</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem disabled>Github</MenubarItem>
          <MenubarItem disabled>About</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )

  if (isMobile) {
    return (
      <>
        <div className="flex justify-between items-center">
          <MobileNavigationButton
            isOpen={isMobileMenuOpen}
            onToggle={toggleMobileMenu}
          />
        </div>
        <MobileNavigationDrawer
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
        >
          {mobileNavigationContent}
        </MobileNavigationDrawer>
      </>
    )
  }

  return desktopNavigationContent
}

export default ResponsiveNavigation
