import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { assertAnonymousKey, createPublicFetch } from './public-backend'
import { createAnonymousParticipantPhotoFetch } from './event-participant-photos'

const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
assertAnonymousKey(anonKey)

export const publicBackendUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
export const fetchAnonymousParticipantPhoto = createAnonymousParticipantPhotoFetch(publicBackendUrl, anonKey)
export const supabase = createClient(
  publicBackendUrl,
  anonKey,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false },
    global: { fetch: createPublicFetch() },
  },
)
