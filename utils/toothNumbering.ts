/**
 * Centralized Tooth Numbering Utility
 * 
 * Implements ISO 3950 (FDI World Dental Federation notation) standard
 * alongside Universal (ADA) numbering system.
 * 
 * ISO 3950 Standard:
 * - Permanent teeth: 11-48 (2-digit system: quadrant + tooth)
 * - Primary teeth: 51-85 (quadrants 5-8, teeth 1-5)
 * - Primary display labels: 1A-1E, 2A-2E, 3A-3E, 4A-4E
 * 
 * Universal System (US only):
 * - Permanent teeth: 1-32
 * - Primary teeth: Not officially standardized (sometimes A-T)
 * 
 * Storage Strategy:
 * - Database stores FDI/ISO numbers (11-48, 51-85) for international compliance
 * - UI preserves the existing permanent-tooth display and shows primary teeth
 *   as quadrant + letter labels (for example, 51 -> 1A)
 * - All conversions go through this utility to ensure consistency
 */

// ============================================================
// TOOTH NUMBER RANGES
// ============================================================

export const TOOTH_RANGES = {
  // FDI/ISO Permanent: Quadrant (1-4) + Tooth (1-8)
  FDI_PERMANENT: {
    quadrant1: { range: [11, 18] as [number, number], label: 'Upper Right' },
    quadrant2: { range: [21, 28] as [number, number], label: 'Upper Left' },
    quadrant3: { range: [31, 38] as [number, number], label: 'Lower Left' },
    quadrant4: { range: [41, 48] as [number, number], label: 'Lower Right' },
  },
  // FDI/ISO Primary: Quadrant (5-8) + Tooth (1-5)
  FDI_PRIMARY: {
    quadrant5: { range: [51, 55] as [number, number], label: 'Upper Right (Primary)' },
    quadrant6: { range: [61, 65] as [number, number], label: 'Upper Left (Primary)' },
    quadrant7: { range: [71, 75] as [number, number], label: 'Lower Left (Primary)' },
    quadrant8: { range: [81, 85] as [number, number], label: 'Lower Right (Primary)' },
  },
  // Universal Permanent: 1-32
  UNIVERSAL_PERMANENT: { range: [1, 32] as [number, number] },
} as const;

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Check if a tooth number is valid FDI/ISO permanent (11-48)
 */
export const isValidFDIPermanent = (tooth: number): boolean => {
  if (tooth < 11 || tooth > 48) return false;
  const quadrant = Math.floor(tooth / 10);
  const toothInQuadrant = tooth % 10;
  
  // Valid quadrants: 1-4
  if (quadrant < 1 || quadrant > 4) return false;
  
  // Valid tooth positions: 1-8
  if (toothInQuadrant < 1 || toothInQuadrant > 8) return false;
  
  return true;
};

/**
 * Check if a tooth number is valid FDI/ISO primary (51-85)
 */
export const isValidFDIPrimary = (tooth: number): boolean => {
  if (tooth < 51 || tooth > 85) return false;
  const quadrant = Math.floor(tooth / 10);
  const toothInQuadrant = tooth % 10;
  
  // Valid quadrants: 5-8
  if (quadrant < 5 || quadrant > 8) return false;
  
  // Valid tooth positions: 1-5
  if (toothInQuadrant < 1 || toothInQuadrant > 5) return false;
  
  return true;
};

/**
 * Check if a tooth number is valid Universal permanent (1-32)
 */
export const isValidUniversalPermanent = (tooth: number): boolean => {
  return tooth >= 1 && tooth <= 32;
};

/**
 * Check if a tooth number is valid in ANY system
 */
export const isValidToothNumber = (tooth: number): boolean => {
  return isValidFDIPermanent(tooth) || 
         isValidFDIPrimary(tooth) || 
         isValidUniversalPermanent(tooth);
};

/**
 * Validate an array of tooth numbers, return invalid ones
 */
export const findInvalidTeeth = (teeth: number[]): number[] => {
  return teeth.filter(t => !isValidToothNumber(t));
};

// ============================================================
// CONVERSION FUNCTIONS
// ============================================================

/**
 * Convert an FDI primary tooth number to the clinic's primary display label.
 *
 * 51-55 -> 1A-1E
 * 61-65 -> 2A-2E
 * 71-75 -> 3A-3E
 * 81-85 -> 4A-4E
 */
export const fdiPrimaryToDisplayLabel = (tooth: number): string | null => {
  if (!isValidFDIPrimary(tooth)) return null;

  const displayQuadrant = Math.floor(tooth / 10) - 4;
  const toothLetter = String.fromCharCode('A'.charCodeAt(0) + (tooth % 10) - 1);
  return `${displayQuadrant}${toothLetter}`;
};

