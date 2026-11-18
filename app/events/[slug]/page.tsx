import Image from 'next/image'
import {
  buildEventJsonLd,
  serializeJsonLd,
  creatorDisplayName,
  isPlatformPublisher,
  EVY_SWITZERLAND_CREATOR_ID,
} from '@/lib/event-json-ld'
import { getPublicEvent, getOtherDates, getEventDetailExtras } from '@/lib/public-events'
import EventShareActions from '@/app/components/event-share-actions'
import { EventHeroPhotos, EventPhotoGrid } from '@/app/components/event-photos'
import MeetupCover from '@/app/components/meetup-cover'
import EventLocationMap from '@/app/components/event-location-map'
import { amountLabel, eventLabel, eventPricing, meetupLabel } from '@/lib/event-presentation'
import {
  buildEventMetadata, eventUrl, publicImagePath, validSlug,
  occurrenceStatus, formatDateRange, formatEventDate, getDateParts, getHasEnded, isoInstant,
} from '@/lib/event-seo'

const accent = '#7C3AED'
const brandGradient = 'linear-gradient(90deg, #4D24F8 0%, #DE5EF5 100%)'
const evyLogoUrl = 'https://seo.myevy.app/logo.svg'
const evyFaviconUrl = 'https://seo.myevy.app/favicon.svg'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return buildEventMetadata(await getPublicEvent(slug))
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const event = await getPublicEvent(slug)
  const [otherDates, extras] = await Promise.all([getOtherDates(event), getEventDetailExtras(event)])
  const lifecycle = occurrenceStatus(event)
  const imageUrl = publicImagePath(event.image_url)
  const pricing = eventPricing(event)
  const ticketingUrl = pricing.bookingUrl
  const title = event.name?.trim() || 'Untitled event'
  const category = eventLabel(event.category)
  const isMeetup = event.event_type === 'meetup'
  const styles = [...new Set(event.event_styles.flatMap(row => row.styles?.name ? [eventLabel(row.styles.name, 'style')] : []))]
  const artists = [...new Set((event.artists ?? []).map(artist => artist.trim()).filter(Boolean))]
  const avatar = publicImagePath(event.users?.profileimageurl)
  const gallery = [...new Set((event.gallery_image_urls ?? []).map(url => publicImagePath(url)).filter((url): url is string => !!url))]
  const heroPhotos = gallery.length ? gallery : imageUrl ? [imageUrl] : []
  const venue = event.venue_name?.trim()
  const organizer = creatorDisplayName(event)
  const location = [event.address, event.npa, event.city, event.country_code]
    .filter(Boolean)
    .join(', ')
  const teaser = [category, styles[0], venue].filter(Boolean).join(' · ')
  const dateParts = getDateParts(event.start_date, event.timezone)
  const dateRange = formatDateRange(
    event.start_date,
    event.end_date,
    event.timezone,
  )
  const hasEnded = getHasEnded(event.end_date ?? event.start_date)
  const ticketDomain = ticketingUrl
    ? getDomain(ticketingUrl)
    : undefined
  const canonicalUrl = eventUrl(event.seo_slug!)
  const appEventUrl = `https://app.myevy.app/event/${event.id}`
  const profileUrl = event.users?.username && event.users.username.length <= 100 && validSlug(event.users.username)
    ? `https://app.myevy.app/user/${encodeURIComponent(event.users.username)}` : appEventUrl
  const claimable = !event.series_id && [EVY_SWITZERLAND_CREATOR_ID, '752f1e81-22b1-4ed3-8140-248dbd776e2a'].includes(event.creator_id ?? '')
  const canParticipate = !hasEnded && event.status !== 'cancelled'
  const directionsUrl = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue, location].filter(Boolean).join(', '))}` : undefined
  const shareUrl = `mailto:?subject=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(canonicalUrl)}`

  const jsonLd = buildEventJsonLd({ ...event, ticketing_url: hasEnded ? null : event.ticketing_url }, canonicalUrl)

  return (
    <main
      className="min-h-screen bg-[#F7F7F9] pb-36 text-[#18171B] sm:pb-12"
      style={{ colorScheme: 'light' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section className="relative mx-auto max-w-3xl overflow-hidden bg-[#111] sm:mt-6 sm:rounded-[24px] sm:shadow-[0_18px_50px_-30px_rgba(20,18,24,0.65)]">
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-4">
          <a
            href={appEventUrl}
            aria-label="Open this event in Evy"
            className="block drop-shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
          >
            <Image
              src={evyLogoUrl}
              alt=""
              width={176}
              height={184}
              className="h-24 w-auto sm:h-28"
            />
          </a>
          <div className="flex items-center gap-1.5">
            <a href="https://app.myevy.app" title="Open Evy to organize your own event" className="rounded-full bg-white/25 px-3 py-2.5 text-xs font-extrabold text-white backdrop-blur">Organize</a>
            <EventShareActions title={title} url={canonicalUrl} appUrl={appEventUrl} />
            <details className="relative">
              <summary aria-label="More actions" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-black/30 text-xl font-bold text-white ring-1 ring-white/25 [&::-webkit-details-marker]:hidden">···</summary>
              <div className="absolute right-0 top-12 z-40 w-52 rounded-2xl border border-black/10 bg-white p-2 text-sm font-semibold shadow-xl"><a href={appEventUrl} className="block rounded-xl px-3 py-2.5 hover:bg-black/5">Report event in Evy</a>{claimable && <a href={appEventUrl} className="block rounded-xl px-3 py-2.5 hover:bg-black/5">Claim this event in Evy</a>}</div>
            </details>
          </div>
        </div>

        <div className="relative h-[405px]">
          {heroPhotos.length ? (
            <EventHeroPhotos images={heroPhotos} title={title} />
          ) : isMeetup ? <MeetupCover eventId={event.id} subcategory={event.meetup_subcategory} /> : (
            <div
              className="h-full w-full"
              style={{ background: brandGradient }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26)_0%,rgba(0,0,0,0)_48%,rgba(0,0,0,0.82)_100%)]" />
          <div className="pointer-events-none absolute bottom-[18px] left-4 right-4 flex items-end gap-4">
            <div className="min-w-0 flex-1 pr-16">
              {event.status !== 'scheduled' && <span className="mb-2 inline-flex rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white">{event.status === 'cancelled' ? 'Cancelled' : 'Postponed'}</span>}
              <span
                className="inline-flex max-w-full rounded-full px-[11px] py-1.5 text-xs font-black text-white shadow-[0_5px_14px_rgba(124,58,237,0.28)]"
                style={{ background: brandGradient }}
              >
                <span className="truncate">{category}</span>
              </span>
              <h1 className="mt-2 line-clamp-2 break-words text-2xl font-black leading-tight text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.35)]">
                {title}
              </h1>
              {teaser && (
                <p className="mt-1.5 truncate text-sm font-semibold text-white/90">
                  {teaser}
                </p>
              )}
              {styles.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5">{styles.slice(0,3).map(style=><span key={style} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">{style}</span>)}{styles.length > 3 && <span className="text-xs font-semibold text-white">+{styles.length-3}</span>}</div>}
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

      <section className="relative mx-auto -mt-3 max-w-3xl rounded-t-[20px] bg-white px-4 sm:rounded-b-[20px]">
        {(organizer || claimable) && (
          <div className="flex items-center gap-3 py-3.5">
          <div className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-[#7C3AED]/10 text-[#77747D]">
            {avatar && !isPlatformPublisher(event) ? <Image src={avatar} alt="" width={54} height={54} unoptimized className="h-[54px] w-[54px] rounded-full object-cover" /> : <PersonIcon />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-base font-extrabold">{!organizer ? "Published on Evy" : isPlatformPublisher(event) ? organizer : <a href={profileUrl} className="hover:underline">{organizer}</a>}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {organizer && <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-extrabold ${(extras.organizerPro && !isPlatformPublisher(event)) ? 'border-transparent text-white' : 'border-[#A78BFA]/40 bg-[#7C3AED]/10 text-[#7C3AED]'}`} style={(extras.organizerPro && !isPlatformPublisher(event)) ? { background: brandGradient } : undefined}>{(extras.organizerPro && !isPlatformPublisher(event)) ? 'Organizer Pro' : 'Organizer'}</span>}
              {claimable && <a href={appEventUrl} className="text-xs font-semibold text-[#7C3AED] underline">Claim this event</a>}
            </div>
          </div>
          <a href={profileUrl} className="shrink-0 rounded-xl border border-[#7C3AED] px-3 py-2.5 text-xs font-bold text-[#7C3AED]">{isPlatformPublisher(event) ? "Publisher in Evy" : "Follow in Evy"}</a>
          </div>
        )}

        {lifecycle.label !== 'Scheduled' && (
          <p role="status" className="my-3 rounded-2xl border border-black/15 bg-white p-4 font-bold">
            {lifecycle.label}: {dateRange}
            {lifecycle.schema === 'EventRescheduled' && <span className="mt-2 block text-sm font-medium text-[#626068]">Previously: {formatEventDate(event.previous_start_at, event.timezone)}</span>}
          </p>
        )}

          <div className="grid grid-cols-4 gap-1 pb-2" aria-label="Event activity">
            <Stat
              icon={<HeartIcon />}
              value={event.likescount ?? 0}
              label="Likes"
              href={appEventUrl}
            />
            <Stat
              icon={<GroupIcon />}
              value={event.participantscount ?? 0}
              label="Going"
              href="#participants"
            />
            <Stat icon={<CommentIcon />} value={extras.commentsCount ?? ''} label="Comments" href="#comments" />
            <Stat
              icon={<ShareSmallIcon />}
              value=""
              label="Share"
              href={shareUrl}
            />
          </div>

        <div className="mt-2 rounded-[18px] bg-white px-3.5 py-3 shadow-[0_8px_18px_-4px_rgba(0,0,0,0.10)]">
          <InfoRow icon={dateParts ? <span aria-hidden="true" className="grid min-h-14 w-12 place-items-center rounded-xl bg-[#7C3AED]/5 py-2 text-center font-extrabold text-[#7C3AED]"><span className="text-[10px] uppercase">{dateParts.month}</span><span className="text-xl leading-none">{dateParts.day}</span></span> : <ClockIcon />} trailing={event.status !== 'cancelled' && isoInstant(event.start_date) ? <a href={appEventUrl} title="Sign in and participate in Evy to add this event to your calendar" className="rounded-xl border border-[#7C3AED]/30 px-2 py-2 text-xs font-bold text-[#7C3AED]">Add to calendar in Evy</a> : <span aria-disabled="true" className="text-xs text-[#929099]">Calendar unavailable</span>}>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#929099]">When</span>
            <time dateTime={isoInstant(event.start_date)} className="font-semibold text-[#18171B]">{dateRange}</time>
          </InfoRow>
          <div className="my-3 h-px bg-black/[0.06]" />
          <InfoRow icon={<PinIcon />} trailing={directionsUrl ? <a href={directionsUrl} target="_blank" rel="noreferrer noopener" aria-label="Get directions"><NearMeIcon /></a> : undefined}>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#929099]">Where</span>
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
          {styles.slice(0, 2).map(style => <Chip key={style}>{style}</Chip>)}
          {styles.length > 2 && <details className="rounded-2xl"><summary className="cursor-pointer rounded-full border border-[#7C3AED]/20 px-3 py-[7px] text-sm font-semibold text-[#7C3AED]">+{styles.length - 2} styles</summary><div className="mt-2 flex flex-wrap gap-2">{styles.slice(2).map(style => <Chip key={style}>{style}</Chip>)}</div></details>}
          {event.series_id && <StateBadge>Recurring event</StateBadge>}
          {hasEnded && <StateBadge>Past event</StateBadge>}
        </div>

        {isMeetup && (
          <section aria-labelledby="meetup-summary" className="mt-5 rounded-[18px] border border-[#7C3AED]/20 bg-white p-4">
            <h2 id="meetup-summary" className="font-black">{meetupLabel(event.meetup_subcategory)}</h2>
            <p className="mt-2 text-sm text-[#626068]">{event.participantscount ?? 0}{event.participation_capacity !== null ? ` / ${event.participation_capacity}` : ''} participants</p>
            <p className="mt-1 text-sm text-[#626068]">{event.participation_mode === 'approval_required' ? 'Participation requires host approval.' : 'Join this Meetup in Evy.'}</p>
            {!event.end_date && <p className="mt-1 text-sm text-[#626068]">Without an end time, registrations close at the start.</p>}
            <p className="mt-1 text-xs font-semibold text-[#7C3AED]">Public Meetup</p>
          </section>
        )}

        <section aria-labelledby="event-community" className="mt-5 rounded-[18px] border border-[#7C3AED]/15 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="event-community" className="text-base font-black">Community</h2><a href={appEventUrl} className="inline-flex items-center gap-2 rounded-xl border border-[#7C3AED] px-3 py-2.5 text-sm font-bold text-[#7C3AED]"><GroupIcon />Join Group in Evy</a></div>
          <p className="mt-2 text-sm leading-relaxed text-[#626068]">Meet people and chat in the Evy group. Joining the event does not join the group automatically.</p>
        </section>

        <section aria-labelledby="event-participation" className="mt-4 rounded-[18px] border border-[#7C3AED]/15 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="event-participation" className="text-base font-black">Participation</h2>{canParticipate ? <a href={appEventUrl} className="rounded-xl px-4 py-3 text-sm font-black text-white" style={{ background: brandGradient }}>{event.participation_mode === 'approval_required' ? 'Request to join in Evy' : 'Participate in Evy'}</a> : <span className="text-sm font-bold text-[#626068]">{event.status === 'cancelled' ? 'Event cancelled' : 'Event ended'}</span>}</div>
          <p className="mt-2 text-sm text-[#626068]">{canParticipate ? 'Sign in to manage your participation, requests and available places in Evy.' : 'View your event and community in Evy.'}</p>
        </section>

        <div className="mt-5 hidden rounded-[18px] bg-white p-3 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.12)] sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={evyFaviconUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-black text-[#18171B]">Open this event in Evy</p>
              <p className="truncate text-sm font-semibold text-[#626068]">
                Save, share, and join the vibe in the app.
              </p>
            </div>
          </div>
          <a
            href={appEventUrl}
            className="inline-flex h-[44px] shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(124,58,237,0.30)]"
            style={{ background: brandGradient }}
          >
            <Image src={evyFaviconUrl} alt="" width={18} height={18} />
            Open in Evy
          </a>
        </div>

        <section className="mt-6">
          <h2 className="text-base font-black">{isMeetup ? 'Cost' : 'Tickets'}</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xl font-black"
                style={{ color: pricing.free ? '#18171B' : accent }}
              >
                {pricing.label}
              </p>
              {!hasEnded && event.status !== 'cancelled' && ticketDomain && (
                <p className="truncate text-sm font-semibold text-[#929099]">
                  {ticketDomain}
                </p>
              )}
            </div>
            {hasEnded ? (
              <span className="inline-flex h-[42px] shrink-0 items-center rounded-[15px] bg-[#ECEAF0] px-3.5 text-sm font-bold text-[#626068]">
                Event ended
              </span>
            ) : (
              event.status !== 'cancelled' && ticketingUrl && (
                <a
                  href={ticketingUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-[15px] bg-[#7C3AED] px-3.5 text-sm font-bold text-white shadow-[0_7px_16px_rgba(124,58,237,0.30)]"
                >
                  <OpenIcon />
                  Get tickets
                </a>
              )
            )}
          </div>
          {pricing.tickets.length > 0 && (
            <dl className="mt-3 divide-y divide-black/5 rounded-2xl bg-white px-4">
              {pricing.tickets.map((ticket, index) => (
                <div key={`${ticket.name}-${index}`} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <dt className="min-w-0 break-words font-semibold">{ticket.name}</dt>
                  <dd className="shrink-0 font-bold">{amountLabel(ticket.price, ticket.currency)}</dd>
                </div>
              ))}
            </dl>
          )}
          {isMeetup && <>{event.note?.trim() && <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[#626068]">{event.note.trim()}</p>}<p className="mt-2 text-sm text-[#626068]">Cost information from the host. No payment is collected in Evy.</p></>}
        </section>

        {artists.length > 0 && (
          <section className="mt-6" aria-labelledby="artists">
            <h2 id="artists" className="text-base font-black">Artists</h2>
            <ul className="mt-2 flex flex-wrap gap-2">{artists.slice(0, 4).map(artist => <li key={artist} className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold">{artist}</li>)}</ul>
            {artists.length > 4 && <details className="mt-2"><summary className="cursor-pointer text-sm font-bold text-[#7C3AED]">+{artists.length - 4} artists</summary><ul className="mt-2 flex flex-wrap gap-2">{artists.slice(4).map(artist => <li key={artist} className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold">{artist}</li>)}</ul></details>}
          </section>
        )}

        {event.description && (
          <section className="mt-6">
            <h2 className="text-base font-black">About</h2>
            {event.description.length <= 360 ? <p className="mt-2 whitespace-pre-line break-words text-sm font-medium leading-relaxed text-[#626068]">{event.description}</p> : <details className="group mt-2"><summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="block whitespace-pre-line break-words text-sm leading-relaxed text-[#626068] group-open:hidden">{event.description.slice(0, 360)}…</span><span className="mt-2 inline-block text-sm font-bold text-[#7C3AED] group-open:hidden">Read more</span><span className="hidden text-sm font-bold text-[#7C3AED] group-open:inline">Read less</span></summary><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[#626068]">{event.description}</p></details>}
          </section>
        )}

        {!isMeetup && event.note?.trim() && (
          <section className="mt-6" aria-labelledby="event-note">
            <h2 id="event-note" className="text-base font-black">Note</h2>
            <p className="mt-2 whitespace-pre-line break-words text-sm font-medium leading-relaxed text-[#626068]">{event.note.trim()}</p>
          </section>
        )}

        <section id="participants" aria-labelledby="participants-title" className="mt-6 scroll-mt-6">
          <div className="flex items-center justify-between gap-3"><h2 id="participants-title" className="text-base font-black">Participants · {event.participantscount ?? 0}</h2><a href={appEventUrl} className="text-sm font-bold text-[#7C3AED]">See all in Evy</a></div>
          <p className="mt-2 text-sm text-[#626068]">Discover who is going and connect in Evy.</p>
        </section>

        {directionsUrl && <section aria-labelledby="event-location" className="mt-6">
          <h2 id="event-location" className="text-base font-black">Location</h2>
          <EventLocationMap key={event.id} slug={event.seo_slug!} directionsUrl={directionsUrl} />
          <div className="flex items-center gap-3 rounded-b-2xl border border-t-0 border-black/10 bg-white p-4"><PinIcon /><div className="min-w-0 flex-1">{venue && <p className="font-bold">{venue}</p>}<p className="break-words text-sm text-[#626068]">{location}</p></div><a href={directionsUrl} target="_blank" rel="noreferrer noopener" aria-label="Open directions" className="text-[#7C3AED]"><NearMeIcon /></a></div>
        </section>}

        {!isMeetup && extras.contacts.length > 0 && <section aria-labelledby="organizer-contacts" className="mt-6 rounded-[18px] border border-black/10 bg-white p-4">
          <h2 id="organizer-contacts" className="text-base font-black">Contacts</h2>
          <div className="mt-3 flex flex-wrap gap-2">{extras.contacts.map(contact => <a key={contact.href} href={contact.href} target={contact.href.startsWith('https:') ? '_blank' : undefined} rel="noreferrer noopener" className="rounded-full border border-[#7C3AED]/25 px-3 py-2 text-sm font-semibold text-[#7C3AED]">{contact.label}</a>)}</div>
        </section>}

        {gallery.length > 1 && (
          <section className="mt-6" aria-labelledby="event-photos">
            <h2 id="event-photos" className="text-base font-black">Photos</h2>
            <EventPhotoGrid images={gallery} title={title} />
          </section>
        )}

        <section aria-labelledby="participant-photos" className="mt-6">
          <h2 id="participant-photos" className="text-base font-black">Participant photos</h2>
          {extras.participantPhotos.length > 0 && <EventPhotoGrid title={`${title} — participant photos`} images={extras.participantPhotos.map(photo=>photo.thumbnail)} fullImages={extras.participantPhotos.map(photo=>photo.image)} captions={extras.participantPhotos.map(photo=>photo.authorName)} />}
          <a href={appEventUrl} className="mt-3 flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#7C3AED]/40 bg-white p-5 text-center"><span aria-hidden="true" className="text-3xl text-[#7C3AED]">＋</span><span className="text-sm font-bold text-[#7C3AED]">Add pictures in Evy</span><span className="text-xs text-[#626068]">Sign in to add your own photos when eligible.</span></a>
        </section>

        <section id="comments" aria-labelledby="comments-title" className="mt-6 scroll-mt-6">
          <div className="flex items-center justify-between gap-3"><h2 id="comments-title" className="text-base font-black">Comments{extras.commentsCount !== null ? ` (${extras.commentsCount})` : ''}</h2><a href={appEventUrl} className="text-sm font-bold text-[#7C3AED]">See all in Evy</a></div>
          <a href={appEventUrl} className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm text-[#626068]"><span>Write a comment in Evy…</span><span aria-hidden="true" className="rounded-full bg-[#7C3AED] px-3 py-2 text-white">➤</span></a>
        </section>

        {otherDates.length > 0 && (
          <section aria-labelledby="other-dates" className="mt-6 rounded-[18px] bg-white p-4">
            <div className="flex items-center justify-between gap-3"><h2 id="other-dates" className="text-base font-black">Other dates</h2><a href={appEventUrl} className="text-sm font-bold text-[#7C3AED]">All dates in Evy</a></div>
            <ul className="mt-3 space-y-3">
              {otherDates.map(date => (
                <li key={date.id}>
                  <a href={eventUrl(date.seo_slug!)} className="block rounded-xl p-2 font-semibold text-[#7C3AED] underline focus-visible:outline-2">
                    {date.name?.trim() || 'Untitled event'} · <time dateTime={isoInstant(date.start_date)}>{formatDateRange(date.start_date, date.end_date, date.timezone)}</time>
                    {date.status === 'postponed' && ' · Postponed'}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {extras.related.length > 0 && <section aria-labelledby="related-events" className="mt-6">
          <h2 id="related-events" className="text-base font-black">You might also like</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{extras.related.map(related => {
            const image = publicImagePath(related.image_url)
            return <article key={related.id} className="min-w-0"><a href={eventUrl(related.seo_slug!)} className="block"><div className="relative aspect-square overflow-hidden rounded-2xl" style={{ background: brandGradient }}>{image ? <Image src={image} alt={related.name?.trim() || 'Event'} fill unoptimized sizes="(min-width: 640px) 180px, 50vw" className="object-cover" /> : related.event_type === 'meetup' ? <MeetupCover eventId={related.id} subcategory={related.meetup_subcategory} /> : null}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8 text-xs font-semibold text-white"><time dateTime={isoInstant(related.start_date)}>{formatEventDate(related.start_date, related.timezone)}</time></span></div><h3 className="mt-2 line-clamp-2 text-sm font-bold">{related.name?.trim() || 'Untitled event'}</h3></a><p className="mt-1 truncate text-xs text-[#626068]">{related.city}</p><a href={`https://app.myevy.app/event/${related.id}`} className="mt-1 inline-flex items-center gap-1 text-xs text-[#626068]" aria-label={`Like ${related.name?.trim() || 'event'} in Evy`}><HeartIcon />{related.likescount ?? 0}</a></article>
          })}</div>
        </section>}

        <footer className="mt-10 border-t border-black/10 py-7 text-center">
          <Image
            src={evyLogoUrl}
            alt="Evy"
            width={92}
            height={96}
            className="mx-auto h-14 w-auto"
          />
          <p className="mt-2 text-sm font-semibold text-[#626068]">
            Discover events with Evy — Find your vibe
          </p>
        </footer>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[#F7F7F9] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 sm:hidden">
        <a
          href={appEventUrl}
          className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-center font-black text-white shadow-[0_8px_20px_rgba(124,58,237,0.35)]"
          style={{ background: brandGradient }}
        >
          <Image src={evyFaviconUrl} alt="" width={20} height={20} />
          Open in Evy
        </a>
      </div>
    </main>
  )
}

function Stat({
  icon,
  value,
  label,
  href,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-center gap-1 text-[#77747D]">
        {icon}
        {value !== '' && (
          <span className="text-sm font-extrabold text-[#18171B]">{value}</span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs font-semibold text-[#626068]">
        {label}
      </div>
    </>
  )

  if (href) {
    return (
      <a href={href} className="rounded-[14px] py-1.5 text-center">
        {content}
      </a>
    )
  }

  return <div className="rounded-[14px] py-1.5 text-center">{content}</div>
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
    <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
      <span className="text-[#77747D]">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {trailing && <span className="basis-full pl-8 text-[#7C3AED] sm:basis-auto sm:pl-0">{trailing}</span>}
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
      className="max-w-full break-words rounded-full border px-[11px] py-[7px] text-sm font-semibold"
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

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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

function ShareIcon() {
  return (
    <IconBase>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6h14v-6" />
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

function CommentIcon() {
  return <IconBase><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></IconBase>
}
