'use client';

import { useEffect, useRef, useCallback } from 'react';
import { TournamentEvent } from '@/lib/types';

interface UseTournamentStreamOptions {
  code: string;
  onEvent: (event: TournamentEvent) => void;
  enabled?: boolean;
}

export function useTournamentStream({ code, onEvent, enabled = true }: UseTournamentStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep callback ref current without re-triggering effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    const es = new EventSource(`/api/tournaments/${code}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as TournamentEvent;
        onEventRef.current(event);
      } catch {
        // malformed event, ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, [code, enabled]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}
