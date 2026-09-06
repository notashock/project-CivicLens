/**
 * CivicTrace Geolocation & Hardware-Attested Location Service
 * Provides robust multi-stage location acquisition (high accuracy -> coarse fallback),
 * permission state monitoring, and browser-specific permission resolution helpers.
 */

export type LocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  isHighAccuracy: boolean;
  timestamp: number;
}

export class GeolocationError extends Error {
  code: number;
  isPermissionDenied: boolean;
  isTimeout: boolean;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
    this.isPermissionDenied = code === 1; // PERMISSION_DENIED
    this.isTimeout = code === 3; // TIMEOUT
  }
}

/**
 * Checks the browser's current Geolocation permission status via Permissions API.
 */
export async function checkLocationPermissionState(): Promise<LocationPermissionState> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported';
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state as LocationPermissionState;
    } catch {
      // Some browsers (e.g. Safari iOS older versions) may throw for geolocation in query
      return 'prompt';
    }
  }

  return 'prompt';
}

/**
 * Listens for user changing permission in browser address bar / settings.
 */
export function subscribeToPermissionChanges(
  onChange: (state: LocationPermissionState) => void
): () => void {
  if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return () => {};
  }

  let permissionStatus: PermissionStatus | null = null;
  let active = true;

  const handleStatusChange = () => {
    if (active && permissionStatus) {
      onChange(permissionStatus.state as LocationPermissionState);
    }
  };

  navigator.permissions
    .query({ name: 'geolocation' as PermissionName })
    .then((status) => {
      if (!active) return;
      permissionStatus = status;
      permissionStatus.addEventListener('change', handleStatusChange);
    })
    .catch(() => {});

  return () => {
    active = false;
    if (permissionStatus) {
      permissionStatus.removeEventListener('change', handleStatusChange);
    }
  };
}

/**
 * Acquire user location using a resilient multi-stage strategy:
 * 1. High accuracy GPS (enableHighAccuracy: true) with 8s timeout.
 * 2. If high accuracy times out or hardware is unavailable, automatically falls back
 *    to network/coarse triangulation (enableHighAccuracy: false) with 12s timeout.
 */
export async function acquireUserLocation(options?: {
  onFallbackToCoarse?: () => void;
}): Promise<LocationCoordinates> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new GeolocationError('Geolocation is not supported by your browser.', 0);
  }

  // Attempt 1: High Accuracy (GPS / Hardware Sensor)
  const tryHighAccuracy = (): Promise<LocationCoordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isHighAccuracy: true,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          reject(new GeolocationError(err.message || 'High accuracy GPS fix failed', err.code));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000, // 30 seconds fresh
        }
      );
    });
  };

  // Attempt 2: Coarse / Network Triangulation (WiFi / IP / Cellular)
  const tryCoarseAccuracy = (): Promise<LocationCoordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isHighAccuracy: false,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          reject(new GeolocationError(err.message || 'Unable to retrieve location', err.code));
        },
        {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000, // 5 minutes cached is acceptable for fallback
        }
      );
    });
  };

  try {
    return await tryHighAccuracy();
  } catch (err: any) {
    // If the user explicitly denied permission, DO NOT retry – throw immediately
    if (err instanceof GeolocationError && err.isPermissionDenied) {
      throw err;
    }

    // Otherwise (timeout or position unavailable), attempt coarse fallback
    if (options?.onFallbackToCoarse) {
      options.onFallbackToCoarse();
    }

    return await tryCoarseAccuracy();
  }
}

/**
 * Detect client browser and OS environment for contextual guidance
 */
export function detectBrowserEnvironment(): {
  isIOS: boolean;
  isAndroid: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isFirefox: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isChrome: false,
      isSafari: false,
      isEdge: false,
      isFirefox: false,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isEdge = /edg\//.test(ua);
  const isFirefox = /firefox/.test(ua);
  const isChrome = /chrome/.test(ua) && !isEdge;
  const isSafari = /safari/.test(ua) && !isChrome && !isEdge;

  return { isIOS, isAndroid, isChrome, isSafari, isEdge, isFirefox };
}
