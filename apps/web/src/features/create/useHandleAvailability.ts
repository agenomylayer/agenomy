"use client";

import { useEffect, useReducer } from "react";
import {
  availabilityReducer,
  initialAvailabilityState,
  validateHandleFormat,
} from "./handleAvailability";
import { fetchHandleAvailable } from "../../lib/api";

export function useHandleAvailability(handle: string, debounceMs = 350) {
  const [state, dispatch] = useReducer(
    availabilityReducer,
    initialAvailabilityState,
  );

  useEffect(() => {
    dispatch({ type: "input", handle });
    const fmt = validateHandleFormat(handle);
    if (!fmt.ok || handle.length === 0) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetchHandleAvailable(handle);
        if (cancelled) return;
        dispatch({
          type: "result",
          handle,
          available: res.available,
          reason: res.reason,
        });
      } catch {
        if (!cancelled) dispatch({ type: "fail", handle });
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle, debounceMs]);

  return state;
}
