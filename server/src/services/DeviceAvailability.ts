/**
 * Device Availability Watchdog
 *
 * Tracks when devices were last seen and marks them as unavailable
 * if they haven't communicated in more than 125 seconds.
 *
 * Devices are considered "seen" when they:
 * - Hit /nest/entry
 * - Send a PUT request to /nest/transport/put
 * - Attempt a SUBSCRIBE to /nest/transport
 *
 * All devices start as UNAVAILABLE until first activity.
 */

export interface DeviceAvailabilityState {
  serial: string;
  lastSeen: number; // Unix timestamp in milliseconds
  isAvailable: boolean;
}

export class DeviceAvailabilityWatchdog {
  private deviceStates: Map<string, DeviceAvailabilityState> = new Map();
  private watchdogTimer: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_MS = 125000; // 125 seconds (120s + 5s buffer)
  private readonly CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
  private onAvailabilityChange: ((serial: string, isAvailable: boolean) => void) | null = null;

  /**
   * Start the watchdog timer
   */
  start(): void {
    if (this.watchdogTimer) {
      console.warn('[DeviceAvailability] Watchdog already running');
      return;
    }

    console.log(`[DeviceAvailability] Starting watchdog (timeout: ${this.TIMEOUT_MS}ms, check: ${this.CHECK_INTERVAL_MS}ms)`);

    this.watchdogTimer = setInterval(() => {
      this.checkDeviceTimeouts();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the watchdog timer
   */
  stop(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
      console.log('[DeviceAvailability] Watchdog stopped');
    }
  }

  /**
   * Set callback for availability changes
   */
  setAvailabilityChangeHandler(callback: (serial: string, isAvailable: boolean) => void): void {
    this.onAvailabilityChange = callback;
  }

  /**
   * Mark a device as seen (heartbeat)
   */
  markSeen(serial: string): void {
    const now = Date.now();
    const existingState = this.deviceStates.get(serial);

    if (!existingState) {
      // First time seeing this device
      console.log(`[DeviceAvailability] Device ${serial} first seen`);
      this.deviceStates.set(serial, {
        serial,
        lastSeen: now,
        isAvailable: true,
      });

      // Notify that device is now available
      this.notifyAvailabilityChange(serial, true);
    } else {
      // Update last seen timestamp
      const wasAvailable = existingState.isAvailable;
      existingState.lastSeen = now;

      if (!wasAvailable) {
        // Device came back online
        console.log(`[DeviceAvailability] Device ${serial} came back online`);
        existingState.isAvailable = true;
        this.notifyAvailabilityChange(serial, true);
      }
    }
  }

  /**
   * Check all devices for timeouts
   */
  private checkDeviceTimeouts(): void {
    const now = Date.now();

    for (const [serial, state] of this.deviceStates.entries()) {
      if (!state.isAvailable) {
        // Already marked unavailable, skip
        continue;
      }

      const timeSinceLastSeen = now - state.lastSeen;

      if (timeSinceLastSeen > this.TIMEOUT_MS) {
        console.log(`[DeviceAvailability] Device ${serial} timed out (last seen ${Math.round(timeSinceLastSeen / 1000)}s ago)`);
        state.isAvailable = false;
        this.notifyAvailabilityChange(serial, false);
      }
    }
  }

  /**
   * Notify callback of availability change
   */
  private notifyAvailabilityChange(serial: string, isAvailable: boolean): void {
    if (this.onAvailabilityChange) {
      try {
        this.onAvailabilityChange(serial, isAvailable);
      } catch (error) {
        console.error(`[DeviceAvailability] Error in availability change handler for ${serial}:`, error);
      }
    }
  }

  /**
   * Get current availability state for a device
   */
  getAvailability(serial: string): boolean {
    const state = this.deviceStates.get(serial);
    // Devices are unavailable until first seen
    return state?.isAvailable ?? false;
  }

  /**
   * Get all device states (for debugging)
   */
  getAllStates(): DeviceAvailabilityState[] {
    return Array.from(this.deviceStates.values());
  }

  /**
   * Force a device to unavailable (for testing or manual override)
   */
  forceUnavailable(serial: string): void {
    const state = this.deviceStates.get(serial);
    if (state && state.isAvailable) {
      console.log(`[DeviceAvailability] Forcing device ${serial} to unavailable`);
      state.isAvailable = false;
      this.notifyAvailabilityChange(serial, false);
    }
  }
}
