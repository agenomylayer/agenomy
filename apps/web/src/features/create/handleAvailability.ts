export type AvailabilityStatus =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

export interface AvailabilityState {
  status: AvailabilityStatus;
  handle: string;
  reason?: string;
}

export const initialAvailabilityState: AvailabilityState = {
  status: "idle",
  handle: "",
  reason: undefined,
};

const HANDLE_CHAR_RE = /^[a-z0-9-]+$/;

export type FormatResult = { ok: true } | { ok: false; reason: string };

export function validateHandleFormat(handle: string): FormatResult {
  if (handle.length < 3 || handle.length > 32) {
    return { ok: false, reason: "Handle must be 3-32 characters." };
  }
  if (!HANDLE_CHAR_RE.test(handle)) {
    return {
      ok: false,
      reason: "Use lowercase letters, digits, and hyphens only.",
    };
  }
  return { ok: true };
}

export type AvailabilityAction =
  | { type: "input"; handle: string }
  | { type: "result"; handle: string; available: boolean; reason?: string }
  | { type: "fail"; handle: string };

export function availabilityReducer(
  state: AvailabilityState,
  action: AvailabilityAction,
): AvailabilityState {
  switch (action.type) {
    case "input": {
      if (action.handle.length === 0) {
        return { status: "idle", handle: "", reason: undefined };
      }
      const fmt = validateHandleFormat(action.handle);
      if (!fmt.ok) {
        return {
          status: "invalid",
          handle: action.handle,
          reason: fmt.reason,
        };
      }
      return { status: "checking", handle: action.handle, reason: undefined };
    }
    case "result": {
      // ignore results for a handle the user has since changed
      if (action.handle !== state.handle) return state;
      if (action.available) {
        return { status: "available", handle: state.handle, reason: undefined };
      }
      return {
        status: "taken",
        handle: state.handle,
        reason: action.reason ?? "Handle is taken.",
      };
    }
    case "fail": {
      if (action.handle !== state.handle) return state;
      return {
        status: "error",
        handle: state.handle,
        reason: "Could not check availability.",
      };
    }
    default:
      return state;
  }
}
