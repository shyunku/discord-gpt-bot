import test from "node:test";
import assert from "node:assert/strict";
import { buildPresence } from "../src/presence.js";

test("builds a versioned custom Discord presence", () => {
  assert.deepEqual(buildPresence("1.0.1", 4), {
    status: "online",
    activities: [
      {
        name: "Cushion GPT 1.0.1",
        state: "Cushion GPT 1.0.1",
        type: 4,
      },
    ],
  });
});
