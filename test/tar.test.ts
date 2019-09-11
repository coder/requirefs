import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import * as util from "util"
import { Tar } from "../src/tar"

describe("tar", () => {
  let tar: Tar
  before(async () => {
    const content = await util.promisify(fs.readFile)(path.join(__dirname, "lib.tar"))
    tar = Tar.fromUint8Array(content)
  })

  it("should get and read files", async () => {
    const libPath = path.join(__dirname, "lib")

    const testDirectory = async (dirPath: string): Promise<void> => {
      const children = await util.promisify(fs.readdir)(dirPath)
      for (let i = 0; i < children.length; ++i) {
        const absolutePath = path.join(dirPath, children[i])
        let relativePath = path.normalize(path.relative(libPath, absolutePath))
        const stat = await util.promisify(fs.stat)(absolutePath)
        if (stat.isDirectory()) {
          relativePath += "/"
          testDirectory(absolutePath)
        }
        const file = tar.getFile(relativePath)
        assert.notEqual(file, undefined)
        if (file && stat.isFile()) {
          assert.deepEqual(file.read(), await util.promisify(fs.readFile)(absolutePath))
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    assert.equal(tar.getFile("./")!.header.name, "./")
    await testDirectory(libPath)
  })
})
