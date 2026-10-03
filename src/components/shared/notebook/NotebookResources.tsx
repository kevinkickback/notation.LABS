import {
  ArrowSquareOutIcon,
  LinkSimpleIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getResourceDomain,
  type NotebookEditor,
} from '@/hooks/useNotebookEditor';
import { externalHttpsUrlSchema } from '@/lib/schemas';
import type { CharacterLink } from '@/lib/types';

function ResourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let source: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      source = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
  } catch {
    // Keep the resource usable if an older link has an invalid URL.
  }
  return (
    <span className="notebook-resource-favicon" aria-hidden="true">
      {source && !failed ? (
        <img
          src={source}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinkSimpleIcon size={20} />
      )}
    </span>
  );
}

export function NotebookResources({
  editor,
  links,
}: {
  editor: NotebookEditor['resources'];
  links: CharacterLink[];
}) {
  const {
    resourceDraft,
    resourceActionRef,
    openResourceEditor,
    savingResource,
    resourceEditorRef,
    saveResource,
    urlId,
    focusResourceInput,
    setResourceDraft,
    setUrlError,
    urlError,
    errorId,
    labelId,
    finishResourceEditing,
    removeResource,
  } = editor;
  const resourceAction = !resourceDraft && (
    <Button
      ref={resourceActionRef}
      type="button"
      variant="outline"
      size="sm"
      className="notebook-resource-action"
      onClick={() => openResourceEditor()}
      disabled={savingResource}
      aria-label="Add resource link"
    >
      <PlusIcon size={16} />
      Add
    </Button>
  );

  return (
    <section className="notebook-resources" aria-label="Resources">
      {links.length > 0 && resourceAction && (
        <div className="notebook-resource-tools">{resourceAction}</div>
      )}
      {resourceDraft && (
        <form
          ref={resourceEditorRef}
          className="notebook-resource-editor"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void saveResource();
          }}
        >
          <div>
            <Label htmlFor={urlId}>URL</Label>
            <Input
              ref={focusResourceInput}
              id={urlId}
              type="url"
              placeholder="https://dustloop.com/…"
              value={resourceDraft.url}
              onChange={(event) => {
                setResourceDraft({ ...resourceDraft, url: event.target.value });
                setUrlError(null);
              }}
              disabled={savingResource}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? errorId : undefined}
            />
          </div>
          {urlError && (
            <p id={errorId} role="alert" className="notebook-url-error">
              {urlError}
            </p>
          )}
          <div>
            <Label htmlFor={labelId}>
              Label <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={labelId}
              placeholder="Dustloop Wiki"
              value={resourceDraft.label}
              onChange={(event) =>
                setResourceDraft({
                  ...resourceDraft,
                  label: event.target.value,
                })
              }
              disabled={savingResource}
            />
          </div>
          <div className="notebook-resource-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => finishResourceEditing()}
              disabled={savingResource}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingResource || !resourceDraft.url.trim()}
              aria-label={resourceDraft.id ? 'Save resource' : 'Add resource'}
            >
              {savingResource ? 'Saving…' : resourceDraft.id ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      )}
      {links.length ? (
        <ul className="notebook-resource-list">
          {links.map((link) => {
            const canOpen = externalHttpsUrlSchema.safeParse(link.url).success;
            return (
              <li key={link.id}>
                <a
                  href={canOpen ? link.url : undefined}
                  aria-disabled={!canOpen || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (!canOpen) {
                      event.preventDefault();
                      toast.error(
                        'This saved resource uses HTTP. Edit it to use HTTPS before opening.',
                      );
                    }
                  }}
                  aria-label={`Open ${link.label} in a new tab`}
                >
                  <ResourceFavicon key={link.url} url={link.url} />
                  <span className="notebook-resource-label">
                    <strong>{link.label}</strong>
                    <small>
                      {getResourceDomain(link.url)}
                      {!canOpen && ' · Edit to use HTTPS'}
                    </small>
                  </span>
                  <ArrowSquareOutIcon size={14} />
                </a>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${link.label}`}
                    onClick={() => openResourceEditor(link)}
                    disabled={Boolean(resourceDraft) || savingResource}
                  >
                    <PencilSimpleIcon size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="notebook-remove-resource"
                    aria-label={`Remove ${link.label}`}
                    onClick={() => void removeResource(link.id)}
                    disabled={Boolean(resourceDraft) || savingResource}
                  >
                    <TrashIcon size={16} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !resourceDraft && (
          <div className="notebook-empty-state">
            <LinkSimpleIcon size={24} weight="light" />
            <p>Nothing saved yet.</p>
            <span>Save guides, frame data, and videos for this character.</span>
            {resourceAction}
          </div>
        )
      )}
    </section>
  );
}
