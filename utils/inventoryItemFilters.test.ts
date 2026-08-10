import { describe, expect, it } from 'vitest';
import type { Medicine } from '../types';
import { filterInventoryItems, getInventoryCategoryOptions, getInventoryItemTypeOptions } from './inventoryItemFilters';

const item = (overrides: Partial<Medicine>): Medicine => ({
  id: 'item-1', location_id: 'location-1', name: 'Mouth Wash', description: 'Fresh rinse',
  unit: 'bottle', item_type: 'Retail', price: 10, stock: 5, category: 'Oral Care', ...overrides
});

describe('inventory item filters', () => {
  it.each([
    ['name', 'mouth'], ['description', 'fresh'], ['category', 'oral'], ['item type', 'retail'], ['unit', 'bottle']
  ])('searches by %s case-insensitively', (_field, query) => {
    expect(filterInventoryItems([item({})], { searchTerm: query.toUpperCase(), itemType: 'all', category: '' })).toHaveLength(1);
  });

  it('combines item type and category and excludes out-of-stock items', () => {
    const items = [
      item({ id: 'match' }),
      item({ id: 'wrong-type', item_type: 'Medicine' }),
      item({ id: 'wrong-category', category: 'General' }),
      item({ id: 'empty', stock: 0 })
    ];
    expect(filterInventoryItems(items, { searchTerm: '', itemType: 'Retail', category: 'Oral Care' }).map((entry) => entry.id)).toEqual(['match']);
  });

  it('provides ordered type and category options including uncategorized', () => {
    const items = [item({ item_type: 'Supply', category: 'Zeta' }), item({ id: '2', item_type: 'Medicine', category: 'Alpha' }), item({ id: '3', category: '' })];
    expect(getInventoryItemTypeOptions(items)).toEqual(['Medicine', 'Retail', 'Supply']);
    expect(getInventoryCategoryOptions(items)).toEqual({ categories: ['Alpha', 'Zeta'], hasUncategorized: true });
  });

  it('can isolate uncategorized items', () => {
    expect(filterInventoryItems([item({ id: 'named' }), item({ id: 'none', category: '' })], {
      searchTerm: '', itemType: 'all', category: null
    }).map((entry) => entry.id)).toEqual(['none']);
  });

  it('does not confuse a real sentinel-like category with uncategorized items', () => {
    const unusualCategory = '__uncategorized__';
    expect(filterInventoryItems([item({ id: 'named', category: unusualCategory }), item({ id: 'none', category: '' })], {
      searchTerm: '', itemType: 'all', category: unusualCategory
    }).map((entry) => entry.id)).toEqual(['named']);
  });
});