/**
 * Parse either a stored numeric tooth number or a primary display label.
 * Returns the canonical numeric value used by the database and APIs.
 */
export const parseToothDisplayLabel = (value: string | number): number | null => {
  const normalized = String(value).trim().toUpperCase();
  const primaryMatch = normalized.match(/^([1-4])([A-E])$/);

  if (primaryMatch) {
    const storedQuadrant = Number(primaryMatch[1]) + 4;
    const toothInQuadrant = primaryMatch[2].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    return storedQuadrant * 10 + toothInQuadrant;
  }

  if (!/^\d+$/.test(normalized)) return null;
  const numericTooth = Number(normalized);
  return isValidToothNumber(numericTooth) ? numericTooth : null;
};

export interface ParsedTeethInput {
  teeth: number[];
  invalidLabels: string[];
}

/**
 * Parse staff-entered tooth labels from arrays or comma/space-separated text.
 * Baby teeth use 1A-4E. Numeric 51-85 values remain readable for legacy data
 * and integrations, but all staff-facing formatting uses the new labels.
 */
export const parseTeethInput = (value: unknown): ParsedTeethInput => {
  const tokens = Array.isArray(value)
    ? value.flatMap((item) => String(item).split(/[,\s]+/))
    : String(value ?? '').split(/[,\s]+/);

  const teeth: number[] = [];
  const invalidLabels: string[] = [];

  tokens
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      const parsed = parseToothDisplayLabel(token);
      if (parsed === null) {
        invalidLabels.push(token);
      } else {
        teeth.push(parsed);
      }
    });

  return {
    teeth: Array.from(new Set(teeth)).sort((a, b) => a - b),
    invalidLabels: Array.from(new Set(invalidLabels))
  };
};

/**
 * Convert Universal (1-32) to FDI/ISO (11-48)
 * 
 * Mapping logic:
 * Universal 1-8 (Upper Right, 3rd molar to central) → FDI 18-11
 * Universal 9-16 (Upper Left, central to 3rd molar) → FDI 21-28
 * Universal 17-24 (Lower Left, 3rd molar to central) → FDI 38-31
 * Universal 25-32 (Lower Right, central to 3rd molar) → FDI 41-48
 */
export const universalToFDI = (universal: number): number => {
  if (!isValidUniversalPermanent(universal)) {
    // If it's already FDI or primary, return as-is
    if (isValidFDIPermanent(universal) || isValidFDIPrimary(universal)) {
      return universal;
    }
    throw new Error(`Invalid Universal tooth number: ${universal}. Must be 1-32.`);
  }
  
  // Upper Right: 1-8 → 18-11 (reverse order)
  if (universal >= 1 && universal <= 8) {
    return 19 - universal;
  }
  
  // Upper Left: 9-16 → 21-28
  if (universal >= 9 && universal <= 16) {
    return universal + 12;
  }
  
  // Lower Left: 17-24 → 38-31 (reverse order)
  if (universal >= 17 && universal <= 24) {
    return 55 - universal;
  }
  
  // Lower Right: 25-32 → 41-48
  if (universal >= 25 && universal <= 32) {
    return universal + 16;
  }
  
  throw new Error(`Conversion failed for Universal tooth: ${universal}`);
};

/**
 * Convert FDI/ISO (11-48, 51-85) to Universal (1-32)
 * 
 * For primary teeth (51-85), returns the same number since
 * Universal doesn't have a standardized primary system.
 */
export const fdiToUniversal = (fdi: number): number => {
  // If already Universal, return as-is
  if (isValidUniversalPermanent(fdi)) {
    return fdi;
  }
  
  // Primary teeth: return as-is (Universal doesn't standardize primary)
  if (isValidFDIPrimary(fdi)) {
    return fdi;
  }
  
  if (!isValidFDIPermanent(fdi)) {
    throw new Error(`Invalid tooth label: ${fdi}. Use adult FDI numbers or baby labels 1A-4E.`);
  }
  
  const quadrant = Math.floor(fdi / 10);
  const toothInQuadrant = fdi % 10;
  
  // Quadrant 1 (Upper Right): 11-18 → 8-1
  if (quadrant === 1) {
    return 19 - fdi;
  }
  
  // Quadrant 2 (Upper Left): 21-28 → 9-16
  if (quadrant === 2) {
    return fdi - 12;
  }
  
  // Quadrant 3 (Lower Left): 31-38 → 24-17
  if (quadrant === 3) {
    return 55 - fdi;
  }
  
  // Quadrant 4 (Lower Right): 41-48 → 25-32
  if (quadrant === 4) {
    return fdi - 16;
  }
  
  throw new Error(`Conversion failed for FDI tooth: ${fdi}`);
};

