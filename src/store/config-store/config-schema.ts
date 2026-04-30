import { GROQ_MODELS } from '@/constants/models'
import { z } from 'zod'

export const settingsSchema = z.object({
  groqApiKey: z.string().default(''),
  useEnv: z.boolean().default(false),

  language: z.string().default('en'),
  whisperModel: z
    .enum(GROQ_MODELS.map((model) => model.id))
    .default(GROQ_MODELS[0].id),

  hotkey: z.string().default('Ctrl+Shift+Space'),
  startOnLogin: z.boolean().default(false),
})

export const configSchema = z.object({
  settings: settingsSchema.default({
    groqApiKey: '',
    useEnv: false,

    language: 'en',
    whisperModel: GROQ_MODELS[0].id,

    hotkey: 'Ctrl+Shift+Space',
    startOnLogin: false,
  }),
})

export type TSettingsSchema = z.infer<typeof settingsSchema>
export type TConfigSchema = z.infer<typeof configSchema>
