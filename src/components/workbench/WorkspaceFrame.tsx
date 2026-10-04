import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from 'react';

const WorkspaceLayout = createContext<{
  main: HTMLElement | null;
  footer: HTMLElement | null;
  scroll: HTMLElement | null;
}>({ main: null, footer: null, scroll: null });

export function WorkspaceFrame({
  children,
  footer,
  header,
  ...props
}: ComponentProps<'main'> & { footer: ReactNode; header?: ReactNode }) {
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [footerElement, setFooter] = useState<HTMLElement | null>(null);
  const [scroll, setScroll] = useState<HTMLElement | null>(null);
  return (
    <WorkspaceLayout.Provider value={{ main, footer: footerElement, scroll }}>
      <div
        className="workspace-scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto"
        ref={setScroll}
      >
        {header}
        <main
          className="container mx-auto px-4 py-8 flex-1"
          {...props}
          ref={setMain}
        >
          {children}
        </main>
      </div>
      <footer className="workspace-footer" ref={setFooter}>
        {footer}
      </footer>
    </WorkspaceLayout.Provider>
  );
}
export const useWorkspaceLayout = () => useContext(WorkspaceLayout);