/**
 * Convert tooth number to display format based on preference
 */
export const toDisplayFormat = (
  tooth: number, 
  displaySystem: 'FDI' | 'Universal' = 'FDI'
): number => {
  if (displaySystem === 'FDI') {
    // If Universal, convert to FDI; if already FDI/primary, return as-is
    if (isValidUniversalPermanent(tooth) && !isValidFDIPermanent(tooth)) {
      return universalToFDI(tooth);
    }
    return tooth;
  } else {
    // If FDI permanent, convert to Universal; if primary or already Universal, return as-is
    if (isValidFDIPermanent(tooth)) {
      return fdiToUniversal(tooth);
    }
    return tooth;
  }
};

// ============================================================
// POSITION & ANATOMY FUNCTIONS
// ============================================================

/**
 * Get the anatomical position/region of a tooth
 */
export const getToothPosition = (tooth: number): string => {
  // FDI Permanent
  if (isValidFDIPermanent(tooth)) {
    const quadrant = Math.floor(tooth / 10);
    const positions: Record<number, string> = {
      1: 'Upper Right',
      2: 'Upper Left',
      3: 'Lower Left',
      4: 'Lower Right',
    };
    return positions[quadrant] || 'Unknown';
  }
  
  // FDI Primary
  if (isValidFDIPrimary(tooth)) {
    const quadrant = Math.floor(tooth / 10);
    const positions: Record<number, string> = {
      5: 'Upper Right (Primary)',
      6: 'Upper Left (Primary)',
      7: 'Lower Left (Primary)',
      8: 'Lower Right (Primary)',
    };
    return positions[quadrant] || 'Unknown';
  }
  
  // Universal Permanent
  if (isValidUniversalPermanent(tooth)) {
    if (tooth >= 1 && tooth <= 8) return 'Upper Right';
    if (tooth >= 9 && tooth <= 16) return 'Upper Left';
    if (tooth >= 17 && tooth <= 24) return 'Lower Left';
    if (tooth >= 25 && tooth <= 32) return 'Lower Right';
  }
  
  return 'Unknown Position';
};

/**
 * Get the quadrant label for a tooth
 */
export const getQuadrantLabel = (tooth: number): string => {
  if (isValidFDIPermanent(tooth) || isValidFDIPrimary(tooth)) {
    const quadrant = Math.floor(tooth / 10);
    const labels: Record<number, string> = {
      1: 'Q1 (UR)',
      2: 'Q2 (UL)',
      3: 'Q3 (LL)',
      4: 'Q4 (LR)',
      5: 'Q5 (UR-P)',
      6: 'Q6 (UL-P)',
      7: 'Q7 (LL-P)',
      8: 'Q8 (LR-P)',
    };
    return labels[quadrant] || 'Unknown';
  }
  
  if (isValidUniversalPermanent(tooth)) {
    if (tooth <= 8) return 'Q1 (UR)';
    if (tooth <= 16) return 'Q2 (UL)';
    if (tooth <= 24) return 'Q3 (LL)';
    return 'Q4 (LR)';
  }
  
  return 'Unknown';
};

/**
 * Get tooth type/name based on position in quadrant
 */
export const getToothType = (tooth: number): string => {
  let toothInQuadrant: number;
  
  if (isValidFDIPermanent(tooth) || isValidFDIPrimary(tooth)) {
    toothInQuadrant = tooth % 10;
  } else if (isValidUniversalPermanent(tooth)) {
    // Convert to FDI first to get position
    const fdi = universalToFDI(tooth);
    toothInQuadrant = fdi % 10;
  } else {
    return 'Unknown';
  }
  
  if (isValidFDIPrimary(tooth)) {
    const primaryTypes: Record<number, string> = {
      1: 'Central Incisor',
      2: 'Lateral Incisor',
      3: 'Canine',
      4: 'First Molar',
      5: 'Second Molar',
    };
    return primaryTypes[toothInQuadrant] || 'Unknown';
  }

  const permanentTypes: Record<number, string> = {
    1: 'Central Incisor',
    2: 'Lateral Incisor',
    3: 'Canine',
    4: 'First Premolar',
    5: 'Second Premolar',
    6: 'First Molar',
    7: 'Second Molar',
    8: 'Third Molar (Wisdom)',
  };
  
  return permanentTypes[toothInQuadrant] || 'Unknown';
};

