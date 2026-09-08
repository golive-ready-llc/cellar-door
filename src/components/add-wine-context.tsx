"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Wine, Cabinet, NewWineInput } from "@/types/wine";

interface AddWineContextType {
  /** Open the add wine dialog */
  openAddWine: () => void;
  /** Register the page-level handler (called by cellar/inventory pages) */
  register: (opts: {
    cabinets: Cabinet[];
    onAdd: (wine: NewWineInput) => void | Promise<void>;
    allTags?: string[];
    unfiledWines?: Wine[];
    onPlaceWine?: (wineId: string, cabinetId: string) => void;
    /** Optional: open the wine-list-scan dialog (e.g., from the camera's
     * Wine List tab). Pages that support wine-list scanning register this. */
    onScanWineList?: () => void;
  }) => void;
  /** Whether a handler is registered */
  ready: boolean;
  /** Internal state */
  _open: boolean;
  _setOpen: (open: boolean) => void;
  _cabinets: Cabinet[];
  _onAdd: ((wine: NewWineInput) => void | Promise<void>) | null;
  _allTags: string[];
  _unfiledWines: Wine[];
  _onPlaceWine: ((wineId: string, cabinetId: string) => void) | null;
  _onScanWineList: (() => void) | null;
  /** Pre-acquired camera stream (acquired inside a user gesture) */
  _readyStream: MediaStream | null;
  /** Open the dialog with a camera stream already started (called from FAB click) */
  _openCameraFirst: () => void;
  /** Ask for the camera dialog to open as soon as a page registers a handler.
   *  Used by the bottom-nav Add button on pages without one (history, stats…):
   *  it navigates to /cellar and the dialog opens when the cellar registers. */
  requestCameraOnReady: () => void;
}

const AddWineContext = createContext<AddWineContextType>({
  openAddWine: () => {},
  register: () => {},
  ready: false,
  _open: false,
  _setOpen: () => {},
  _cabinets: [],
  _onAdd: null,
  _allTags: [],
  _unfiledWines: [],
  _onPlaceWine: null,
  _onScanWineList: null,
  _readyStream: null,
  _openCameraFirst: () => {},
  requestCameraOnReady: () => {},
});

export function AddWineProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [readyStream, setReadyStream] = useState<MediaStream | null>(null);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [onAdd, setOnAdd] = useState<
    ((wine: NewWineInput) => void | Promise<void>) | null
  >(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [unfiledWines, setUnfiledWines] = useState<Wine[]>([]);
  const [onPlaceWine, setOnPlaceWine] = useState<
    ((wineId: string, cabinetId: string) => void) | null
  >(null);
  const [onScanWineList, setOnScanWineList] = useState<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const readyStreamRef = useRef<MediaStream | null>(null);
  // Monotonic token for camera acquisitions — lets a stale getUserMedia
  // resolution detect it lost the race and stop its stream (see below).
  const cameraGenRef = useRef(0);
  // Set when the Add button is tapped on a page with no registered handler —
  // consumed by register() so the dialog opens right after navigation lands.
  const pendingCameraRef = useRef(false);

  // Wrap _setOpen to also clear the pre-acquired stream when closing the dialog.
  // This prevents a stale stream from leaking when the user opens/closes/reopens.
  const wrappedSetOpen = useCallback((open: boolean) => {
    if (!open) {
      // Invalidate any still-pending camera acquisition so its resolution
      // stops the stream and doesn't reopen the dialog.
      cameraGenRef.current++;
      setReadyStream((prev) => {
        if (prev) {
          prev.getTracks().forEach((t) => t.stop());
        }
        return null;
      });
      readyStreamRef.current = null;
    }
    setOpen(open);
  }, []);

  // Called from the FAB click handler (which has transient activation).
  // Acquires the camera stream inside the user gesture so the browser
  // shows the permission prompt, then opens the dialog with the stream.
  const openCameraFirst = useCallback(() => {
    if (open) return;
    // Generation guard: if a newer acquisition starts while this one's
    // getUserMedia is still pending, the stale resolution must stop its
    // stream instead of parking it live in the ref (a live track no one
    // stops keeps the Android camera locked for the whole app).
    const generation = ++cameraGenRef.current;
    (async () => {
      const prev = readyStreamRef.current;
      if (prev) {
        prev.getTracks().forEach((t) => t.stop());
        readyStreamRef.current = null;
      }
      setReadyStream(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cameraGenRef.current !== generation) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        readyStreamRef.current = stream;
        setReadyStream(stream);
      } catch {
        // Camera unavailable — dialog will show error + upload fallback
      }
      if (cameraGenRef.current !== generation) return;
      setOpen(true);
    })();
  }, [open]);

  const register = useCallback(
    (opts: {
      cabinets: Cabinet[];
      onAdd: (wine: NewWineInput) => void | Promise<void>;
      allTags?: string[];
      unfiledWines?: Wine[];
      onPlaceWine?: (wineId: string, cabinetId: string) => void;
      onScanWineList?: () => void;
    }) => {
      setCabinets(opts.cabinets);
      // Wrap in function to avoid React treating it as a state updater
      setOnAdd(() => opts.onAdd);
      setAllTags(opts.allTags ?? []);
      setUnfiledWines(opts.unfiledWines ?? []);
      setOnPlaceWine(opts.onPlaceWine ? () => opts.onPlaceWine : null);
      setOnScanWineList(opts.onScanWineList ? () => opts.onScanWineList : null);
      setReady(true);
      // Honor a pending camera-open request (Add tapped on a page without a
      // handler → navigated here). Permission is usually already granted, so
      // getUserMedia outside a gesture still works; if not, the dialog opens
      // with the upload fallback.
      if (pendingCameraRef.current) {
        pendingCameraRef.current = false;
        openCameraFirst();
      }
    },
    [openCameraFirst]
  );

  const requestCameraOnReady = useCallback(() => {
    pendingCameraRef.current = true;
  }, []);

  const openAddWine = useCallback(() => {
    if (ready) wrappedSetOpen(true);
  }, [ready, wrappedSetOpen]);

  return (
    <AddWineContext.Provider
      value={{
        openAddWine,
        register,
        ready,
        _open: open,
        _setOpen: wrappedSetOpen,
        _cabinets: cabinets,
        _onAdd: onAdd,
        _allTags: allTags,
        _unfiledWines: unfiledWines,
        _onPlaceWine: onPlaceWine,
        _onScanWineList: onScanWineList,
        _readyStream: readyStream,
        _openCameraFirst: openCameraFirst,
        requestCameraOnReady,
      }}
    >
      {children}
    </AddWineContext.Provider>
  );
}

export function useAddWine() {
  return useContext(AddWineContext);
}
