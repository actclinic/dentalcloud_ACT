declare module 'react-dom' {
  import type { ReactNode } from 'react';

  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactNode;
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}
