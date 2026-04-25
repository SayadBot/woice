import { Button } from '@/components/ui/button'
import {
  Cancel01Icon,
  Remove01Icon,
  RemoveSquareIcon,
  SquareIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const [isMaximized, setIsMaximized] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    let unlisten: (() => void) | undefined

    async function checkMaximized() {
      const maximized = await appWindow.isMaximized()
      if (mounted) {
        setIsMaximized(maximized)
      }
    }

    void (async () => {
      await checkMaximized()
      unlisten = await appWindow.onResized(() => {
        void checkMaximized()
      })
    })()

    return () => {
      mounted = false
      unlisten?.()
    }
  }, [appWindow])

  async function handleMinimize() {
    await appWindow.minimize()
  }

  async function handleMaximize() {
    await appWindow.toggleMaximize()
    const maximized = await appWindow.isMaximized()
    setIsMaximized(maximized)
  }

  async function handleClose() {
    await appWindow.close()
  }

  return (
    <div
      data-tauri-drag-region
      className="bg-background flex items-center justify-between border-b"
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <img src="/logo.svg" alt="Woice" className="size-4" />
        <span className="text-xs font-medium">Woice</span>
      </div>

      <div
        data-tauri-drag-region={false}
        className="flex items-center [&>button]:h-10! [&>button]:w-11! [&>button]:rounded-none!"
      >
        <Button
          tabIndex={-1}
          variant="ghost"
          onClick={handleMinimize}
          className="group"
        >
          <HugeiconsIcon icon={Remove01Icon} className="size-5" />
        </Button>

        <Button
          tabIndex={-1}
          variant="ghost"
          onClick={handleMaximize}
          className="group"
        >
          {isMaximized ? (
            <HugeiconsIcon icon={RemoveSquareIcon} className="size-4" />
          ) : (
            <HugeiconsIcon icon={SquareIcon} className="size-4" />
          )}
        </Button>

        <Button
          tabIndex={-1}
          variant="ghost"
          onClick={handleClose}
          className="group hover:bg-destructive!"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
        </Button>
      </div>
    </div>
  )
}
