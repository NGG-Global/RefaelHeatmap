/**
 * Host PIN for the current browser tab: sessionStorage only, never
 * localStorage or the URL. A display window opened from the host console with
 * window.open() starts with a copy of this tab's sessionStorage.
 */

const STORAGE_KEY = "ngg.hostPin";
let memoryPin: string | null = null;

export function getHostPin(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryPin;
  }
}

export function setHostPin(pin: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, pin);
  } catch {
    memoryPin = pin;
  }
}

export function clearHostPin(): void {
  memoryPin = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing stored */
  }
}
