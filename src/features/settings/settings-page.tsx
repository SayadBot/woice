import { HotkeyCaptureButton } from '@/components/hotkey-capture-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LANGUAGES } from '@/constants/languages'
import { settingsSchema } from '@/store/config-store'
import { useConfigStore } from '@/store/config-store/use-config-store'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AiBeautifyIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

export function SettingsPage() {
  const settings = useConfigStore((s) => s.settings)
  const updateSettings = useConfigStore((s) => s.updateSettings)

  const [showApiKey, setShowApiKey] = useState(false)

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })

  function triggerSubmit() {
    void form.handleSubmit((data) => updateSettings(data))()
  }

  return (
    <Form {...form}>
      <form onSubmit={triggerSubmit} className="space-y-6">
        <section className="space-y-5 rounded-xl border p-5">
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="hotkey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hotkey</FormLabel>
                  <FormControl>
                    <HotkeyCaptureButton
                      value={field.value || ''}
                      onChange={(value) => {
                        field.onChange(value)
                        triggerSubmit()
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      triggerSubmit()
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11! w-full">
                        <SelectValue placeholder="Select a language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANGUAGES.map((languageOption) => (
                        <SelectItem
                          key={languageOption.code}
                          value={languageOption.code}
                        >
                          {languageOption.country ? (
                            <span
                              className={`fi fi-${languageOption.country} text-[0.8rem]`}
                            />
                          ) : (
                            <HugeiconsIcon
                              className="size-4"
                              icon={AiBeautifyIcon}
                            />
                          )}

                          {languageOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whisperModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Speed</FormLabel>
                  <FormControl>
                    <label className="bg-input/30 flex cursor-pointer items-center gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={field.value === 'whisper-large-v3-turbo'}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked
                              ? 'whisper-large-v3-turbo'
                              : 'whisper-large-v3'
                          )
                          triggerSubmit()
                        }}
                      />

                      <span className="text-sm">Turbo</span>
                    </label>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <FormField
              control={form.control}
              name="groqApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="gsk_..."
                        className="h-11"
                        disabled={form.watch('useEnv')}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          triggerSubmit()
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-md"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        <HugeiconsIcon
                          icon={showApiKey ? ViewOffIcon : ViewIcon}
                          className="size-4"
                        />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="useEnv"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-end">
                  <FormControl>
                    <label className="bg-input/30 flex h-11 cursor-pointer items-center gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          triggerSubmit()
                        }}
                      />
                      <span className="text-sm">Use env</span>
                    </label>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:gap-8">
          <div className="basis-full">
            <FormField
              control={form.control}
              name="startOnLogin"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <FormLabel className="text-sm">Auto start</FormLabel>

                    <FormDescription className="text-xs">
                      Start Woice automatically on system startup
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        triggerSubmit()
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="basis-full">
            <FormField
              control={form.control}
              name="ignoreClipboard"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <FormLabel className="text-sm">Ignore clipboard</FormLabel>

                    <FormDescription className="text-xs">
                      Use direct OS text insertion instead of the clipboard.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        triggerSubmit()
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </section>
      </form>
    </Form>
  )
}
