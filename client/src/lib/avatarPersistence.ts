export function awaitRequiredPersistence<T>(promise: Promise<T>, timeoutMs: number, reason: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => reject(new Error(reason)), timeoutMs);
    promise.then(
      (value) => { globalThis.clearTimeout(timeoutId); resolve(value); },
      (error) => { globalThis.clearTimeout(timeoutId); reject(error); },
    );
  });
}
