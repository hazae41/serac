# Serac

Garbage-collectable persistent key-value database for TypeScript

```bash
npm i @hazae41/serac
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/serac)

## Features

### Current features
- 100% TypeScript and ESM
- No external dependencies
- Garbage collection

## Usage

```tsx
import { Database } from "@hazae41/serac";

const database = await Database.openOrThrow("example", 1, () => { })

await database.setOrThrow("kaaa", "vaaa", Date.now())
await database.setOrThrow("kbbb", "vbbb", Date.now() + 1000)
await database.setOrThrow("kccc", "vccc", Date.now() - 1000)

console.log(await database.getOrThrow("kaaa")) // null
console.log(await database.getOrThrow("kbbb")) // "vbbb"
console.log(await database.getOrThrow("kccc")) // null

for await (const value of database.collectOrThrow())
  console.log("Garbage collected", value)

console.log("Garbage collection done")
```