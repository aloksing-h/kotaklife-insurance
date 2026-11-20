import assert from 'node:assert/strict';
import test from 'node:test';
import {
  categoryFromPath, format, parseSortOptions, search, SORTERS, toResults, toTerms,
} from '../blocks/search-results/search-results-utils.js';

const DAY = 86400;
const NOW = 1794700800;

// rows as the site search index returns them (helix-query.yaml "search")
const rows = [
  {
    path: '/in/en/how-do-i/pay-premium', title: 'Insurance Pay Premium Payment Options', description: 'Pay your premium online.', image: '/content/dam/pay.webp', category: 'How do I', lastModified: String(NOW), robots: '',
  },
  {
    path: '/in/en/insurance-guide/nri-premium', title: 'NRI Premium Payment Options', description: 'Pay from NRE or NRO accounts.', image: '', category: '', lastModified: String(NOW - DAY), robots: '',
  },
  {
    path: '/in/en/insurance-guide/child-plan', title: 'Child plan: secure your child’s future', description: 'Save for education.', image: '/default-meta-image.png', category: 'Insurance Guide', lastModified: String(NOW - 30 * DAY), robots: '',
  },
  {
    path: '/in/en/how-do-i/old-premium', title: 'Old premium page', description: 'Hidden', category: 'How do I', lastModified: String(NOW), robots: 'noindex, nofollow',
  },
  { path: '/in/en/nav', title: 'Navigation premium', lastModified: String(NOW) },
  { path: '/in/en/modals/global-search', title: 'Search premium', lastModified: String(NOW) },
  {
    path: '/in/en/no-title', title: '', description: 'premium', lastModified: String(NOW),
  },
];

test('index rows: hidden pages, site furniture and untitled pages are never results', () => {
  const paths = toResults(rows).map((result) => result.path);
  assert.deepEqual(paths, [
    '/in/en/how-do-i/pay-premium',
    '/in/en/insurance-guide/nri-premium',
    '/in/en/insurance-guide/child-plan',
  ]);
});

test('index rows: seconds become milliseconds, the default image is dropped, a missing category comes from the path', () => {
  const [pay, nri, child] = toResults(rows);
  assert.equal(pay.time, NOW * 1000);
  assert.equal(pay.image, '/content/dam/pay.webp');
  assert.equal(child.image, '');
  assert.equal(nri.category, 'Insurance guide');
  assert.equal(categoryFromPath('/in/en/how-do-i/pay-premium'), 'How do I');
  assert.equal(categoryFromPath('/in/en/claims'), '');
});

test('keywords: case, accents, spaces and punctuation do not matter', () => {
  assert.deepEqual(toTerms('  "Child"  &  PLAN?  '), ['child', 'plan']);
  assert.deepEqual(toTerms('Café   café'), ['cafe']);
  assert.deepEqual(toTerms('   '), []);
});

test('search: every keyword must be found; titles count more than descriptions', () => {
  const results = toResults(rows);
  assert.deepEqual(search(results, 'pay premium').map((r) => r.path), [
    '/in/en/how-do-i/pay-premium',
    '/in/en/insurance-guide/nri-premium',
  ]);
  assert.deepEqual(search(results, '"child" & plan?').map((r) => r.path), ['/in/en/insurance-guide/child-plan']);
  assert.deepEqual(search(results, 'premium xyz'), []);
  assert.deepEqual(search(results, '   '), []);
  const [first, second] = search(results, 'pay premium').sort(SORTERS.relevance);
  assert.ok(first.score > second.score);
  assert.equal(first.path, '/in/en/how-do-i/pay-premium');
});

test('sort: newest, oldest and relevance', () => {
  const found = search(toResults(rows), 'premium');
  assert.deepEqual([...found].sort(SORTERS.newest).map((r) => r.path), [
    '/in/en/how-do-i/pay-premium', '/in/en/insurance-guide/nri-premium',
  ]);
  assert.deepEqual([...found].sort(SORTERS.oldest).map((r) => r.path), [
    '/in/en/insurance-guide/nri-premium', '/in/en/how-do-i/pay-premium',
  ]);
});

test('authored settings: sort options and the results count text', () => {
  assert.deepEqual(parseSortOptions('Newest=newest, Oldest=oldest, Most relevant=relevance').map((o) => o.value), [
    'newest', 'oldest', 'relevance',
  ]);
  assert.deepEqual(parseSortOptions('Latest=latest'), [{ label: 'Newest', value: 'newest' }]);
  assert.equal(format('{count} Results Found for “{query}”', { count: '1,170' }), '1,170 Results Found for “{query}”');
});
