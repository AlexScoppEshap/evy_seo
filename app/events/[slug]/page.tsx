import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EventRecord = {
  id: string
  name: string | null
  category: string | null
  description: string | null
  image_url: string | null
  venue_name: string | null
  address: string | null
  npa: string | null
  city: string | null
  country_code: string | null
  timezone: string | null
  start_date: string | null
  end_date: string | null
  price: number | null
  currency_code: string | null
  ticketing_url: string | null
  seo_slug: string | null
  likescount: number | null
  participantscount: number | null
  external_organizer_name: string | null
}

const accent = '#7C3AED'
const brandGradient = 'linear-gradient(90deg, #4D24F8 0%, #DE5EF5 100%)'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: event } = await supabase
    .from('events')
    .select('name, city, description, image_url')
    .eq('seo_slug', slug)
    .maybeSingle()

  if (!event) return {}

  const title = event.name ?? 'Event'
  const city = event.city ? ` in ${event.city}` : ''
  const description =
    event.description?.slice(0, 155) ??
    `Discover ${title}${city}. Find event details, dates and more on Evy.`

  return {
    title: `${title}${city} | Evy`,
    description,
    openGraph: {
      title: `${title}${city} | Evy`,
      description,
      images: event.image_url ? [{ url: event.image_url }] : undefined,
    },
    alternates: {
      canonical: `https://myevy.app/events/${slug}`,
    },
  }
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data, error } = await supabase
    .from('events')
    .select(
      `
        id,
        name,
        category,
        description,
        image_url,
        venue_name,
        address,
        npa,
        city,
        country_code,
        timezone,
        start_date,
        end_date,
        price,
        currency_code,
        ticketing_url,
        seo_slug,
        likescount,
        participantscount,
        external_organizer_name
      `,
    )
    .eq('seo_slug', slug)
    .maybeSingle<EventRecord>()

  if (error || !data) notFound()

  const event = data
  const title = event.name?.trim() || 'Untitled event'
  const category = titleCase(event.category) || 'Event'
  const venue = event.venue_name?.trim()
  const organizer = event.external_organizer_name?.trim() || 'Evy Organizer'
  const location = [event.address, event.npa, event.city, event.country_code]
    .filter(Boolean)
    .join(', ')
  const teaser = [category, venue, event.city].filter(Boolean).join(' · ')
  const dateParts = getDateParts(event.start_date, event.timezone)
  const dateRange = formatDateRange(
    event.start_date,
    event.end_date,
    event.timezone,
  )
  const hasEnded = getHasEnded(event.end_date ?? event.start_date)
  const ticketDomain = event.ticketing_url
    ? getDomain(event.ticketing_url)
    : undefined
  const priceLabel = formatPrice(event.price, event.currency_code)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: event.description || undefined,
    startDate: event.start_date || undefined,
    endDate: event.end_date || undefined,
    image:
      event.image_url && !event.image_url.includes('token=')
        ? [event.image_url]
        : undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: hasEnded
      ? 'https://schema.org/EventCompleted'
      : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: venue || event.city || title,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address || undefined,
        postalCode: event.npa || undefined,
        addressLocality: event.city || undefined,
        addressCountry: event.country_code || undefined,
      },
    },
    offers:
      event.price !== null
        ? {
            '@type': 'Offer',
            price: event.price,
            priceCurrency: event.currency_code || undefined,
            url: event.ticketing_url || undefined,
            availability: hasEnded
              ? 'https://schema.org/SoldOut'
              : 'https://schema.org/InStock',
          }
        : undefined,
  }

  return (
    <main
      className="min-h-screen bg-[#F7F7F9] pb-28 text-[#18171B]"
      style={{ colorScheme: 'light' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative mx-auto max-w-3xl overflow-hidden bg-[#111] sm:mt-6 sm:rounded-[24px] sm:shadow-[0_18px_50px_-30px_rgba(20,18,24,0.65)]">
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
          <Link
            href="/"
            aria-label="Back to events"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white ring-1 ring-white/25 backdrop-blur"
          >
            <ChevronLeftIcon />
          </Link>
          <div className="flex gap-2">
            <button
              aria-label="Share event"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white ring-1 ring-white/25 backdrop-blur"
            >
              <ShareIcon />
            </button>
            <button
              aria-label="More actions"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white ring-1 ring-white/25 backdrop-blur"
            >
              <MoreIcon />
            </button>
          </div>
        </div>

        <div className="relative h-[405px]">
          {event.image_url ? (
            <Image
              src={event.image_url}
              alt={title}
              fill
              priority
              unoptimized
              sizes="(min-width: 768px) 768px, 100vw"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: brandGradient }}
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,rgba(0,0,0,0)_48%,rgba(0,0,0,0.82)_100%)]" />
          <div className="absolute bottom-[18px] left-4 right-4 flex items-end gap-4">
            <div className="min-w-0 flex-1 pr-16">
              <span
                className="inline-flex max-w-full rounded-full px-[11px] py-1.5 text-xs font-black text-white shadow-[0_5px_14px_rgba(124,58,237,0.28)]"
                style={{ background: brandGradient }}
              >
                <span className="truncate">{category}</span>
              </span>
              <h1 className="mt-2 line-clamp-2 text-2xl font-black leading-[1.02] text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.35)]">
                {title}
              </h1>
              {teaser && (
                <p className="mt-1.5 truncate text-sm font-semibold text-white/90">
                  {teaser}
                </p>
              )}
            </div>
            {dateParts && (
              <div className="absolute bottom-2 right-0 w-[58px] rounded-2xl border border-white/40 bg-black/35 py-2 text-center text-white">
                <div className="text-[11px] font-extrabold uppercase">
                  {dateParts.weekday}
                </div>
                <div className="text-[28px] font-black leading-none">
                  {dateParts.day}
                </div>
                <div className="text-[11px] font-extrabold uppercase">
                  {dateParts.month}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4">
        <div className="flex items-center gap-3 py-3.5">
          <div className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-[#7C3AED]/10 text-[#77747D]">
            <PersonIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-base font-extrabold">{organizer}</p>
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#E6DDFF]/50 bg-[#7C3AED] text-white">
                <CheckIcon />
              </span>
            </div>
            <span className="mt-1 inline-flex rounded-full border border-[#A78BFA]/40 bg-[#7C3AED]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#7C3AED]">
              Organizer
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 pb-2">
          <Stat icon={<HeartIcon />} value={event.likescount ?? 0} label="Likes" />
          <Stat
            icon={<GroupIcon />}
            value={event.participantscount ?? 0}
            label="Going"
          />
          <Stat icon={<CommentIcon />} value="0" label="Comments" />
          <Stat icon={<ShareSmallIcon />} value="" label="Share" />
        </div>

        <div className="mt-2 rounded-[18px] bg-white px-3.5 py-3 shadow-[0_8px_18px_-4px_rgba(0,0,0,0.10)]">
          <InfoRow icon={<ClockIcon />}>
            <span className="font-semibold text-[#18171B]">{dateRange}</span>
          </InfoRow>
          <div className="my-3 h-px bg-black/[0.06]" />
          <InfoRow icon={<PinIcon />} trailing={<NearMeIcon />}>
            {venue && (
              <span className="block truncate font-extrabold text-[#18171B]">
                {venue}
              </span>
            )}
            <span className="line-clamp-2 text-sm font-semibold text-[#626068]">
              {location || 'Location to be announced'}
            </span>
          </InfoRow>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip emphasized>{category}</Chip>
          {event.city && <Chip>{event.city}</Chip>}
          {hasEnded && <StateBadge>Past event</StateBadge>}
        </div>

        <section className="mt-6">
          <h2 className="text-base font-black">Tickets</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xl font-black"
                style={{ color: event.price === null ? '#18171B' : accent }}
              >
                {event.price === null ? priceLabel : `From ${priceLabel}`}
              </p>
              {ticketDomain && (
                <p className="truncate text-sm font-semibold text-[#929099]">
                  {ticketDomain}
                </p>
              )}
            </div>
            {event.ticketing_url && (
              <a
                href={event.ticketing_url}
                rel="noreferrer"
                target="_blank"
                className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-[15px] bg-[#7C3AED] px-3.5 text-sm font-bold text-white shadow-[0_7px_16px_rgba(124,58,237,0.30)]"
              >
                <OpenIcon />
                Tickets
              </a>
            )}
          </div>
        </section>

        {event.description && (
          <section className="mt-6">
            <h2 className="text-base font-black">{title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm font-medium leading-[1.45] text-[#626068]">
              {event.description}
            </p>
          </section>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[#F7F7F9] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 sm:hidden">
        <a
          href={event.ticketing_url || '#'}
          className="block rounded-2xl px-4 py-3.5 text-center font-black text-white shadow-[0_8px_20px_rgba(124,58,237,0.35)]"
          style={{ background: hasEnded ? '#C8C5CE' : brandGradient }}
        >
          {hasEnded ? 'Event ended' : "I'm participating"}
        </a>
      </div>
    </main>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
}) {
  return (
    <div className="rounded-[14px] py-1.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[#77747D]">
        {icon}
        {value !== '' && (
          <span className="text-sm font-extrabold text-[#18171B]">{value}</span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs font-semibold text-[#626068]">
        {label}
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  trailing,
  children,
}: {
  icon: React.ReactNode
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[#77747D]">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {trailing && <span className="text-[#7C3AED]">{trailing}</span>}
    </div>
  )
}

function Chip({
  emphasized = false,
  children,
}: {
  emphasized?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className="rounded-full border px-[11px] py-[7px] text-sm font-semibold"
      style={{
        background: emphasized ? accent : 'rgba(167, 139, 250, 0.22)',
        borderColor: emphasized
          ? 'rgba(124, 58, 237, 0.70)'
          : 'rgba(124, 58, 237, 0.16)',
        color: emphasized ? '#FFFFFF' : accent,
        fontWeight: emphasized ? 800 : 600,
      }}
    >
      {children}
    </span>
  )
}

function StateBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-[#F1F1F4] px-2 py-1 text-[10px] font-bold text-[#626068]">
      <HistoryIcon />
      {children}
    </span>
  )
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
  timezone: string | null,
) {
  if (!startDate) return 'Date to be announced'
  const timeZone = timezone || undefined
  const formatter = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
  const start = formatter.format(new Date(startDate))
  if (!endDate) return start

  const end = formatter.format(new Date(endDate))
  return `${start} - ${end}`
}

function getDateParts(startDate: string | null, timezone: string | null) {
  if (!startDate) return null
  const date = new Date(startDate)
  const timeZone = timezone || undefined

  return {
    weekday: new Intl.DateTimeFormat('en', {
      weekday: 'short',
      timeZone,
    }).format(date),
    day: new Intl.DateTimeFormat('en', {
      day: 'numeric',
      timeZone,
    }).format(date),
    month: new Intl.DateTimeFormat('en', {
      month: 'short',
      timeZone,
    }).format(date),
  }
}

function getHasEnded(date: string | null) {
  return date ? new Date(date).getTime() < Date.now() : false
}

function formatPrice(price: number | null, currency: string | null) {
  if (price === null) return 'Visit organizer website'
  if (price === 0) return 'Free'

  return `${(currency || 'USD').toUpperCase()} ${price.toFixed(0)}.-`
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function titleCase(value: string | null) {
  if (!value) return ''
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <IconBase>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  )
}

function ShareIcon() {
  return (
    <IconBase>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6h14v-6" />
    </IconBase>
  )
}

function MoreIcon() {
  return (
    <IconBase>
      <path d="M5 12h.01" />
      <path d="M12 12h.01" />
      <path d="M19 12h.01" />
    </IconBase>
  )
}

function PersonIcon() {
  return (
    <IconBase>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <IconBase>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </IconBase>
  )
}

function GroupIcon() {
  return (
    <IconBase>
      <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  )
}

function CommentIcon() {
  return (
    <IconBase>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    </IconBase>
  )
}

function ShareSmallIcon() {
  return <ShareIcon />
}

function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </IconBase>
  )
}

function PinIcon() {
  return (
    <IconBase>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </IconBase>
  )
}

function NearMeIcon() {
  return (
    <IconBase>
      <path d="m12 19 7-16-16 7 7 3 2 6Z" />
    </IconBase>
  )
}

function OpenIcon() {
  return (
    <IconBase>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </IconBase>
  )
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
