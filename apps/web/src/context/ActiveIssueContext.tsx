'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Issue } from '@/lib/api';

export interface IssueHeaderActions {
  isNearby: boolean;
  userDistanceMeters: number | null;
  locationLoading: boolean;
  refreshLocation: () => Promise<void>;
  handleShare: () => void;
  copiedLink: boolean;
}

interface ActiveIssueStateContextType {
  activeIssue: Issue | null;
  headerActions: IssueHeaderActions | null;
}

interface ActiveIssueDispatchContextType {
  setActiveIssue: (issue: Issue | null) => void;
  setHeaderActions: (actions: IssueHeaderActions | null) => void;
}

const ActiveIssueStateContext = createContext<ActiveIssueStateContextType>({
  activeIssue: null,
  headerActions: null,
});

const ActiveIssueDispatchContext = createContext<ActiveIssueDispatchContextType>({
  setActiveIssue: () => {},
  setHeaderActions: () => {},
});

export const ActiveIssueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeIssue, setActiveIssueState] = useState<Issue | null>(null);
  const [headerActions, setHeaderActionsState] = useState<IssueHeaderActions | null>(null);

  const setActiveIssue = useCallback((issue: Issue | null) => {
    setActiveIssueState(issue);
  }, []);

  const setHeaderActions = useCallback((actions: IssueHeaderActions | null) => {
    setHeaderActionsState((prev) => {
      // Shallow comparison to avoid redundant state updates and infinite render loops
      if (!prev && !actions) return prev;
      if (
        prev &&
        actions &&
        prev.isNearby === actions.isNearby &&
        prev.userDistanceMeters === actions.userDistanceMeters &&
        prev.locationLoading === actions.locationLoading &&
        prev.refreshLocation === actions.refreshLocation &&
        prev.handleShare === actions.handleShare &&
        prev.copiedLink === actions.copiedLink
      ) {
        return prev;
      }
      return actions;
    });
  }, []);

  const stateValue = useMemo(
    () => ({ activeIssue, headerActions }),
    [activeIssue, headerActions]
  );

  const dispatchValue = useMemo(
    () => ({ setActiveIssue, setHeaderActions }),
    [setActiveIssue, setHeaderActions]
  );

  return (
    <ActiveIssueDispatchContext.Provider value={dispatchValue}>
      <ActiveIssueStateContext.Provider value={stateValue}>
        {children}
      </ActiveIssueStateContext.Provider>
    </ActiveIssueDispatchContext.Provider>
  );
};

export const useActiveIssue = () => {
  const state = useContext(ActiveIssueStateContext);
  const dispatch = useContext(ActiveIssueDispatchContext);
  return {
    ...state,
    ...dispatch,
  };
};

export const useActiveIssueState = () => useContext(ActiveIssueStateContext);
export const useActiveIssueDispatch = () => useContext(ActiveIssueDispatchContext);
