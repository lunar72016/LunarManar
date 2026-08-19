export function isResizeObserverLoopWarning(message: string | undefined): boolean {
  return Boolean(message && /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(message));
}
