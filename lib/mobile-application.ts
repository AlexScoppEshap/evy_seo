import { STORE_URLS, marketingPath, type Locale } from './i18n/config.ts';
// Store listings and app bundle identifiers verified for Mission 4.8.
// No offer, rating, review, download count or unverified operating-system version.
export function mobileApplicationJsonLd(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MobileApplication',
        '@id': 'https://myevy.app/#ios-app',
        name: 'Evy — Find your vibe',
        identifier: 'com.eshap.evy',
        operatingSystem: 'iOS',
        installUrl: STORE_URLS.ios,
        sameAs: STORE_URLS.ios,
        url: 'https://myevy.app' + marketingPath(locale, 'download'),
      },
      {
        '@type': 'MobileApplication',
        '@id': 'https://myevy.app/#android-app',
        name: 'Evy — Find your vibe',
        identifier: 'com.eshap.evy',
        operatingSystem: 'Android',
        installUrl: STORE_URLS.android,
        sameAs: STORE_URLS.android,
        url: 'https://myevy.app' + marketingPath(locale, 'download'),
      },
    ],
  };
}
