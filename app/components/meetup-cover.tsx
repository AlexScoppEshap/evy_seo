import Image from 'next/image'
import { meetupCoverFileName } from '@/lib/event-presentation'

import cover0 from '../assets/meetups/culture_activities-1.webp'
import cover1 from '../assets/meetups/culture_activities-2.webp'
import cover2 from '../assets/meetups/culture_activities-3.webp'
import cover3 from '../assets/meetups/culture_activities-4.webp'
import cover4 from '../assets/meetups/culture_activities-5.webp'
import cover5 from '../assets/meetups/drinks_nightlife-1.webp'
import cover6 from '../assets/meetups/drinks_nightlife-2.webp'
import cover7 from '../assets/meetups/drinks_nightlife-3.webp'
import cover8 from '../assets/meetups/drinks_nightlife-4.webp'
import cover9 from '../assets/meetups/drinks_nightlife-5.webp'
import cover10 from '../assets/meetups/games_gaming-1.webp'
import cover11 from '../assets/meetups/games_gaming-2.webp'
import cover12 from '../assets/meetups/games_gaming-3.webp'
import cover13 from '../assets/meetups/games_gaming-4.webp'
import cover14 from '../assets/meetups/games_gaming-5.webp'
import cover15 from '../assets/meetups/networking-1.webp'
import cover16 from '../assets/meetups/networking-2.webp'
import cover17 from '../assets/meetups/networking-3.webp'
import cover18 from '../assets/meetups/networking-4.webp'
import cover19 from '../assets/meetups/networking-5.webp'
import cover20 from '../assets/meetups/other-1.webp'
import cover21 from '../assets/meetups/other-2.webp'
import cover22 from '../assets/meetups/other-3.webp'
import cover23 from '../assets/meetups/other-4.webp'
import cover24 from '../assets/meetups/other-5.webp'
import cover25 from '../assets/meetups/outdoor_nature-1.webp'
import cover26 from '../assets/meetups/outdoor_nature-2.webp'
import cover27 from '../assets/meetups/outdoor_nature-3.webp'
import cover28 from '../assets/meetups/outdoor_nature-4.webp'
import cover29 from '../assets/meetups/outdoor_nature-5.webp'
import cover30 from '../assets/meetups/restaurants_coffee-1.webp'
import cover31 from '../assets/meetups/restaurants_coffee-2.webp'
import cover32 from '../assets/meetups/restaurants_coffee-3.webp'
import cover33 from '../assets/meetups/restaurants_coffee-4.webp'
import cover34 from '../assets/meetups/restaurants_coffee-5.webp'
import cover35 from '../assets/meetups/sports_fitness-1.webp'
import cover36 from '../assets/meetups/sports_fitness-2.webp'
import cover37 from '../assets/meetups/sports_fitness-3.webp'
import cover38 from '../assets/meetups/sports_fitness-4.webp'
import cover39 from '../assets/meetups/sports_fitness-5.webp'

const covers = {
  'culture_activities-1.webp': cover0,
  'culture_activities-2.webp': cover1,
  'culture_activities-3.webp': cover2,
  'culture_activities-4.webp': cover3,
  'culture_activities-5.webp': cover4,
  'drinks_nightlife-1.webp': cover5,
  'drinks_nightlife-2.webp': cover6,
  'drinks_nightlife-3.webp': cover7,
  'drinks_nightlife-4.webp': cover8,
  'drinks_nightlife-5.webp': cover9,
  'games_gaming-1.webp': cover10,
  'games_gaming-2.webp': cover11,
  'games_gaming-3.webp': cover12,
  'games_gaming-4.webp': cover13,
  'games_gaming-5.webp': cover14,
  'networking-1.webp': cover15,
  'networking-2.webp': cover16,
  'networking-3.webp': cover17,
  'networking-4.webp': cover18,
  'networking-5.webp': cover19,
  'other-1.webp': cover20,
  'other-2.webp': cover21,
  'other-3.webp': cover22,
  'other-4.webp': cover23,
  'other-5.webp': cover24,
  'outdoor_nature-1.webp': cover25,
  'outdoor_nature-2.webp': cover26,
  'outdoor_nature-3.webp': cover27,
  'outdoor_nature-4.webp': cover28,
  'outdoor_nature-5.webp': cover29,
  'restaurants_coffee-1.webp': cover30,
  'restaurants_coffee-2.webp': cover31,
  'restaurants_coffee-3.webp': cover32,
  'restaurants_coffee-4.webp': cover33,
  'restaurants_coffee-5.webp': cover34,
  'sports_fitness-1.webp': cover35,
  'sports_fitness-2.webp': cover36,
  'sports_fitness-3.webp': cover37,
  'sports_fitness-4.webp': cover38,
  'sports_fitness-5.webp': cover39,
}

export default function MeetupCover({ eventId, subcategory }: { eventId: string; subcategory: string | null }) {
  const image = covers[meetupCoverFileName(eventId, subcategory) as keyof typeof covers]
  return <Image src={image.src} alt="" fill unoptimized sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
}
