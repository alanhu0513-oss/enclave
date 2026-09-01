/**
 * useRealtime — React hook for WebSocket connection.
 * Connects to the backend Socket.IO server and provides
 * real-time event listeners for notifications, alerts, scan progress.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '../lib/api';

interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: number;
}

interface UseRealtimeOptions {
  onNotification?: (notification: any) => void;
  onAlert?: (alert: any) => void;
  onAlertResolved?: (data: { alertId: string }) => void;
  onScanProgress?: (progress: any) => void;
  onScanCompleted?: (result: any) => void;
  onScanFailed?: (error: any) => void;
  onTakedownInitiated?: (takedown: any) => void;
  onTakedownCompleted?: (takedown: any) => void;
  onMonitorCycleCompleted?: (result: any) => void;
  onUsageLimitReached?: (data: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const wsUrl = api.getBaseUrl() || window.location.origin;
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      optionsRef.current.onConnected?.();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      optionsRef.current.onDisconnected?.();
    });

    socket.on('connected', (data) => {
      console.log('[WS] Connected:', data);
    });

    // Notifications
    socket.on('notification:new', (notification) => {
      setLastEvent({ type: 'notification', data: notification, timestamp: Date.now() });
      optionsRef.current.onNotification?.(notification);
    });

    // Alerts
    socket.on('alert:new', (alert) => {
      setLastEvent({ type: 'alert', data: alert, timestamp: Date.now() });
      optionsRef.current.onAlert?.(alert);
    });

    socket.on('alert:resolved', (data) => {
      setLastEvent({ type: 'alert:resolved', data, timestamp: Date.now() });
      optionsRef.current.onAlertResolved?.(data);
    });

    // Scan progress
    socket.on('scan:progress', (progress) => {
      setLastEvent({ type: 'scan:progress', data: progress, timestamp: Date.now() });
      optionsRef.current.onScanProgress?.(progress);
    });

    socket.on('scan:completed', (result) => {
      setLastEvent({ type: 'scan:completed', data: result, timestamp: Date.now() });
      optionsRef.current.onScanCompleted?.(result);
    });

    socket.on('scan:failed', (error) => {
      setLastEvent({ type: 'scan:failed', data: error, timestamp: Date.now() });
      optionsRef.current.onScanFailed?.(error);
    });

    // Takedowns
    socket.on('takedown:initiated', (takedown) => {
      setLastEvent({ type: 'takedown:initiated', data: takedown, timestamp: Date.now() });
      optionsRef.current.onTakedownInitiated?.(takedown);
    });

    socket.on('takedown:completed', (takedown) => {
      setLastEvent({ type: 'takedown:completed', data: takedown, timestamp: Date.now() });
      optionsRef.current.onTakedownCompleted?.(takedown);
    });

    // Monitoring
    socket.on('monitor:cycle:completed', (result) => {
      setLastEvent({ type: 'monitor:completed', data: result, timestamp: Date.now() });
      optionsRef.current.onMonitorCycleCompleted?.(result);
    });

    // Usage
    socket.on('usage:limit:reached', (data) => {
      setLastEvent({ type: 'usage:limit', data, timestamp: Date.now() });
      optionsRef.current.onUsageLimitReached?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribeToAlerts = useCallback((types: string[]) => {
    socketRef.current?.emit('subscribe:alerts', types);
  }, []);

  const unsubscribeFromAlerts = useCallback((types: string[]) => {
    socketRef.current?.emit('unsubscribe:alerts', types);
  }, []);

  return {
    isConnected,
    lastEvent,
    subscribeToAlerts,
    unsubscribeFromAlerts,
    socket: socketRef.current,
  };
}
