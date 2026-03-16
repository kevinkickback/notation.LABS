import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    MagnifyingGlass,
    SpinnerGap,
    ImageSquare,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { ImageSearchResult } from '@/lib/types';

interface CharacterImageSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultQuery: string;
    onImageSelect: (base64: string) => void;
}

export function CharacterImageSearchDialog({
    open,
    onOpenChange,
    defaultQuery,
    onImageSelect,
}: CharacterImageSearchDialogProps) {
    const [searchQuery, setSearchQuery] = useState(defaultQuery);
    const searchQueryRef = useRef(searchQuery);
    const [results, setResults] = useState<ImageSearchResult[]>([]);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const didAutoSearch = useRef(false);

    const handleSearch = useCallback(async (query?: string) => {
        const q = (query ?? searchQueryRef.current).trim();
        if (!q) return;

        setLoading(true);
        setError(null);
        setResults([]);
        setThumbnails({});
        setHasSearched(true);

        try {
            const searchRes = await window.electronAPI.searchCharacterImages(q);
            if (!searchRes.success || !searchRes.data) {
                setError(searchRes.error || 'Search failed');
                setLoading(false);
                return;
            }

            setResults(searchRes.data);

            const thumbUrls = searchRes.data
                .map((r) => r.thumbnailUrl)
                .filter(Boolean);

            if (thumbUrls.length > 0) {
                const thumbRes =
                    await window.electronAPI.getCharacterThumbnails(thumbUrls);
                if (thumbRes.success && thumbRes.data) {
                    setThumbnails(thumbRes.data);
                }
            }
        } catch {
            setError('Image search failed. Check your internet connection.');
        } finally {
            setLoading(false);
        }
    }, []);

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

    const handleImageSelect = async (result: ImageSearchResult) => {
        if (!result.imageUrl || downloading) return;

        setDownloading(result.imageUrl);
        try {
            const res = await window.electronAPI.downloadCharacterImage(
                result.imageUrl,
            );
            if (!res.success || !res.data) {
                toast.error(res.error || 'Failed to download image');
                return;
            }
            onImageSelect(res.data);
            toast.success('Image applied');
        } catch {
            toast.error('Failed to download image');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Search Character Images</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2">
                    <Input
                        placeholder="Search for a character..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            searchQueryRef.current = e.target.value;
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        aria-label="Character image search query"
                    />
                    <Button
                        onClick={() => handleSearch()}
                        disabled={loading || !searchQuery.trim()}
                    >
                        <MagnifyingGlass className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <SpinnerGap className="w-8 h-8 animate-spin text-muted-foreground" />
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
                        <div className="grid grid-cols-3 gap-3 pt-1">
                            {results.map((result) => {
                                const thumb = thumbnails[result.thumbnailUrl];
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
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt={result.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ImageSquare className="w-8 h-8 text-muted-foreground" />
                                            )}
                                            {isDownloading && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <SpinnerGap className="w-6 h-6 animate-spin text-white" />
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