// ============================================================
// FORMATTING FUNCTIONS
// ============================================================

/**
 * Format a single tooth number for display
 */
export const formatTooth = (
  tooth: number, 
  displaySystem: 'FDI' | 'Universal' = 'FDI'
): string => {
  const primaryLabel = fdiPrimaryToDisplayLabel(tooth);
  if (primaryLabel) return primaryLabel;

  const display = toDisplayFormat(tooth, displaySystem);
  return display.toString();
};

/**
 * Format an array of tooth numbers for display
 */
export const formatTeethArray = (
  teeth: number[], 
  displaySystem: 'FDI' | 'Universal' = 'FDI'
): string => {
  if (!teeth || teeth.length === 0) return 'General';
  return teeth.map(t => formatTooth(t, displaySystem)).join(', ');
};

/**
 * Format teeth with position information for clinical records
 */
export const formatTeethWithPosition = (
  teeth: number[], 
  displaySystem: 'FDI' | 'Universal' = 'FDI'
): string => {
  if (!teeth || teeth.length === 0) return 'General';
  
  return teeth.map(tooth => {
    const display = formatTooth(tooth, displaySystem);
    const position = getToothPosition(tooth);
    return `${display} (${position})`;
  }).join(', ');
};

/**
 * Format teeth with tooth type for detailed clinical display
 */
export const formatTeethWithType = (
  teeth: number[], 
  displaySystem: 'FDI' | 'Universal' = 'FDI'
): string => {
  if (!teeth || teeth.length === 0) return 'General';
  
  return teeth.map(tooth => {
    const display = formatTooth(tooth, displaySystem);
    const type = getToothType(tooth);
    const position = getToothPosition(tooth);
    return `${display} - ${type} (${position})`;
  }).join(', ');
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Normalize tooth number to FDI/ISO for database storage
 * Accepts Universal (1-32), FDI permanent (11-48), or FDI primary (51-85)
 * Returns FDI/ISO number
 */
export const normalizeToFDI = (tooth: number): number => {
  if (isValidFDIPermanent(tooth) || isValidFDIPrimary(tooth)) {
    return tooth; // Already FDI
  }
  if (isValidUniversalPermanent(tooth)) {
    return universalToFDI(tooth); // Convert Universal to FDI
  }
  throw new Error(`Invalid tooth label: ${tooth}. Use adult FDI numbers or baby labels 1A-4E.`);
};

/**
 * Normalize tooth number to Universal for legacy compatibility
 * Accepts FDI (11-48, 51-85) or Universal (1-32)
 * Returns Universal (1-32) for permanent, or original for primary
 */
export const normalizeToUniversal = (tooth: number): number => {
  if (isValidUniversalPermanent(tooth)) {
    return tooth; // Already Universal
  }
  if (isValidFDIPermanent(tooth)) {
    return fdiToUniversal(tooth); // Convert FDI permanent to Universal
  }
  if (isValidFDIPrimary(tooth)) {
    return tooth; // Primary teeth stay as FDI (Universal doesn't standardize primary)
  }
  throw new Error(`Invalid tooth label: ${tooth}. Use adult FDI numbers or baby labels 1A-4E.`);
};

/**
 * Check if a tooth number represents a primary (baby) tooth
 */
export const isPrimaryTooth = (tooth: number): boolean => {
  return isValidFDIPrimary(tooth);
};

/**
 * Check if a tooth number represents a permanent tooth
 */
export const isPermanentTooth = (tooth: number): boolean => {
  return isValidFDIPermanent(tooth) || 
         (isValidUniversalPermanent(tooth) && !isValidFDIPrimary(tooth));
};

/**
 * Get all teeth in a quadrant (FDI system)
 */
export const getTeethInQuadrant = (quadrant: number, primary: boolean = false): number[] => {
  if (primary) {
    if (quadrant < 5 || quadrant > 8) return [];
    const start = quadrant * 10 + 1;
    return Array.from({ length: 5 }, (_, i) => start + i);
  } else {
    if (quadrant < 1 || quadrant > 4) return [];
    const start = quadrant * 10 + 1;
    return Array.from({ length: 8 }, (_, i) => start + i);
  }
};

/**
 * Get canonical tooth number (FDI/ISO standard)
 * This ensures all tooth numbers are in the ISO 3950 format
 */
export const getCanonicalToothNumber = (tooth: number): number => {
  return normalizeToFDI(tooth);
};
