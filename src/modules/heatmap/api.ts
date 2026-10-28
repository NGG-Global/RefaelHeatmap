/** Typed wrappers for the public.heatmap_* database functions. */
import { rpc } from "../../platform/rpc";

export type AuthFailure = "unauthorized" | "locked" | "not_configured";

export type EventPublic =
  | { status: "ok"; event_id: string; name: string; voting_open: boolean }
  | { status: "not_found" };

export type CastVoteResult = { status: "ok" | "closed" | "not_found" | "invalid" };

/** [x, y, count] for every populated grid point. */
export type Cell = readonly [number, number, number];

export type DisplayData =
  | {
      status: "ok";
      event_id: string;
      name: string;
      short_code: string;
      voting_open: boolean;
      revealed: boolean;
      show_mean: boolean;
      voters: number;
      cells: Cell[] | null;
      mean: { x: number; y: number } | null;
    }
  | { status: "not_found" };

export interface HostEvent {
  id: string;
  name: string;
  short_code: string;
  created_at: string;
  voting_open: boolean;
  revealed: boolean;
  show_mean: boolean;
  voters: number;
}

export interface ExportRow {
  event_id: string;
  x: number;
  y: number;
  updated_at: string;
}

type Host<T> = ({ status: "ok" } & T) | { status: AuthFailure | "not_found" | "invalid" | "error" };

export const eventPublic = (shortCode: string) =>
  rpc<EventPublic>("heatmap_event_public", { p_short_code: shortCode }, { retries: 2, timeoutMs: 8000 });

export const castVote = (shortCode: string, deviceId: string, x: number, y: number) =>
  rpc<CastVoteResult>(
    "heatmap_cast_vote",
    { p_short_code: shortCode, p_device_id: deviceId, p_x: x, p_y: y },
    // Safe to retry: the vote is an upsert on (event, device).
    { retries: 2, timeoutMs: 10_000 },
  );

export const display = (eventId: string) =>
  rpc<DisplayData>("heatmap_display", { p_event_id: eventId }, { timeoutMs: 6000 });

export const hostListEvents = (pin: string) =>
  rpc<Host<{ events: HostEvent[] }>>("heatmap_host_list_events", { p_pin: pin }, { timeoutMs: 8000 });

export const hostCreateEvent = (pin: string, name: string) =>
  rpc<Host<{ id: string; short_code: string }>>("heatmap_host_create_event", { p_pin: pin, p_name: name });

export const hostSetState = (
  pin: string,
  eventId: string,
  state: { voting_open?: boolean; revealed?: boolean; show_mean?: boolean },
) =>
  rpc<Host<{ voting_open: boolean; revealed: boolean; show_mean: boolean }>>(
    "heatmap_host_set_state",
    {
      p_pin: pin,
      p_event_id: eventId,
      ...(state.voting_open !== undefined && { p_voting_open: state.voting_open }),
      ...(state.revealed !== undefined && { p_revealed: state.revealed }),
      ...(state.show_mean !== undefined && { p_show_mean: state.show_mean }),
    },
    { retries: 1 },
  );

export const hostResetEvent = (pin: string, eventId: string) =>
  rpc<Host<object>>("heatmap_host_reset_event", { p_pin: pin, p_event_id: eventId });

export const hostExport = (pin: string, eventId: string) =>
  rpc<Host<{ rows: ExportRow[] }>>("heatmap_host_export", { p_pin: pin, p_event_id: eventId }, { retries: 1 });

export const hostDeleteEvent = (pin: string, eventId: string) =>
  rpc<Host<object>>("heatmap_host_delete_event", { p_pin: pin, p_event_id: eventId });
