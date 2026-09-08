"use client"

// Re-export from custom toast implementation
// Sonner v1.7.4 and v2.0.7 both break with React 19.2.3 due to
// ReactDOM.flushSync inside setTimeout not triggering state updates.
// This custom implementation uses useSyncExternalStore instead.

export { Toaster, toast } from "./custom-toast"
