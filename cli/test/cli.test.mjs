import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_PORT, parsePort } from "../src/node/cli/args.mjs"

describe("cli ports", () => {
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
