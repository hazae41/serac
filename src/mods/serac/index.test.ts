import { Database } from "./index.js";

const database = await Database.openOrThrow("example", 1, () => { })

await database.setOrThrow("kaaa", "vaaa", Date.now())
await database.setOrThrow("kbbb", "vbbb", Date.now() + 1000)
await database.setOrThrow("kccc", "vccc", Date.now() - 1000)

console.log(await database.getOrThrow("kaaa"))
console.log(await database.getOrThrow("kbbb"))
console.log(await database.getOrThrow("kccc"))

for await (const value of database.collectOrThrow())
  console.log("Garbage collected", value)

console.log("Garbage collection done")