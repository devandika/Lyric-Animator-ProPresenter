import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseProtoFields,
  getAllFields,
  getField,
  decodeUuid
} = require("../propresenterThemeParser.cjs");

describe("propresenterThemeParser", () => {
  it("parses protobuf varint and length-delimited fields accurately", () => {
    // Field 1 (varint = 150 -> 0x08 0x96 0x01) + Field 2 (string "abc" -> 0x12 0x03 0x61 0x62 0x63)
    const buf = Buffer.from([0x08, 0x96, 0x01, 0x12, 0x03, 0x61, 0x62, 0x63]);
    const fields = parseProtoFields(buf);

    expect(getField(fields, 1)).toEqual({ fn: 1, wt: 0, val: 150 });
    expect(getField(fields, 2).val.toString("utf8")).toBe("abc");
    expect(getAllFields(fields, 1)).toEqual([{ fn: 1, wt: 0, val: 150 }]);
    expect(getField(fields, 99)).toBeNull();
  });

  it("decodes UUID buffers from nested protobuf field 1 or raw string", () => {
    // Field 1 (tag 0x0a) length 4, "uuid"
    const nested = Buffer.from([0x0a, 0x04, 0x75, 0x75, 0x69, 0x64]);
    expect(decodeUuid(nested)).toBe("uuid");
    expect(decodeUuid(Buffer.from("RAW-UUID", "utf8"))).toBe("raw-uuid");
    expect(decodeUuid(null)).toBe("");
  });
});
