/** Front-end configuration. Only the project URL and the publishable key may be here. */

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_PUBLISHABLE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isConfigured = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";

/**
 * Origin printed in QR codes and short links (a custom domain, when set).
 * A value entered without a scheme ("example.com") gets https://, so the QR
 * always encodes an absolute link that phone cameras open.
 */
export function publicBaseUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!configured) return window.location.origin;
  return /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
}
