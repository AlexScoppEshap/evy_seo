import type { Locale } from './i18n/config.ts';
// Launch configuration, in priority order. Not a ranking or a discovery catalog.
export const marketingCities = [
  { id: 'ch-lausanne', country: 'CH', aliases: ['Lausanne'], labels: {fr:'Lausanne',en:'Lausanne',de:'Lausanne',it:'Losanna',es:'Lausana'} },
  { id: 'ch-geneve', country: 'CH', aliases: ['Genève','Geneve','Genf','Geneva','Ginevra','Ginebra'], labels: {fr:'Genève',en:'Geneva',de:'Genf',it:'Ginevra',es:'Ginebra'} },
  { id: 'ch-neuchatel', country: 'CH', aliases: ['Neuchâtel','Neuchatel','Neuenburg'], labels: {fr:'Neuchâtel',en:'Neuchâtel',de:'Neuenburg',it:'Neuchâtel',es:'Neuchâtel'} },
  { id: 'ch-zurich', country: 'CH', aliases: ['Zürich','Zurich','Zuerich','Zurigo'], labels: {fr:'Zürich',en:'Zurich',de:'Zürich',it:'Zurigo',es:'Zúrich'} },
] as const;
export type MarketingCity = (typeof marketingCities)[number];
export type CityId = MarketingCity['id'];
export function getMarketingCity(id: string): MarketingCity | undefined { return marketingCities.find(c=>c.id===id); }
export function normalizeCity(value: string) { return value.normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase(); }
export function matchesCity(city: MarketingCity, name: unknown, country: unknown) {
  return typeof name==='string' && typeof country==='string' && country.trim().toUpperCase()===city.country && city.aliases.some(a=>normalizeCity(a)===normalizeCity(name));
}
export function cityLabel(id: CityId, locale: Locale) { return getMarketingCity(id)!.labels[locale]; }
