import * as path from "../lib/path"
import { Resolver } from "./resolver"
import { Tar } from "./tar"

type Module = any // eslint-disable-line @typescript-eslint/no-explicit-any

export interface FileReader {
  exists(filePath: string): boolean
  read(filePath: string): string
}

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
    // Use just the last element of the resolve path for the custom module name.
    const customModName = path.basename(importPath)
    if (this.customModules.has(customModName)) {
      return this.customModules.get(customModName)
    }

    const resolvedPath = this.resolvePath(importPath, directoryPath)
    if (this.requireCache.has(resolvedPath)) {
      return this.requireCache.get(resolvedPath).exports
    }

    // Provide globals that can be referenced in the `eval`.
    const module = { exports: {} }
    let exports = module.exports

    /* eslint-disable @typescript-eslint/no-unused-vars */
    // @ts-ignore
    const __dirname = path.dirname(resolvedPath)

    // @ts-ignore
    const require = (target: string): Module => {
      const nativeModule = this.tryNativeRequire(target)
      if (typeof nativeModule !== "undefined" && nativeModule !== null) {
        return nativeModule
      }
      return this.doRequire(target, path.dirname(resolvedPath))
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */

    const content = this.readFile(resolvedPath)
    if (/\.json$/.test(resolvedPath)) {
      exports = JSON.parse(content)
    } else {
      eval(`'use strict'; ${content}`)
    }

    if (Object.keys(exports).length > 0) {
      this.requireCache.set(resolvedPath, { exports })
    }

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

  protected readFile(filePath: string): string {
    return this.reader.read(filePath)
  }
}

/**
 * Return a readable and requirable file system from a tar.
 */
export const fromTar = (content: Uint8Array): RequireFS => {
  const tar = Tar.fromUint8Array(content)
  return new RequireFS({
    exists: (filePath: string): boolean => {
      return !/\/$/.test(filePath) && !!tar.getFile(filePath)
    },
    read: (filePath: string): string => {
      const file = tar.getFile(filePath)
      if (!file) {
        throw new Error(`"${filePath}" does not exist`)
      }
      return file.read("utf8")
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
    read: (filePath: string): string => {
      const file = zip.file(filePath)
      if (!file) {
        throw new Error(`"${filePath}" does not exist`)
      }
      return zip.file(filePath).asText()
    },
  })
}
