import { openOrThrow, requestOrThrow } from "libs/indexeddb/index.js";
import { Nullable } from "libs/nullable/index.js";
import { Upgrader } from "mods/upgrader/index.js";

export interface Row<T = unknown> {
  readonly value: T
  readonly expiration?: number
}

export class Database {

  constructor(
    readonly database: IDBDatabase
  ) { }

  static async openOrThrow(name: string, version: number, upgrader: Upgrader) {
    if (typeof indexedDB === "undefined")
      throw new Error("Not supported")

    const request = indexedDB.open(name, version)

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

  async #getOrThrow<T>(store: IDBObjectStore, key: IDBValidKey) {
    const row = await requestOrThrow<Nullable<Row<T>>>(store.get(key))

    if (row == null)
      return

    if (row.expiration == null)
      return row.value

    if (row.expiration < Date.now())
      return

    return row.value
  }

  async #setOrThrow(store: IDBObjectStore, key: IDBValidKey, value: unknown, expiration?: number) {
    await requestOrThrow(store.put({ value, expiration }, key))
  }

  async #deleteOrThrow(store: IDBObjectStore, key: IDBValidKey) {
    await requestOrThrow(store.delete(key))
  }

  async getOrThrow<T>(key: IDBValidKey): Promise<Nullable<T>> {
    return this.#transactOrThrow(store => this.#getOrThrow<T>(store, key), "readonly")
  }

  async setOrThrow(key: IDBValidKey, value: unknown, expiration?: number): Promise<void> {
    return this.#transactOrThrow(store => this.#setOrThrow(store, key, value, expiration), "readwrite")
  }

  async deleteOrThrow(key: IDBValidKey): Promise<void> {
    return this.#transactOrThrow(store => this.#deleteOrThrow(store, key), "readwrite")
  }

  async *collectOrThrow() {
    let range = IDBKeyRange.upperBound(Date.now(), true)

    while (true) {
      const cursor = await this.#transactOrThrow(async store => {
        return await requestOrThrow(store.index("expiration").openCursor(range))
      }, "readonly")

      if (cursor == null)
        break
      yield cursor.primaryKey

      range = IDBKeyRange.bound(cursor.key, Date.now(), true, true)
    }
  }

}