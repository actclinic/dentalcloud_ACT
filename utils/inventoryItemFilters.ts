import type { Medicine } from '../types';

export type InventoryItemTypeFilter = 'all' | NonNullable<Medicine['item_type']>;

export interface InventoryItemFilterState {
  searchTerm: string;
  itemType: InventoryItemTypeFilter;
  category: string | null | undefined;
}

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

export const getInventoryItemTypeOptions = (items: Medicine[]): NonNullable<Medicine['item_type']>[] => {
  const present = new Set(items.map((item) => item.item_type || 'Medicine'));
  return (['Medicine', 'Retail', 'Supply', 'Other'] as const).filter((type) => present.has(type));
};

export const getInventoryCategoryOptions = (items: Medicine[]): { categories: string[]; hasUncategorized: boolean } => {
  const categories = Array.from(new Set(items.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right));
  return { categories, hasUncategorized: items.some((item) => !item.category?.trim()) };
};

export const filterInventoryItems = (
  items: Medicine[],
  filters: InventoryItemFilterState
): Medicine[] => {
  const query = normalize(filters.searchTerm);
  return items.filter((item) => {
    if (Number(item.stock || 0) <= 0) return false;
    if (filters.itemType !== 'all' && (item.item_type || 'Medicine') !== filters.itemType) return false;
    const category = item.category?.trim() || '';
    if (filters.category === null && category) return false;
    if (typeof filters.category === 'string' && filters.category && category !== filters.category) return false;
    if (!query) return true;
    return [item.name, item.description, category, item.item_type || 'Medicine', item.unit]
      .some((value) => normalize(value).includes(query));
  });
};