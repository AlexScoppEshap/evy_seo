import test from 'node:test';
import assert from 'node:assert/strict';
import { legacySlashRedirect } from './legacy-slash.ts';
test('preserve all WordPress legal URLs and download without redirect loops', () => {
  for (const slug of ['privacy','terms','legal','cookies','community-guidelines','child-safety','support','contact-us','account-deletion','download']) {
    assert.deepEqual(legacySlashRedirect('/'+slug), {path: '/'+slug+'/', status: 301});
    assert.equal(legacySlashRedirect('/'+slug+'/'), null);
  }
});
test('retain existing event and localized marketing slash normalization', () => {
  for (const path of ['/events/a-slug','/events/a-slug/media/cover','/en','/de/download']) {
    assert.equal(legacySlashRedirect(path), null);
    assert.deepEqual(legacySlashRedirect(path+'/'), {path, status: 308});
  }
  for (const path of ['/','/events-sitemap.xml','/sitemap.xml','/robots.txt','/_next/static/chunk.js']) assert.equal(legacySlashRedirect(path), null);
});
