'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Issue } from '@/lib/api';

export interface IssueHeaderActions {
  isNearby: boolean;
  userDistanceMeters: number | null;
  locationLoading: boolean;
  isPermissionDenied?: boolean;
  openPermissionModal?: () => void;
  refreshLocation: () => Promise<void>;
  handleShare: () => void;
  copiedLink: boolean;
}

export interface ReportHeaderState {
  activeStep: 1 | 2 | 3;
  setActiveStep?: (step: 1 | 2 | 3) => void;
  submitting?: boolean;
}

interface ActiveIssueStateContextType {
  activeIssue: Issue | null;
  headerActions: IssueHeaderActions | null;
  reportHeader: ReportHeaderState | null;
}

interface ActiveIssueDispatchContextType {
  setActiveIssue: (issue: Issue | null) => void;
  setHeaderActions: (actions: IssueHeaderActions | null) => void;
  setReportHeader: (report: ReportHeaderState | null) => void;
}

const ActiveIssueStateContext = createContext<ActiveIssueStateContextType>({
  activeIssue: null,
  headerActions: null,
  reportHeader: null,
});

const ActiveIssueDispatchContext = createContext<ActiveIssueDispatchContextType>({
  setActiveIssue: () => {},
  setHeaderActions: () => {},
  setReportHeader: () => {},
});

export const ActiveIssueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeIssue, setActiveIssueState] = useState<Issue | null>(null);
  const [headerActions, setHeaderActionsState] = useState<IssueHeaderActions | null>(null);
  const [reportHeader, setReportHeaderState] = useState<ReportHeaderState | null>(null);

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
        prev.isPermissionDenied === actions.isPermissionDenied &&
        prev.openPermissionModal === actions.openPermissionModal &&
        prev.refreshLocation === actions.refreshLocation &&
        prev.handleShare === actions.handleShare &&
        prev.copiedLink === actions.copiedLink
      ) {
        return prev;
      }
      return actions;
    });
  }, []);

  const setReportHeader = useCallback((report: ReportHeaderState | null) => {
    setReportHeaderState((prev) => {
      if (!prev && !report) return prev;
      if (
        prev &&
        report &&
        prev.activeStep === report.activeStep &&
        prev.submitting === report.submitting &&
        prev.setActiveStep === report.setActiveStep
      ) {
        return prev;
      }
      return report;
    });
  }, []);

  const stateValue = useMemo(
    () => ({ activeIssue, headerActions, reportHeader }),
    [activeIssue, headerActions, reportHeader]
  );

  const dispatchValue = useMemo(
    () => ({ setActiveIssue, setHeaderActions, setReportHeader }),
    [setActiveIssue, setHeaderActions, setReportHeader]
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
