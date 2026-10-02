import { MagnifyingGlassIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCachedSearch } from '@/hooks/useCachedSearch';
import {
  downloadCharacterImage,
  searchCharacterImages,
} from '@/lib/providers/imageSearchProvider';
import type { ImageSearchResult } from '@/lib/types';

const getSearchErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Image search is unavailable. Try again.';

interface CharacterSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onImageSelect: (base64: string) => void;
}

export function CharacterSearchDialog({
  open,
  onOpenChange,
  searchQuery,
  onImageSelect,
}: CharacterSearchDialogProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const {
    query: inputValue,
    setQuery: setInputValue,
    results,
    loading,
    error,
    hasSearched,
    runSearch: handleSearch,
  } = useCachedSearch<ImageSearchResult>({
    open,
    initialQuery: searchQuery,
    search: searchCharacterImages,
    getErrorMessage: getSearchErrorMessage,
  });

  const handleImageSelect = async (result: ImageSearchResult) => {
    if (!result.imageUrl || downloading) return;
    setDownloading(result.imageUrl);
    try {
      const dataUrl = await downloadCharacterImage(result.imageUrl);
      if (dataUrl) {
        onImageSelect(dataUrl);
        toast.success('Image applied');
      } else {
        toast.error('Failed to download image');
      }
    } catch {
      toast.error('Failed to download image');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="search-dialog max-w-4xl flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Search Character Images</DialogTitle>
          <DialogDescription className="sr-only">
            Search and select an image to use as the character portrait.
          </DialogDescription>
        </DialogHeader>

        <div className="dialog-search-toolbar">
          <Input
            placeholder="Search for a character..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            aria-label="Character image search query"
          />
          <Button
            aria-label="Search character images"
            onClick={() => handleSearch()}
            disabled={loading || !inputValue.trim()}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            Search
          </Button>
        </div>

        <DialogBody>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <SpinnerGapIcon className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-sm text-destructive">
              <p>{error}</p>
              <p className="text-muted-foreground mt-1">
                Try a different search term or check your connection.
              </p>
            </div>
          )}

          {!loading && !error && hasSearched && results.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <p>No images found</p>
              <p className="mt-1">Try different search terms</p>
            </div>
          )}

          {!loading && !error && !hasSearched && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Search for a character to find images
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="dialog-image-results">
              {results.map((result) => {
                const isDownloading = downloading === result.imageUrl;
                return (
                  <button
                    key={result.imageUrl}
                    type="button"
                    className="relative rounded-lg border-2 border-border bg-muted overflow-hidden text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => handleImageSelect(result)}
                    disabled={!!downloading}
                    aria-label={`Select image: ${result.title}`}
                  >
                    <div className="aspect-square w-full flex items-center justify-center bg-muted">
                      <img
                        src={result.thumbnailUrl || result.imageUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                      {isDownloading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <SpinnerGapIcon className="w-6 h-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-xs font-medium leading-tight line-clamp-2">
                        {result.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="dialog-footer-detail">
            {hasSearched
              ? `${results.length} results`
              : 'Choose an image to apply it'}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
