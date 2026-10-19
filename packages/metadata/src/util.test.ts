import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyAnime, slugify } from './util';

test('slugify normalises titles', () => {
  assert.equal(slugify('Attack on Titan: Final Season'), 'attack-on-titan-final-season');
  assert.equal(slugify('Él Camino'), 'el-camino');
  assert.equal(slugify('!!!'), 'untitled');
});

test('classifyAnime requires animation and East Asian origin', () => {
  assert.equal(classifyAnime({ genreIds: [16], originCountries: ['JP'], originalLanguage: 'ja' }), true);
  assert.equal(classifyAnime({ genreIds: [16], originCountries: ['US'], originalLanguage: 'en' }), false);
  assert.equal(classifyAnime({ genreIds: [18], originCountries: ['JP'], originalLanguage: 'ja' }), false);
  assert.equal(classifyAnime({ genreIds: [18], originCountries: ['US'], originalLanguage: 'en', keywordIds: [210024] }), true);
  // Donghua such as Link Click (Chinese origin) count as anime.
  assert.equal(classifyAnime({ genreIds: [16, 18], originCountries: ['CN'], originalLanguage: 'zh' }), true);
  assert.equal(classifyAnime({ genreIds: [16], originCountries: [], originalLanguage: 'zh' }), true);
  // Movie search results carry no origin country; language alone decides.
  assert.equal(classifyAnime({ genreIds: [16, 28], originCountries: [], originalLanguage: 'ja' }), true);
  assert.equal(classifyAnime({ genreIds: [16], originCountries: ['FR'], originalLanguage: 'fr' }), false);
});
