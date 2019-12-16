import * as path from "./path"
import { Resolver } from "./resolver"
import { Tar } from "./tar"

type Module = any // eslint-disable-line @typescript-eslint/no-explicit-any

export interface FileReader {
  exists(filePath: string): boolean
  read(filePath: string, encoding?: "utf8"): string | Uint8Array
}

const originalExports = Symbol("originalExports")

/**
 * Allow requiring modules and files from a provided file system.
 */
export class RequireFS extends Resolver {
  private readonly reader: FileReader
  private readonly customModules: Map<string, Module>
  private readonly requireCache: Map<string, Module>

  public constructor(reader: FileReader) {
    super()
    this.reader = reader
    this.customModules = new Map()
    this.requireCache = new Map()
  }

  /**
   * Provide a custom module.
   */
  public provide(moduleName: string, value: Module): void {
    if (this.customModules.has(moduleName)) {
      throw new Error("custom module has already been registered with this name")
    }
    this.customModules.set(moduleName, value)
  }

  /**
   * Require a path relative to the root.
   */
  public require(target: string): Module {
    return this.doRequire(`./${path.normalize(target)}`, "./")
  }

  /**
   * Attempt to require the provided path. If the path requires another path, it
   * will recursively follow the dependency tree and return any exported data.
   */
  private doRequire(importPath: string, directoryPath: string): Module {
    if (this.customModules.has(importPath)) {
      return this.customModules.get(importPath)
    }

    const resolvedPath = this.resolvePath(importPath, directoryPath)
    if (this.requireCache.has(resolvedPath)) {
      return this.requireCache.get(resolvedPath).exports
    }

    // Provide globals that can be referenced in the `eval`.
    let exports = {}
    const module = { exports, [originalExports]: exports }

    // We must do this immediately in case of circular imports. This means that
    // a circular import can't catch reassigned values but it's better than
    // failing.
    this.requireCache.set(resolvedPath, { exports })

    /* eslint-disable @typescript-eslint/no-unused-vars */
    // @ts-ignore
    const __dirname = path.dirname(resolvedPath)

    // Some modules will try to use `define` if it exists (lodash) and we only
    // want modules using our custom-provided `require` function.
    // @ts-ignore
    const define = undefined

    // @ts-ignore
    const require = (target: string): Module => {
      const nativeModule = this.tryNativeRequire(target)
      if (typeof nativeModule !== "undefined" && nativeModule !== null) {
        return nativeModule
      }
      return this.doRequire(target, path.dirname(resolvedPath))
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */

    const content = this.readFile(resolvedPath, "utf8")
    if (/\.json$/.test(resolvedPath)) {
      exports = JSON.parse(content)
    } else {
      eval(`'use strict'; ${content}`)
      // Both `exports` and `module.exports` might be reassigned so try using
      // whatever was reassigned or isn't empty.
      if (
        exports === module[originalExports] &&
        (module.exports !== module[originalExports] ||
          (exports !== module.exports && Object.keys(module.exports).length > 0))
      ) {
        exports = module.exports
      }
    }

    // Set it again in case it was reassigned.
    this.requireCache.set(resolvedPath, { exports })

    return exports
  }

  /**
   * Require a module using NodeJS's `module.require`. Note that script runners
   * (e.g. Jest, which uses `resolve.Sync` under the hood) may interfere.
   */
  private tryNativeRequire(modulePath: string): Module {
    try {
      return require(modulePath)
    } catch (e) {
      // Don't throw here. The module may be retrievable in another way.
    }
  }

  protected isFile(filePath: string): boolean {
    return this.reader.exists(filePath)
  }

  public readFile(filePath: string): Uint8Array
  public readFile(filePath: string, encoding: "utf8"): string
  public readFile(filePath: string, encoding?: "utf8"): string | Uint8Array {
    return this.reader.read(filePath, encoding)
  }
}

/**
 * Return a readable and requirable file system from a tar.
 */
export const fromTar = (content: Uint8Array): RequireFS => {
  const tar = Tar.fromUint8Array(content)
  return new RequireFS({
    exists: (filePath: string): boolean => {
      return !!tar.getFile(filePath)
    },
    read: (filePath: string, encoding?: "utf8"): string | Uint8Array => {
      const file = tar.getFile(filePath)
      if (!file) {
        throw new Error(`"${filePath}" does not exist`)
      }
      return encoding ? file.read(encoding) : file.read()
    },
  })
}

/**
 * Return a readable and requirable file system from a zip.
 */
export const fromZip = (content: Uint8Array): RequireFS => {
  // @ts-ignore
  const zip = new (require("jszip") as typeof import("jszip"))(content)
  return new RequireFS({
    exists: (filePath: string): boolean => {
      return !!zip.file(filePath)
    },
    read: (filePath: string, encoding?: "utf8"): string | Uint8Array => {
      const file = zip.file(filePath)
      if (!file) {
        throw new Error(`"${filePath}" does not exist`)
      }
      return encoding ? zip.file(filePath).asText() : zip.file(filePath).asUint8Array()
    },
  })
}
