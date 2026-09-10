/**
 * Fuwa ships no telemetry. This module keeps Tolaria's path and `trackEvent`
 * signature so call sites and the carried `vi.mock('../lib/telemetry')` calls
 * resolve; every event is dropped on the floor.
 */

export type ProductAnalyticsEventName = string
export type ProductAnalyticsProperties = Record<string, string | number>

export function trackEvent(name: ProductAnalyticsEventName, properties?: ProductAnalyticsProperties): void {
  void name
  void properties
}
