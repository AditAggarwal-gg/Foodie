import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractQuantity,
  extractSize,
  itemPrice,
  cartKey,
  buildAliasIndex,
  extractGlobalMentions,
  resolveMentionSync,
  buildCatalogForLLM,
} from '../public/js/matching.js';

// Small fixture mirroring the real catalog shape closely enough to exercise
// every code path: a cross-restaurant dish collision, a veg/non-veg substring
// collision, and a sized item.
const RESTAURANTS = [
  {
    id: 'milan', name: 'Milan', menu: [
      { id: 'milan_kadhai_paneer', name: 'Kadhai Paneer', price: 240, veg: true, aliases: ['kadhai paneer', 'kadai paneer', 'karahi paneer'] },
    ],
  },
  {
    id: 'aashirwaad', name: 'Aashirwaad', menu: [
      { id: 'aash_kadhai_paneer', name: 'Kadhai Paneer', price: 230, veg: true, aliases: ['kadhai paneer', 'kadai paneer', 'karahi paneer'] },
    ],
  },
  {
    id: 'burgerclub', name: 'Burger Club', menu: [
      { id: 'bc_veg_basic', name: 'Veg Burger Basic', price: 99, veg: true, aliases: ['veg burger basic', 'veg burger'] },
      { id: 'bc_nonveg_basic', name: 'Non-Veg Burger Basic', price: 139, veg: false, aliases: ['non veg burger basic', 'non veg burger', 'nonveg burger'] },
      { id: 'bc_fries', name: 'Fries', veg: true, hasSize: true, sizePrices: { S: 99, M: 129, L: 159 }, aliases: ['fries', 'french fries'] },
    ],
  },
];

describe('extractQuantity', () => {
  test('parses digit quantities', () => {
    assert.equal(extractQuantity('add 3'), 3);
  });

  test('parses number words', () => {
    assert.equal(extractQuantity('add two'), 2);
  });

  test('resolves quantity homophones from speech recognition', () => {
    assert.equal(extractQuantity('add to'), 2);
    assert.equal(extractQuantity('add too'), 2);
    assert.equal(extractQuantity('add for'), null);
  });

  test('returns null when no quantity word precedes', () => {
    assert.equal(extractQuantity('please'), null);
  });

  test('returns null for empty input', () => {
    assert.equal(extractQuantity(''), null);
    assert.equal(extractQuantity('   '), null);
  });
});

describe('extractSize', () => {
  test('detects large/small/medium keywords', () => {
    assert.equal(extractSize('a large fries'), 'L');
    assert.equal(extractSize('small coke'), 'S');
    assert.equal(extractSize('medium fries'), 'M');
  });

  test('returns null when no size keyword present', () => {
    assert.equal(extractSize('add fries'), null);
  });
});

describe('itemPrice / cartKey', () => {
  test('itemPrice returns flat price for non-sized items', () => {
    const item = RESTAURANTS[0].menu[0];
    assert.equal(itemPrice(item, null), 240);
  });

  test('itemPrice returns size-specific price, defaulting to M', () => {
    const fries = RESTAURANTS[2].menu[2];
    assert.equal(itemPrice(fries, 'L'), 159);
    assert.equal(itemPrice(fries, null), 129);
  });

  test('cartKey is stable for non-sized items and size-qualified for sized items', () => {
    const paneer = RESTAURANTS[0].menu[0];
    const fries = RESTAURANTS[2].menu[2];
    assert.equal(cartKey(paneer, 'M'), 'milan_kadhai_paneer');
    assert.equal(cartKey(fries, 'L'), 'bc_fries::L');
    assert.equal(cartKey(fries, null), 'bc_fries::M');
  });
});

