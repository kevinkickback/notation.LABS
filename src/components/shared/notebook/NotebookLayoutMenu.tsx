import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  SidebarSimpleIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { useNotebookPlacement } from '@/hooks/useNotebookPlacement';
import { useNotebookWorkspace } from './NotebookWorkspace';

export function NotebookLayoutMenu({
  placement,
}: {
  placement: ReturnType<typeof useNotebookPlacement>;
}) {
  const workspace = useNotebookWorkspace();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="notebook-panel-icon"
          aria-label="Notebook layout"
          title="Notebook layout"
        >
          <SidebarSimpleIcon size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="notebook-layout-menu"
        align="end"
        portalContainer={workspace?.workspace}
        onCloseAutoFocus={(event) => {
          // Radix restores focus after unmount; honor a newer interaction.
          const active = document.activeElement;
          if (
            active !== document.body &&
            (!(event.target instanceof HTMLElement) ||
              !event.target.contains(active))
          )
            event.preventDefault();
        }}
      >
        {(['floating', 'left', 'right'] as const).map((layout) => (
          <DropdownMenuItem
            key={layout}
            onSelect={() => {
              void placement.setLayout(layout);
            }}
            aria-current={placement.layout === layout ? 'true' : undefined}
          >
            {layout === 'left' ? (
              <ArrowLeftIcon size={16} />
            ) : layout === 'right' ? (
              <ArrowRightIcon size={16} />
            ) : (
              <ArrowSquareOutIcon size={16} />
            )}
            {layout === 'floating' ? 'Floating' : `Dock ${layout}`}
            {placement.layout === layout && (
              <CheckIcon size={14} className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
