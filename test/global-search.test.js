/* global globalThis */
import assert from 'node:assert/strict';
import test from 'node:test';

// the overlay builds the results page link from the current page address
globalThis.window = {
  location: { href: 'https://www.kotaklife.com/in/en/claims?page=3', origin: 'https://www.kotaklife.com' },
};
const { searchUrl } = await import('../blocks/custom-rte/global-search.js');

test('overlay: the keyword is sent to the results page, encoded', () => {
  assert.equal(searchUrl('/in/en/search', 'Pay Premium'), '/in/en/search?q=Pay+Premium');
  assert.equal(searchUrl('/in/en/search', '"child" & plan?'), '/in/en/search?q=%22child%22+%26+plan%3F');
  assert.equal(searchUrl('/in/en/search', 'बीमा'), '/in/en/search?q=%E0%A4%AC%E0%A5%80%E0%A4%AE%E0%A4%BE');
});

test('overlay: a new search starts on page 1 and keeps other authored parameters', () => {
  assert.equal(searchUrl('/in/en/search?page=4&sort=oldest', 'claim'), '/in/en/search?sort=oldest&q=claim');
});

test('overlay: a results page on another site keeps its full address', () => {
  assert.equal(searchUrl('https://search.example.com/find', 'claim'), 'https://search.example.com/find?q=claim');
});
