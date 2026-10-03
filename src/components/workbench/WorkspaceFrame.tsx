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
}>({ main: null, footer: null });

export function WorkspaceFrame({
  children,
  footer,
  ...props
}: ComponentProps<'main'> & { footer: ReactNode }) {
  const [main, setMain] = useState<HTMLElement | null>(null);
  const [footerElement, setFooter] = useState<HTMLElement | null>(null);
  return (
    <WorkspaceLayout.Provider value={{ main, footer: footerElement }}>
      <main
        className="container mx-auto px-4 py-8 flex-1"
        {...props}
        ref={setMain}
      >
        {children}
      </main>
      <footer className="workspace-footer" ref={setFooter}>
        {footer}
      </footer>
    </WorkspaceLayout.Provider>
  );
}
export const useWorkspaceLayout = () => useContext(WorkspaceLayout);
