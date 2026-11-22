import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseProtoFields,
  getAllFields,
  getField,
  decodeUuid,
  buildFontFamilyStack,
  mapFontWeight,
  looksLikeBibleSlide
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

  it("prioritizes spaced DirectWrite/CoreText font names including acronyms", () => {
    const berlin = buildFontFamilyStack("BerlinSansFBDemi-Bold", "BerlinSansFBDemi-Bold");
    expect(berlin.startsWith('"Berlin Sans FB Demi",')).toBe(true);
    expect(berlin).toContain('"Berlin Sans FB"');

    const britannic = buildFontFamilyStack("BritannicBold", "BritannicBold");
    expect(britannic.startsWith('"Britannic Bold",')).toBe(true);

    // Trust explicit styleName from ProPresenter protobuf so Britannic Bold (Regular) stays 400
    // while Berlin Sans FB Demi (Bold) stays 700 matching Windows DirectWrite OS/2 weight classes.
    expect(mapFontWeight("Regular", false, "BritannicBold")).toBe(400);
    expect(mapFontWeight("Bold", true, "BerlinSansFBDemi-Bold")).toBe(700);
    expect(mapFontWeight("SemiBold", false, "Montserrat-SemiBold")).toBe(600);
    expect(mapFontWeight("", false, "Arial-Bold")).toBe(700);
  });

  it("detects Bible slides regardless of reference line position or separator", () => {
    expect(looksLikeBibleSlide("", "Matius 1:1-25\r1Inilah silsilah")).toBe(true);
    expect(looksLikeBibleSlide("", "16Karena begitu besar kasih Allah\u001FYohanes 3:16")).toBe(true);
    expect(looksLikeBibleSlide("", "09:00\nIbadah dimulai")).toBe(false);
    expect(looksLikeBibleSlide("C:\\ProPresenter\\Song.pro", "Matius 1:1")).toBe(false);
  });
});
