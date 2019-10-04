import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import * as util from "util"
import { fromTar, fromZip, RequireFS } from "../src/requirefs"

const tests = ["zip", "tar"]
for (let i = 0; i < tests.length; ++i) {
  const name = tests[i]
  describe(`requirefs: ${name}`, () => {
    let rfs: RequireFS
    before(async () => {
      const content = await util.promisify(fs.readFile)(path.join(__dirname, `lib.${name}`))
      rfs = name === "tar" ? fromTar(content) : fromZip(content)
    })

    beforeEach(() => {
      rfs.extensions = [".js"]
    })

    it("should parse individual module", () => {
      assert.equal(rfs.require("individual.js").frog, "hi")
    })

    it("should read individual module from cache", () => {
      assert.equal(rfs.require("./individual.js").frog, "hi")
    })

    it("should parse chained modules", () => {
      assert.equal(rfs.require("chained-1").text, "moo")
    })

    it("should parse through subfolders", () => {
      assert.equal(rfs.require("subfolder").orangeColor, "blue")
    })

    it("should parse subfolder's package.json by inference", () => {
      assert.equal(rfs.require("subfolder/").frog, "hi")
    })

    it("should parse subfolder's package.json", () => {
      assert.equal(rfs.require("subfolder/package.json").name, "subfolder")
    })

    it("should be able to move up directories", () => {
      assert.equal(rfs.require("subfolder/goingUp").frog, "hi")
    })

    it("should resolve node_modules", () => {
      assert.equal(rfs.require("nodeResolve").banana, "potato")
    })

    it("should resolve nested node_modules", () => {
      assert.equal(rfs.require("subfolder/deepfolder/nodeResolveNested").banana, "potato")
    })

    it("should resolve local node_modules first", () => {
      assert.equal(rfs.require("subfolder/deepfolder/nodeResolveOverload"), "local value")
    })

    it("should access global scope", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(global as any).coder = {
        test: "hi",
      }
      assert.equal(rfs.require("scope"), "hi")
    })

    it("should find custom module", () => {
      rfs.provide("donkey", "ok")
      assert.equal(rfs.require("customModule"), "ok")
    })

    it("should read custom module from cache", () => {
      assert.equal(rfs.require("./customModule"), "ok")
    })

    it("should require non-default file extensions", () => {
      rfs.extensions = [".ts"]
      assert.equal(rfs.require("./tsFile").obi, "Why, hello there!")
    })

    it("should require core 'path' module", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      assert.equal(rfs.require("./requirePath"), require("path"))
    })

    it("should resolve root", () => {
      assert.equal(rfs.require("."), "root")
    })

    it("should require function exported with module.exports", () => {
      assert.deepEqual(rfs.require("./function"), { test: "test", fn: "function" })
    })

    it("should resolve circular imports", () => {
      assert.deepEqual(rfs.require("./circular"), { circular: "hello", ralucric: "hello" })
    })
  })
}
