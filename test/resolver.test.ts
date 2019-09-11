import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import { Resolver } from "../src/resolver"

class TestResolver extends Resolver {
  public isFile(filePath: string): boolean {
    if (!filePath.startsWith("/")) {
      filePath = path.join(__dirname, filePath)
    }
    try {
      return fs.statSync(filePath).isFile()
    } catch (error) {
      return false
    }
  }

  public readFile(filePath: string): string {
    if (!filePath.startsWith("/")) {
      filePath = path.join(__dirname, filePath)
    }
    return fs.readFileSync(filePath, "utf8")
  }

  public resolve(importPath: string, basePath: string): string {
    return super.resolvePath(importPath, basePath)
  }
}

describe("resolver", () => {
  const resolver = new TestResolver()

  it("should resolve relative paths", () => {
    assert.equal(
      resolver.resolve("./lib/scope", path.join(__dirname, "./index.js")),
      path.join(__dirname, "./lib/scope.js")
    )
    assert.equal(
      resolver.resolve("./scope", path.join(__dirname, "./lib/index.js")),
      path.join(__dirname, "./lib/scope.js")
    )
    assert.equal(
      resolver.resolve("./lib/subfolder/deepfolder/nodeResolveNested", path.join(__dirname, "index.js")),
      path.join(__dirname, "./lib/subfolder/deepfolder/nodeResolveNested.js")
    )
    assert.equal(
      resolver.resolve("../../baseFolder/baseModule", path.join(__dirname, "./lib/subfolder/deepfolder/index.js")),
      path.join(__dirname, "./lib/baseFolder/baseModule.js")
    )
    assert.equal(
      resolver.resolve("../goingUp", path.join(__dirname, "./lib/subfolder/deepfolder/index.js")),
      path.join(__dirname, "./lib/subfolder/goingUp.js")
    )
    assert.equal(
      resolver.resolve("./nodeResolveOverload", path.join(__dirname, "./lib/subfolder/deepfolder/index.js")),
      path.join(__dirname, "./lib/subfolder/deepfolder/nodeResolveOverload.js")
    )
  })

  it("should resolve non-relative paths", () => {
    assert.equal(
      resolver.resolve("frogger", path.join(__dirname, "./lib/index.js")),
      path.join(__dirname, "./lib/node_modules/frogger/index.js")
    )
    assert.equal(
      resolver.resolve("custom-overload", path.join(__dirname, "./lib/index.js")),
      path.join(__dirname, "./lib/node_modules/custom-overload/custom-overload.js")
    )
    assert.equal(
      resolver.resolve("mod", path.join(__dirname, "./lib/index.js")),
      path.join(__dirname, "./lib/node_modules/mod/index.js")
    )
  })

  it("should resolve using package.json", () => {
    assert.equal(resolver.resolve("./lib", path.join(__dirname, "./index.js")), path.join(__dirname, "./lib/index.js"))
    assert.throws(
      () => resolver.resolve("./lib/subfolder/deepfolder", path.join(__dirname, "index.js")),
      /Unable to resolve/ // Because `main` is a directory.
    )
  })

  it("should resolve using index", () => {
    assert.equal(
      resolver.resolve("./baseFolder", path.join(__dirname, "./lib/index.js")),
      path.join(__dirname, "./lib/baseFolder/index.js")
    )
  })

  it("should fail to resolve", () => {
    assert.throws(
      () => resolver.resolve("./does-not-exist", path.join(__dirname, "./lib/index.js")),
      /Unable to resolve/
    )
    assert.throws(
      () => resolver.resolve("./foobar", path.join(__dirname, "./lib/subfolder/deepfolder")),
      /Unable to resolve/
    )
  })

  it("should resolve with a relative base path", () => {
    assert.equal(resolver.resolve("./baseFolder", "./lib/index.js"), "lib/baseFolder/index.js")
    assert.equal(resolver.resolve("./lib/baseFolder", "."), "lib/baseFolder/index.js")
    assert.equal(resolver.resolve("./test/lib/baseFolder", "../index.js"), "../test/lib/baseFolder/index.js")
  })

  it("should normalized paths", () => {
    assert.equal(
      resolver.resolve(".////baseFolder/../baseFolder", ".///lib/baseFolder///../baseFolder///../index.js"),
      "lib/baseFolder/index.js"
    )
  })
})
