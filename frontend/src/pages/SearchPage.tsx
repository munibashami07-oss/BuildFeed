import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Alert } from '../components/ui/Alert';
import { SearchResultCard } from '../components/search/SearchResultCard';
import { searchApi } from '../services/api/searchApi';
import { SearchResultItem } from '../types/search';
import {
  Filter,
  Loader2,
  Search,
  SearchX,
  Sparkles,
} from 'lucide-react';

// ── Content type filter definitions ──────────────────────────────────────────
const CONTENT_TYPE_FILTERS = [
  { id: '',               label: 'All' },
  { id: 'article',        label: 'Articles' },
  { id: 'github_repo',    label: 'GitHub' },
  { id: 'research_paper', label: 'Research' },
  { id: 'video',          label: 'Videos' },
];

const PAGE_SIZE = 20;

// ── Skeleton loader ───────────────────────────────────────────────────────────
const ResultSkeleton: React.FC = () => (
  <div className="editorial-card p-5 sm:p-6 animate-pulse space-y-3">
    <div className="flex gap-2">
      <div className="h-4 w-20 bg-borderPaper rounded-full" />
      <div className="h-4 w-28 bg-borderPaper rounded-full" />
    </div>
    <div className="h-5 w-3/4 bg-borderPaper rounded" />
    <div className="space-y-1.5">
      <div className="h-3 w-full bg-borderPaper rounded" />
      <div className="h-3 w-5/6 bg-borderPaper rounded" />
    </div>
    <div className="flex gap-2 pt-2 border-t border-borderPaper">
      <div className="h-7 w-16 bg-borderPaper rounded-md" />
      <div className="h-7 w-16 bg-borderPaper rounded-md ml-auto" />
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export const SearchPage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || '';
  const initialType  = searchParams.get('type') || '';

  const [inputValue, setInputValue]     = useState(initialQuery);
  const [query, setQuery]               = useState(initialQuery);
  const [contentType, setContentType]   = useState(initialType);
  const [results, setResults]           = useState<SearchResultItem[]>([]);
  const [total, setTotal]               = useState(0);
  const [hasMore, setHasMore]           = useState(false);
  const [usedSemantic, setUsedSemantic] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [offset, setOffset]             = useState(0);
  const [hasSearched, setHasSearched]   = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (!initialQuery) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // Run search when query or type changes from URL
  const runSearch = useCallback(
    async (q: string, type: string, off: number, append: boolean) => {
      if (!q.trim()) return;
      if (append) setIsLoadingMore(true);
      else { setIsLoading(true); setResults([]); }
      setError(null);

      try {
        const data = await searchApi.search({
          q: q.trim(),
          content_type: type || undefined,
          limit: PAGE_SIZE,
          offset: off,
        });
        if (append) {
          setResults((prev) => [...prev, ...data.results]);
        } else {
          setResults(data.results);
        }
        setTotal(data.total);
        setHasMore(data.has_more);
        setUsedSemantic(data.used_semantic);
        setHasSearched(true);
        setOffset(off + data.results.length);
      } catch (err: any) {
        setError(err?.message || 'Search failed. Please try again.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // Trigger on URL param change
  useEffect(() => {
    const q    = searchParams.get('q') || '';
    const type = searchParams.get('type') || '';
    setInputValue(q);
    setQuery(q);
    setContentType(type);
    setOffset(0);
    if (q) runSearch(q, type, 0, false);
  }, [searchParams, runSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    const params: Record<string, string> = { q };
    if (contentType) params.type = contentType;
    setSearchParams(params, { replace: true });
  };

  const handleTypeChange = (type: string) => {
    const params: Record<string, string> = {};
    if (query) params.q = query;
    if (type) params.type = type;
    setSearchParams(params, { replace: true });
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    runSearch(query, contentType, offset, true);
  };

  const handleSaveToggle = (itemId: string, newState: boolean) => {
    setResults((prev) =>
      prev.map((r) => (r.id === itemId ? { ...r, is_saved: newState } : r))
    );
  };

  return (
    <div className="min-h-screen flex bg-paper text-primary overflow-x-hidden">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
      <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* Search header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Search size={18} className="text-accent" />
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Search BuildFeed
            </h1>
          </div>
          <p className="text-sm text-secondary">
            Search across articles, GitHub repos, research papers, videos and more.
          </p>
        </div>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search for research, GitHub projects, tutorials…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-surface border border-borderPaper text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-150"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accentHover transition-colors flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {/* Content type filter tabs */}
        <div className="flex items-center gap-2 flex-wrap mb-6 pb-4 border-b border-borderPaper">
          <Filter size={14} className="text-secondary flex-shrink-0" />
          {CONTENT_TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleTypeChange(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                contentType === f.id
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-secondary border-borderPaper hover:border-accent/40 hover:text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results meta bar */}
        {hasSearched && !isLoading && (
          <div className="flex items-center justify-between gap-3 mb-4 text-xs text-secondary flex-wrap">
            <span>
              {total > 0
                ? `${total} result${total !== 1 ? 's' : ''} for "${query}"`
                : `No results for "${query}"`}
            </span>
            {usedSemantic && (
              <span className="inline-flex items-center gap-1 text-accent font-medium">
                <Sparkles size={11} /> Semantic search enabled
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert type="error" message={error} className="mb-6" onDismiss={() => setError(null)} />
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Results grid */}
        {!isLoading && results.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {results.map((item) => (
                <SearchResultCard
                  key={item.id}
                  item={item}
                  onSaveToggle={handleSaveToggle}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface border border-borderPaper text-sm font-medium text-secondary hover:text-primary hover:border-accent/40 transition-all duration-150 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Load more results'
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state — after a real search with no results */}
        {!isLoading && hasSearched && results.length === 0 && !error && (
          <div className="editorial-card p-10 text-center">
            <SearchX size={36} className="mx-auto text-secondary opacity-40 mb-4" />
            <h3 className="font-heading text-lg font-semibold text-primary mb-1">
              No results found
            </h3>
            <p className="text-sm text-secondary max-w-sm mx-auto mb-4">
              Try a different search term or remove the content type filter.
            </p>
            {contentType && (
              <button
                onClick={() => handleTypeChange('')}
                className="text-sm text-accent hover:text-accentHover font-medium"
              >
                Clear filter and search all types
              </button>
            )}
          </div>
        )}

        {/* Prompt state — nothing searched yet */}
        {!isLoading && !hasSearched && !error && (
          <div className="py-16 text-center">
            <Search size={40} className="mx-auto text-accent opacity-30 mb-4" />
            <p className="text-sm text-secondary">
              Type a query above to search BuildFeed's content library.
            </p>
            <p className="text-xs text-secondary mt-1">
              Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-borderPaper text-[10px] font-mono">
                /
              </kbd>{' '}
              anywhere to open search quickly.
            </p>
          </div>
        )}
      </main>

      <Footer />
      </div>
    </div>
  );
};
