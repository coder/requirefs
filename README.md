# requirefs

requirefs lets you create a readable and requirable file system from a custom
file system provider. For example, you could use this to run a Node package on
the browser by packing it into a tar and then loading that on the client through
requirefs.

Everything passed to the file system provider will use `/` as path separators.

```javascript
import { fromTar } from "./requirefs"

const response = await fetch(uri)
if (response.status !== 200) {
  throw new Error("failed to download")
}
const rfs = fromTar(new Uint8Array(await response.arrayBuffer()))
// Use rfs.provide() to provide any necessary modules.
rfs.require(".")
```

requirefs has no dependencies unless you use `fromZip` which requires `jszip`.
