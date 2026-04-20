// Utility functions for generating and managing colors for specialty categories

// Predefined color palette for consistent color assignment
const COLOR_PALETTE = [
  'bg-red-50 text-red-700 border-red-100',
  'bg-green-50 text-green-700 border-green-100',
  'bg-blue-50 text-blue-700 border-blue-100',
  'bg-yellow-50 text-yellow-700 border-yellow-100',
  'bg-purple-50 text-purple-700 border-purple-100',
  'bg-pink-50 text-pink-700 border-pink-100',
  'bg-indigo-50 text-indigo-700 border-indigo-100',
  'bg-orange-50 text-orange-700 border-orange-100',
  'bg-teal-50 text-teal-700 border-teal-100',
  'bg-gray-50 text-gray-700 border-gray-100',
  'bg-lime-50 text-lime-700 border-lime-100',
  'bg-cyan-50 text-cyan-700 border-cyan-100',
];

/**
 * Generates a consistent color class for a given category string
 * Same category will always return the same color
 * @param category The category string
 * @returns Tailwind CSS class string for styling
 */
export const getColorForCategory = (category: string): string => {
  if (!category) return 'bg-gray-50 text-gray-700 border-gray-100'; // Default for undefined/null/empty
  
  // Normalize the category string to lowercase for consistency
  const normalizedCategory = category.toLowerCase().trim();
  
  // Special handling for common categories
  if (normalizedCategory === 'surgery') return 'bg-red-50 text-red-700 border-red-100';
  if (normalizedCategory === 'preventative' || normalizedCategory === 'preventive') return 'bg-green-50 text-green-700 border-green-100';
  
  // Calculate hash of the category to consistently map to the same color
  let hash = 0;
  for (let i = 0; i < normalizedCategory.length; i++) {
    hash = ((hash << 5) - hash + normalizedCategory.charCodeAt(i)) & 0xffffffff;
  }
  
  // Use the hash to select a color from the palette
  const colorIndex = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex];
};

/**
 * Generates a random color class (used for migration purposes)
 * @returns Tailwind CSS class string for styling
 */
export const getRandomColor = (): string => {
  const randomIndex = Math.floor(Math.random() * COLOR_PALETTE.length);
  return COLOR_PALETTE[randomIndex];
};