/**
 * lib/attendance — unified attendance core.
 *
 * Re-exports everything needed by API routes and UI:
 *   time.ts        — IST helpers, grace period constants
 *   session-resolver.ts — maps member+time to the right session
 *   record-device-tap.ts — orchestrator for device taps
 */

export {
  IST_TZ,
  GRACE_BEFORE_MIN,
  GRACE_AFTER_MIN,
  LATE_AFTER_MIN,
  DEDUPE_WINDOW_MIN,
  istDayKey,
  istClock,
  istMidnight,
  istDateTime,
  nowIST,
} from './time';

export {
  resolveAttendanceTarget,
  type ResolveResult,
  type ResolvedTarget,
  type UnresolvedTarget,
  type ResolveInput,
  type ResolutionKind,
} from './session-resolver';

export {
  recordDeviceTap,
  type DeviceTapInput,
  type TapResult,
} from './record-device-tap';
