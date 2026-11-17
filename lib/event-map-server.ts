import 'server-only'
import { createEventMapReader } from './event-map'

export const eventMapReader = createEventMapReader(process.env.MAPTILER_API_KEY, fetch, process.env.MAPTILER_API_ORIGIN)