describe('buildAliasIndex + extractGlobalMentions', () => {
  test('THE SUBSTRING COLLISION BUG: a veg-only alias must not match inside "non veg <alias>"', () => {
    const fixture = [
      { id: 'x', name: 'X', menu: [
        { id: 'veg_burger', name: 'Veg Burger', veg: true, aliases: ['veg burger'] },
        { id: 'chicken_burger', name: 'Chicken Burger', veg: false, aliases: ['chicken burger'] },
      ]},
    ];
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(fixture);
    const mentions = extractGlobalMentions('add a non veg burger', aliasIndex, aliasKeysSorted);
    assert.equal(mentions.length, 0, 'should NOT falsely match the veg item when "non" precedes it');
  });

  test('when the exact alias "non veg burger" IS registered, it matches correctly (not the shorter "veg burger")', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add a non veg burger', aliasIndex, aliasKeysSorted);
    assert.equal(mentions.length, 1, 'should produce exactly one mention, not two');
    assert.equal(mentions[0].alias, 'non veg burger');
  });

  test('plain "veg burger" (no "non" prefix) still matches normally', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add a veg burger', aliasIndex, aliasKeysSorted);
    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].alias, 'veg burger');
  });

  test('a dish on multiple restaurants produces multiple candidate matches', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add kadhai paneer', aliasIndex, aliasKeysSorted);
    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].matches.length, 2, 'kadhai paneer is on 2 menus in the fixture');
  });

  test('quantity is picked up from the word immediately before the item', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add three fries', aliasIndex, aliasKeysSorted);
    assert.equal(mentions[0].qty, 3);
  });

  test('self-correction: later quantity in the sentence wins for that mention', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('no wait three veg burger', aliasIndex, aliasKeysSorted);
    assert.equal(mentions[0].qty, 3);
  });

  test('no match returns an empty array, not an error', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('play some music', aliasIndex, aliasKeysSorted);
    assert.deepEqual(mentions, []);
  });
});

describe('resolveMentionSync — disambiguation logic', () => {
  test('single-match mentions resolve directly with no context needed', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add fries', aliasIndex, aliasKeysSorted);
    const resolved = resolveMentionSync(mentions[0], null, { type: 'list' });
    assert.equal(resolved.restaurant.id, 'burgerclub');
  });

  test('ambiguous mention with no cart/view context returns null (needs the modal)', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add kadhai paneer', aliasIndex, aliasKeysSorted);
    const resolved = resolveMentionSync(mentions[0], null, { type: 'list' });
    assert.equal(resolved, null);
  });

  test('ambiguous mention resolves using the active cart restaurant', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add kadhai paneer', aliasIndex, aliasKeysSorted);
    const resolved = resolveMentionSync(mentions[0], 'aashirwaad', { type: 'list' });
    assert.equal(resolved.restaurant.id, 'aashirwaad');
  });

  test('ambiguous mention resolves using the currently-open restaurant page when cart is empty', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add kadhai paneer', aliasIndex, aliasKeysSorted);
    const resolved = resolveMentionSync(mentions[0], null, { type: 'restaurant', id: 'milan' });
    assert.equal(resolved.restaurant.id, 'milan');
  });

  test('active cart restaurant takes priority over the currently-open restaurant page', () => {
    const { aliasIndex, aliasKeysSorted } = buildAliasIndex(RESTAURANTS);
    const mentions = extractGlobalMentions('add kadhai paneer', aliasIndex, aliasKeysSorted);
    const resolved = resolveMentionSync(mentions[0], 'aashirwaad', { type: 'restaurant', id: 'milan' });
    assert.equal(resolved.restaurant.id, 'aashirwaad', 'cart context should win over the open page');
  });
});

describe('buildCatalogForLLM', () => {
  test('flattens every restaurant\'s menu into a single array the LLM can consume', () => {
    const catalog = buildCatalogForLLM(RESTAURANTS);
    const totalItems = RESTAURANTS.reduce((sum, r) => sum + r.menu.length, 0);
    assert.equal(catalog.length, totalItems);
  });

  test('each catalog entry carries both item and restaurant identifiers', () => {
    const catalog = buildCatalogForLLM(RESTAURANTS);
    const entry = catalog.find(c => c.item_id === 'bc_fries');
    assert.deepEqual(entry, {
      item_id: 'bc_fries',
      item_name: 'Fries',
      restaurant_id: 'burgerclub',
      restaurant_name: 'Burger Club',
      veg: true,
      has_size: true,
    });
  });
});
