export async function requestOrThrow<T>(request: IDBRequest<T>) {
  return new Promise<T>((ok, err) => {
    request.onsuccess = () => ok(request.result)
    request.onerror = () => err(request.error)
  })
}

export async function openOrThrow(request: IDBOpenDBRequest) {
  return new Promise<IDBDatabase>((ok, err) => {
    request.onblocked = (cause) => err(new Error("Blocked", { cause }))
    request.onsuccess = () => ok(request.result)
    request.onerror = () => err(request.error)
  })
}