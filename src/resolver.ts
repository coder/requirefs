import * as path from "./path"

export abstract class Resolver {
  private _extensions: string[] = []

  public constructor() {
    this.extensions = [".js"]
  }

  /**
   * The list of acceptable extensions for resolving module files.
   */
  public set extensions(extensions: string[]) {
    this._extensions = extensions.map((extension) => {
      return /^\./.test(extension) ? extension : `.${extension}`
    })
  }

  protected abstract isFile(filePath: string): boolean

  protected abstract readFile(filePath: string): Uint8Array
  protected abstract readFile(filePath: string, encoding: "utf8"): string

  /**
   * Normalize and resolve importPath from directoryPath.
   */
  protected resolvePath(importPath: string, directoryPath: string): string {
    const basePath = path.normalize(directoryPath)
    if (this.isRelativePath(importPath)) {
      const candidate = this.maybeResolvePath(importPath, basePath)
      if (candidate) {
        return candidate
      }
    } else {
      const candidate = this.maybeResolveModule(importPath, basePath)
      if (candidate) {
        return candidate
      }
    }

    throw new Error(`Unable to resolve ${importPath} from ${directoryPath}`)
  }

  private isRelativePath(importPath: string): boolean {
    return /^\.\.?(\/|$)/.test(importPath)
  }

  private maybeResolvePath(importPath: string, basePath: string): string | undefined {
    const filePath = path.join(basePath, importPath)
    return this.maybeResolveFile(filePath) || this.maybeResolveDirectory(filePath)
  }

  /**
   * Try the raw path and all the valid extensions.
   */
  private maybeResolveFile(filePath: string): string | undefined {
    if (this.isFile(filePath)) {
      return filePath
    }

    for (let i = 0; i < this._extensions.length; ++i) {
      const withExt = `${filePath}${this._extensions[i]}`
      if (this.isFile(withExt)) {
        return withExt
      }
    }

    return undefined
  }

  /**
   * Try resolving using `package.json` inside a directory. If there is no
   * `package.json` or no `module` nor `main` specified within it, load the
   * index file if there is one instead.
   */
  private maybeResolveDirectory(directoryPath: string): string | undefined {
    const json = this.maybeGetPackageJson(directoryPath)
    const name = json && (json.module || json.main) || "index"
    return this.maybeResolveFile(path.join(directoryPath, name))
  }

  /**
   * Try resolving a module by traversing upwards and looking into the
   * `node_modules` it encounters along the way.
   */
  private maybeResolveModule(importPath: string, basePath: string): string | undefined {
    const nodeModulePath = path.join(basePath, "node_modules")
    const candidate = this.maybeResolvePath(importPath, nodeModulePath)
    if (candidate) {
      return candidate
    }

    const dirname = path.dirname(basePath)
    return dirname !== basePath ? this.maybeResolveModule(importPath, dirname) : undefined
  }

  /**
   * Try getting a `package.json` from a directory.
   */
  private maybeGetPackageJson(directoryPath: string): { main?: string, module?: string } | undefined {
    const jsonPath = path.join(directoryPath, "package.json")
    if (this.isFile(jsonPath)) {
      const body = this.readFile(jsonPath, "utf8")
      try {
        return JSON.parse(body)
      } catch (e) {
        // Ignore JSON errors.
      }
    }
    return undefined
  }
}
