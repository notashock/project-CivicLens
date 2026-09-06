'use client';

import React, { createContext, useContext, useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface SearchFilterContextType {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  clearSearch: () => void;
  viewMode: 'map' | 'ledger';
  setViewMode: (mode: 'map' | 'ledger') => void;
}

const SearchFilterContext = createContext<SearchFilterContextType>({
  search: '',
  setSearch: () => {},
  category: 'ALL',
  setCategory: () => {},
  clearSearch: () => {},
  viewMode: 'map',
  setViewMode: () => {},
});

function SearchFilterState({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams?.get('search') || '');
  const [category, setCategory] = useState(searchParams?.get('category') || 'ALL');
  const [viewMode, setViewModeState] = useState<'map' | 'ledger'>(
    searchParams?.get('view') === 'ledger' ? 'ledger' : 'map'
  );

  useEffect(() => {
    const urlCat = searchParams?.get('category');
    if (urlCat && urlCat !== category) {
      setCategory(urlCat);
    }
    const urlSearch = searchParams?.get('search');
    if (urlSearch !== null && urlSearch !== undefined && urlSearch !== search) {
      setSearch(urlSearch);
    }
    const urlView = searchParams?.get('view');
    if (urlView === 'ledger' || urlView === 'map') {
      setViewModeState(urlView);
    }
  }, [searchParams]);

  const clearSearch = () => setSearch('');

  const setViewMode = (mode: 'map' | 'ledger') => {
    setViewModeState(mode);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('view', mode);
    router.replace(`/?${params.toString()}`);
  };

  return (
    <SearchFilterContext.Provider
      value={{
        search,
        setSearch,
        category,
        setCategory,
        clearSearch,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </SearchFilterContext.Provider>
  );
}

export const SearchFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<>{children}</>}>
      <SearchFilterState>{children}</SearchFilterState>
    </Suspense>
  );
};

export const useSearchFilter = () => useContext(SearchFilterContext);
