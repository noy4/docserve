import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_PORT, normalizeArgv, parsePort } from "../src/node/cli/args.mjs"

const argv = (...args) => ["node", "bin.mjs", ...args]

describe("cli args", () => {
  it("defaults to the start command", () => {
    assert.deepEqual(normalizeArgv(argv()), argv("start"))
    assert.deepEqual(normalizeArgv(argv("./docs")), argv("start", "./docs"))
  })

  it("keeps an explicit command", () => {
    assert.deepEqual(normalizeArgv(argv("start", "./docs")), argv("start", "./docs"))
    assert.deepEqual(normalizeArgv(argv("stop")), argv("stop"))
    assert.deepEqual(normalizeArgv(argv("status")), argv("status"))
  })

  it("moves a trailing subcommand in front of the folder", () => {
    assert.deepEqual(normalizeArgv(argv("./docs", "stop")), argv("stop", "./docs"))
    assert.deepEqual(normalizeArgv(argv("./docs", "status")), argv("status", "./docs"))
  })

  it("skips option values when finding the folder", () => {
    assert.deepEqual(normalizeArgv(argv("--port", "4300", "./docs")), argv("--port", "4300", "start", "./docs"))
    assert.deepEqual(normalizeArgv(argv("--port=4300", "./docs")), argv("--port=4300", "start", "./docs"))
    assert.deepEqual(normalizeArgv(argv("--open", "./docs")), argv("--open", "start", "./docs"))
  })

  it("leaves help and version alone", () => {
    assert.deepEqual(normalizeArgv(argv("--help")), argv("--help"))
    assert.deepEqual(normalizeArgv(argv("--version")), argv("--version"))
  })

  it("parses ports", () => {
    assert.equal(parsePort(undefined), DEFAULT_PORT)
    assert.equal(parsePort("4300"), 4300)
    assert.equal(parsePort(4300), 4300)
  })

  it("rejects invalid ports", () => {
    for (const value of ["0", "65536", "abc", "42.5", ""]) {
      assert.throws(() => parsePort(value), /--port expects an integer/)
    }
  })
})