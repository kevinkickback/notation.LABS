import { MagnifyingGlassIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type RawIGDBApiResult, searchIGDB } from '@/lib/igdb';
import type { IGDBSearchResult } from '@/lib/types';
import { fetchImageAsBase64 } from '@/lib/utils';

interface CoverSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultQuery: string;
  onCoverSelect: (base64: string) => void;
}

export function CoverSearchDialog({
  open,
  onOpenChange,
  defaultQuery,
  onCoverSelect,
}: CoverSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const searchQueryRef = useRef(searchQuery);
  const [results, setResults] = useState<IGDBSearchResult[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const didAutoSearch = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (query?: string) => {
    const q = (query ?? searchQueryRef.current).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setThumbnails({});
    setHasSearched(true);

    try {
      const rawData: RawIGDBApiResult[] = await searchIGDB(q);
      const data: IGDBSearchResult[] = (rawData || []).map(
        (g: RawIGDBApiResult) => {
          const coverId = g.coverImageId ?? g.cover?.image_id ?? null;
          const release = g.firstReleaseDate ?? g.first_release_date ?? null;
          return {
            igdbId: g.id,
            name: g.name,
            coverImageId: coverId,
            firstReleaseDate: release,
          };
        },
      );
      setResults(data);

      const thumbs: Record<string, string> = {};
      for (const g of data) {
        if (g.coverImageId) {
          thumbs[g.coverImageId] =
            `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.coverImageId}.jpg`;
        }
      }
      setThumbnails(thumbs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    (query?: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        handleSearch(query);
      }, 300);
    },
    [handleSearch],
  );

  useEffect(() => {
    if (open) {
      setSearchQuery(defaultQuery);
      searchQueryRef.current = defaultQuery;
      setResults([]);
      setThumbnails({});
      setError(null);
      setHasSearched(false);
      didAutoSearch.current = false;

      if (defaultQuery.trim()) {
        didAutoSearch.current = true;
        handleSearch(defaultQuery);
      }
    }
  }, [open, defaultQuery, handleSearch]);

  const handleCoverSelect = async (result: IGDBSearchResult) => {
    if (!result.coverImageId || downloading) return;
    setDownloading(result.coverImageId);
    try {
      // Try IGDB cover sizes in order of quality
      const sizes = [
        't_cover_big_2x',
        't_cover_big',
        't_cover_small_2x',
        't_cover_small',
        't_thumb',
      ];
      let found = false;
      for (const size of sizes) {
        const url = `https://images.igdb.com/igdb/image/upload/${size}/${result.coverImageId}.jpg`;
        const dataUrl = await fetchImageAsBase64(
          'https://igdb.capitol-k.workers.dev/download',
          url,
        );
        if (dataUrl) {
          onCoverSelect(dataUrl);
          found = true;
          break;
        }
      }
      if (!found) {
        toast.error('Failed to download cover (no available sizes)');
      }
    } catch {
      toast.error('Failed to download cover');
    } finally {
      setDownloading(null);
    }
  };

  const formatYear = (timestamp: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).getFullYear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Game Covers</DialogTitle>
          <DialogDescription>
            Find and apply cover art from IGDB for the current game.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search for a game..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchQueryRef.current = e.target.value;
            }}
            onKeyDown={(e) => e.key === 'Enter' && debouncedSearch()}
            aria-label="Game search query"
          />
          <Button
            onClick={() => debouncedSearch()}
            disabled={loading || !searchQuery.trim()}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
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
              <p>No covers found</p>
              <p className="mt-1">Try different search terms</p>
            </div>
          )}

          {!loading && !error && !hasSearched && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Search for a game to find cover art
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {results.map((result) => {
                const thumb = result.coverImageId
                  ? thumbnails[result.coverImageId]
                  : null;
                const isDownloading = downloading === result.coverImageId;
                const year = formatYear(result.firstReleaseDate);

                return (
                  <button
                    key={result.igdbId || result.coverImageId || result.name}
                    type="button"
                    className="relative rounded-lg border-2 border-border bg-muted overflow-hidden text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => handleCoverSelect(result)}
                    disabled={!result.coverImageId || !!downloading}
                    aria-label={`Select cover for ${result.name}`}
                  >
                    <div className="aspect-[90/128] w-full flex items-center justify-center bg-muted">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center text-muted-foreground bg-gray-200 rounded">
                          ?
                        </div>
                      )}
                      {isDownloading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <SpinnerGapIcon className="w-6 h-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-xs font-medium leading-tight line-clamp-2">
                        {result.name}
                      </p>
                      {year && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {year}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-1">
          Powered by IGDB
        </p>
      </DialogContent>
    </Dialog>
  );
}
