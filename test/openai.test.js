import test from "node:test";
import assert from "node:assert/strict";
import { extractOutputText } from "../src/openai.js";

test("extracts text from a Responses API payload", () => {
  const payload = {
    output: [
      { type: "reasoning", content: [] },
      { type: "message", content: [{ type: "output_text", text: "hello" }] },
    ],
  };
  assert.equal(extractOutputText(payload), "hello");
});
