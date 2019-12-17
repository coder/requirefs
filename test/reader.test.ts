import * as assert from "assert"
import * as fs from "fs"
import * as util from "util"
import { Reader } from "../src/reader"

class TestDecoder {
  public static called = 0
  private decoder = new (require("text-encoding")).TextDecoder()

  public decode(data: Uint8Array): string {
    ++TestDecoder.called
    return this.decoder.decode(data)
  }
}

describe("reader", () => {
  const content = Buffer.from("foo bar baz qux garply waldo fred plugh xyzzy thud mumble frobnozzle")
  const reader = new Reader(content)

  after(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).TextDecoder = undefined
  })

  it("should have the offset at zero", () => {
    assert.equal(reader.offset, 0)
  })

  it("should read foo bar baz qux", () => {
    assert.deepEqual(reader.read(3), Buffer.from("foo"))
    assert.deepEqual(reader.read(4), Buffer.from(" bar"))
    assert.deepEqual(reader.read(4), Buffer.from(" baz"))
    assert.deepEqual(reader.read(4), Buffer.from(" qux"))
  })

  it("should peek", () => {
    assert.deepEqual(reader.peek(7), Buffer.from(" garply"))
    assert.deepEqual(reader.peek(7), Buffer.from(" garply"))
  })

  it("should jump to foo", () => {
    assert.deepEqual(reader.jump(0).read(3), Buffer.from("foo"))
    assert.deepEqual(reader.jump(0).read(3), Buffer.from("foo"))
  })

  it("should clamp to waldo", () => {
    reader.jump(23).clamp()
    assert.deepEqual(reader.jump(0).read(5), Buffer.from("waldo"))
    assert.deepEqual(reader.jump(0).read(5), Buffer.from("waldo"))
  })

  it("should unclamp", () => {
    reader.unclamp()
    assert.deepEqual(reader.jump(0).read(3), Buffer.from("foo"))
  })

  it("should decode", () => {
    assert.equal(reader.read(10, "utf8"), " bar baz q")
  })

  it("should skip", () => {
    reader.skip(10)
    assert.equal(reader.read(10, "utf8"), "waldo fred")
  })

  it("should error if reading past end", () => {
    assert.throws(() => reader.jump(1000).read(5), /EOF/)
    assert.equal(reader.offset, 1000)
  })

  it("should work with file buffer", async () => {
    const newReader = new Reader(await util.promisify(fs.readFile)(__filename))
    assert.equal(newReader.read(6, "utf8"), "import")
  })

  it("should use global TextDecoder if available", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).TextDecoder = TestDecoder
    const reader = new Reader(content)
    reader.peek(0, "utf8")
    assert.equal(TestDecoder.called, 1)
  })
})
