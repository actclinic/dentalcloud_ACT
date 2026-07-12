declare module 'framer-motion' {
  import type * as React from 'react';

  type MotionElementProps<T extends HTMLElement | SVGElement = HTMLElement> = import('react').HTMLAttributes<T> &
    import('react').SVGAttributes<T> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      whileHover?: unknown;
      whileTap?: unknown;
      whileInView?: unknown;
      viewport?: unknown;
      variants?: unknown;
      custom?: unknown;
      layout?: unknown;
    };

  type MotionComponent<T extends HTMLElement | SVGElement = HTMLElement> = React.FC<React.PropsWithChildren<MotionElementProps<T>>>;

  export const motion: {
    div: MotionComponent<HTMLDivElement>;
    span: MotionComponent<HTMLSpanElement>;
    button: MotionComponent<HTMLButtonElement>;
    svg: MotionComponent<SVGSVGElement>;
    path: MotionComponent<SVGPathElement>;
  };

  export const AnimatePresence: React.FC<React.PropsWithChildren<{
    initial?: boolean;
    mode?: 'sync' | 'popLayout' | 'wait';
    onExitComplete?: () => void;
  }>>;
}

declare module 'jspdf' {
  interface jsPDFTextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
  }

  class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string);
    internal: {
      pageSize: {
        width: number;
        height: number;
      };
      getNumberOfPages(): number;
    };
    getNumberOfPages(): number;
    setFontSize(size: number): this;
    setTextColor(r: number, g?: number, b?: number): this;
    text(text: string | string[], x: number, y: number, options?: jsPDFTextOptions): this;
    addPage(): this;
    setPage(pageNumber: number): this;
    save(filename: string): void;
  }

  export default jsPDF;
}
