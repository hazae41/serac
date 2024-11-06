import { openOrThrow, requestOrThrow } from "libs/indexeddb/index.js";
import { Nullable } from "libs/nullable/index.js";

export interface Row<T> {
  readonly value: T
  readonly expiration: number
}

export class Database {

  constructor(
    readonly database: IDBDatabase
  ) { }

  static async openOrThrow(name: string, version: number, upgrader: (database: IDBDatabase, event: IDBVersionChangeEvent) => void) {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const database = request.result

      if (event.oldVersion === 0)
        database.createObjectStore("keyval").createIndex("expiration", "expiration")

      upgrader(database, event)
    }

    const database = await openOrThrow(request)

    return new Database(database)
  }

  async #transactOrThrow<T>(transactor: (store: IDBObjectStore) => Promise<T>, mode: IDBTransactionMode) {
    const transaction = this.database.transaction("keyval", mode, { durability: "strict" })

    try {
      const store = transaction.objectStore("keyval")
      const result = await transactor(store)
      transaction.commit()
      return result
    } catch (error) {
      transaction.abort()
      throw error
    }
  }

  async #getOrThrow<T>(store: IDBObjectStore, key: string) {
    const row = await requestOrThrow<Nullable<Row<T>>>(store.get(key))

    if (row == null)
      return

    if (row.expiration < Date.now())
      return

    return row.value
  }

  async #setOrThrow<T>(store: IDBObjectStore, key: string, value: T, expiration: number) {
    await requestOrThrow(store.put({ value, expiration }, key))
  }

  async #deleteOrThrow(store: IDBObjectStore, key: string) {
    await requestOrThrow(store.delete(key))
  }

  async getOrThrow<T>(key: string): Promise<Nullable<T>> {
    return this.#transactOrThrow(store => this.#getOrThrow<T>(store, key), "readonly")
  }

  async setOrThrow<T>(key: string, value: T, expiration: number): Promise<void> {
    return this.#transactOrThrow(store => this.#setOrThrow<T>(store, key, value, expiration), "readwrite")
  }

  async deleteOrThrow(key: string): Promise<void> {
    return this.#transactOrThrow(store => this.#deleteOrThrow(store, key), "readwrite")
  }

  async *collectOrThrow<T>() {
    const range = IDBKeyRange.upperBound(Date.now())

    while (true) {
      const row = await this.#transactOrThrow<Nullable<Row<T>>>(async store => {
        const slot = await requestOrThrow(store.index("expiration").openCursor(range))

        if (slot == null)
          return

        const row = slot.value

        await requestOrThrow(slot.delete())

        return row
      }, "readwrite")

      if (row == null)
        break

      yield row.value
    }
  }

}