import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import { fetchImageAsBase64 } from '@/lib/utils';
import type { ImageSearchResult } from '@/lib/types';

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
    const [inputValue, setInputValue] = useState(searchQuery);
    // All state now declared below for DuckDuckGo logic only
    const [results, setResults] = useState<ImageSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async (query?: string) => {
        const q = (typeof query === 'string' ? query : inputValue).trim();
        if (!q) return;
        setLoading(true);
        setError(null);
        setResults([]);
        setHasSearched(true);
        try {
            // Use DDG worker endpoint directly
            const res = await fetch('https://ddg.capitol-k.workers.dev/image-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q }),
            });
            if (!res.ok) {
                setError('Search failed');
                setLoading(false);
                return;
            }
            const data: ImageSearchResult[] = await res.json();
            setResults(data);
        } catch {
            setError('Image search failed. Check your internet connection.');
        } finally {
            setLoading(false);
        }
    }, [inputValue]);

    // Only reset inputValue from searchQuery when dialog is opened (not on every prop change)
    const prevOpenRef = useRef(false);
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setInputValue(searchQuery);
            setResults([]);
            setError(null);
            setHasSearched(false);
            if (searchQuery.trim()) {
                handleSearch(searchQuery);
            }
        }
        prevOpenRef.current = open;
    }, [open, searchQuery, handleSearch]);

    const handleImageSelect = async (result: ImageSearchResult) => {
        if (!result.imageUrl || downloading) return;
        setDownloading(result.imageUrl);
        try {
            const dataUrl = await fetchImageAsBase64('https://ddg.capitol-k.workers.dev/download', result.imageUrl);
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
            <DialogContent className="sm:max-w-[540px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Search Character Images</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2">
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
                        onClick={() => handleSearch()}
                        disabled={loading || !inputValue.trim()}
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
