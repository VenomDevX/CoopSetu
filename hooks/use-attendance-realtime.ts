'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to attendance-related table changes and invoke `onChange` whenever
 * attendance_records, device_attendance_events, or attendance_sessions change.
 *
 * Modelled on hooks/use-tables-realtime.ts — uses a unique channel suffix per
 * subscriber (required: the browser client is a singleton and reusing a channel
 * name causes "cannot add postgres_changes after subscribe()" errors).
 *
 * Treats realtime payloads as nudges: debounces ~250ms then calls onChange(),
 * which should refetch from the API so that joined names/devices stay
 * authoritative (views aren't publishable via Supabase Realtime).
 *
 * Service-role writes from the terminal are delivered to browser subscribers:
 * publication membership is per-table, and Realtime re-checks each row against
 * the subscriber's own policies — so after 0095, an ICM Lucknow admin sees
 * Lucknow taps and not Bengaluru's.
 */
export function useAttendanceRealtime(onChange: () => void) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedOnChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange();
    }, 250);
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    const suffix = Math.random().toString(36).slice(2);

    const channel = supabase
      .channel(`attendance:${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => debouncedOnChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_attendance_events' },
        () => debouncedOnChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        () => debouncedOnChange(),
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedOnChange]);
}

/**
 * Subscribe to rfid_capture_requests changes for the tap-to-capture flow.
 */
export function useCaptureRealtime(onChange: () => void) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedOnChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange();
    }, 200);
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    const suffix = Math.random().toString(36).slice(2);

    const channel = supabase
      .channel(`rfid-capture:${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfid_capture_requests' },
        () => debouncedOnChange(),
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedOnChange]);
}
