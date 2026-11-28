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
  looksLikeBibleSlide,
  parseProPathsContent,
  parseRtfMetadata,
  decodeTextElement,
  decodeMediaVideoProperties,
  extractUrlFields,
  isLocalProPresenterHost
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

  it("parses PathSettings.proPaths across classic ProPresenter 7 and newer Workspaces formats", () => {
    const classic = `Base=D:\\Gereja\\ProPresenter;\nMedia=E:\\WorshipMedia;\n`;
    const parsedClassic = parseProPathsContent(classic);
    expect(parsedClassic.workspaces).toContain("D:\\Gereja\\ProPresenter");
    expect(parsedClassic.mediaDirs).toContain("E:\\WorshipMedia");

    const modern = `SelectedWorkspace=Ibadah Utama;\nWorkspaces=["{\\"Name\\":\\"Default\\",\\"Path\\":\\"C:\\\\\\\\Users\\\\\\\\A\\\\\\\\Documents\\\\\\\\ProPresenter\\"}","{\\"Name\\":\\"Ibadah Utama\\",\\"Path\\":\\"D:\\\\\\\\ProPresenter_Main\\"}"];`;
    const parsedModern = parseProPathsContent(modern);
    expect(parsedModern.workspaces[0]).toBe("D:\\ProPresenter_Main");
    expect(parsedModern.workspaces).toContain("C:\\Users\\A\\Documents\\ProPresenter");
  });

  it("extracts dominant RTF font size and ignores trailing newline size overrides", () => {
    const rtf =
      "{\\rtf1{\\fonttbl\\f0\\fnil Montserrat-Bold;}{\\colortbl;\\red255\\green255\\blue255;}\\qc\\f0\\fs112\\cf1 Kudus Kudus Kudus Tuhan\\par\\fs200 }";
    const meta = parseRtfMetadata(rtf);
    expect(meta.fontSize).toBe(56);
    expect(meta.hasDominantFontSize).toBe(true);
    expect(meta.fontPostscript).toBe("Montserrat-Bold");
    expect(meta.textAlign).toBe("center");
  });

  it("prefers dominant RTF font size over stale attrField size and decodes scale_behavior", () => {
    const encodeVarint = (n) => {
      const out = [];
      let v = n >>> 0;
      while (v >= 0x80) {
        out.push((v & 0x7f) | 0x80);
        v >>>= 7;
      }
      out.push(v);
      return Buffer.from(out);
    };
    const encodeLen = (fn, payloadBuf) =>
      Buffer.concat([encodeVarint((fn << 3) | 2), encodeVarint(payloadBuf.length), payloadBuf]);
    const encodeDouble = (fn, val) => {
      const b = Buffer.alloc(8);
      b.writeDoubleLE(val, 0);
      return Buffer.concat([encodeVarint((fn << 3) | 1), b]);
    };
    const encodeVarintField = (fn, val) =>
      Buffer.concat([encodeVarint((fn << 3) | 0), encodeVarint(val)]);

    // Font message: field 2 = 96.0 (stale large template size), field 9 = "Arial"
    const fontMsg = Buffer.concat([
      encodeDouble(2, 96),
      encodeLen(9, Buffer.from("Arial", "utf8"))
    ]);
    // Attributes message: field 1 = fontMsg
    const attrMsg = encodeLen(1, fontMsg);
    // RTF with actual edited size 54pt (\fs108)
    const rtf = Buffer.from(
      "{\\rtf1{\\fonttbl\\f0\\fnil Arial;}\\fs108 Haleluya Puji Tuhan}",
      "utf8"
    );
    // Graphics.Text: field 3 = attrMsg, field 5 = rtf, field 7 = scale_behavior (2 = scale-down)
    const textMsg = Buffer.concat([
      encodeLen(3, attrMsg),
      encodeLen(5, rtf),
      encodeVarintField(7, 2)
    ]);

    const decoded = decodeTextElement(textMsg);
    expect(decoded.fontSize).toBe(54);
    expect(decoded.scaleBehavior).toBe("scale-down");
  });

  it("decodes URL local.root enum and identifies local vs remote ProPresenter hosts", () => {
    // LocalRelativePath: field 1 = 7 (USER_VIDEOS), field 2 = "BG/Loop.mp4"
    const localBuf = Buffer.concat([
      Buffer.from([0x08, 0x07]),
      Buffer.from([0x12, 11]),
      Buffer.from("BG/Loop.mp4", "utf8")
    ]);
    // URL: field 4 = localBuf
    const urlBuf = Buffer.concat([Buffer.from([0x22, localBuf.length]), localBuf]);
    const parsed = extractUrlFields(urlBuf);
    expect(parsed.localRoot).toBe(7);
    expect(parsed.relativePath).toBe("BG/Loop.mp4");

    expect(isLocalProPresenterHost("127.0.0.1")).toBe(true);
    expect(isLocalProPresenterHost("localhost")).toBe(true);
    expect(isLocalProPresenterHost("")).toBe(true);
    expect(isLocalProPresenterHost("198.51.100.42")).toBe(false);
  });

  it("decodes Slide Video scale_behavior and end_behavior (loop vs stop-on-clear)", () => {
    const encodeVarint = (n) => Buffer.from([n & 0x7f]);
    const encodeLen = (fn, payloadBuf) =>
      Buffer.concat([encodeVarint((fn << 3) | 2), encodeVarint(payloadBuf.length), payloadBuf]);
    const encodeVarintField = (fn, val) =>
      Buffer.concat([encodeVarint((fn << 3) | 0), encodeVarint(val)]);

    // DrawingProperties: field 1 = 1 (SCALE_TO_FILL -> cover)
    const drawingCover = encodeVarintField(1, 1);
    // TransportProperties: field 15 = 3 (STOP_ON_CLEAR -> loop=false, clearOnEnd=true)
    const transportStopClear = encodeVarintField(15, 3);
    // VideoTypeProperties (field 6 of Graphics.Media): field 1 = drawing, field 3 = transport
    const videoProps1 = Buffer.concat([encodeLen(1, drawingCover), encodeLen(3, transportStopClear)]);
    const mediaFields1 = parseProtoFields(encodeLen(6, videoProps1));
    expect(decodeMediaVideoProperties(mediaFields1)).toEqual({
      objectFit: "cover",
      loop: false,
      clearOnEnd: true
    });

    // TransportProperties: field 15 = 1 (LOOP -> loop=true, clearOnEnd=false), default drawing -> contain
    const videoProps2 = encodeLen(3, encodeVarintField(15, 1));
    const mediaFields2 = parseProtoFields(encodeLen(6, videoProps2));
    expect(decodeMediaVideoProperties(mediaFields2)).toEqual({
      objectFit: "contain",
      loop: true,
      clearOnEnd: false
    });
  });

  it("decodes ProPresenter paragraph lineSpacing, paragraphSpacing, and RTF spacing tags", () => {
    const encodeVarint = (n) => {
      const out = [];
      let v = n >>> 0;
      while (v >= 0x80) {
        out.push((v & 0x7f) | 0x80);
        v >>>= 7;
      }
      out.push(v);
      return Buffer.from(out);
    };
    const encodeLen = (fn, payloadBuf) =>
      Buffer.concat([encodeVarint((fn << 3) | 2), encodeVarint(payloadBuf.length), payloadBuf]);
    const encodeDouble = (fn, val) => {
      const b = Buffer.alloc(8);
      b.writeDoubleLE(val, 0);
      return Buffer.concat([encodeVarint((fn << 3) | 1), b]);
    };

    // Paragraph message: field 5 (lhm) = 1.0, field 7 (minLh dummy) = 1.0, field 8 (lineSpacing) = 10, field 9 (paragraphSpacing) = 18
    const paraMsg = Buffer.concat([
      encodeDouble(5, 1.0),
      encodeDouble(7, 1.0),
      encodeDouble(8, 10.0),
      encodeDouble(9, 18.0)
    ]);
    const attrMsg = encodeLen(6, paraMsg);
    const rtfFromProto = Buffer.from(
      "{\\rtf1{\\fonttbl\\f0\\fnil Montserrat-Bold;}\\pard\\f0\\fs140 Saudara yang dikasihi Tuhan}",
      "utf8"
    );
    const decodedProto = decodeTextElement(
      Buffer.concat([encodeLen(3, attrMsg), encodeLen(5, rtfFromProto)])
    );
    expect(decodedProto.lineHeightMultiple).toBe(1.0);
    expect(decodedProto.minimumLineHeight).toBe(0);
    expect(decodedProto.lineSpacing).toBe(10);
    expect(decodedProto.paragraphSpacing).toBe(18);

    // RTF override with \sl360\slmult1 (1.5x), \slleading200 (10pt), \sa240 (12pt), \sb80 (4pt)
    const rtfOverride =
      "{\\rtf1{\\fonttbl\\f0\\fnil Montserrat-Bold;}\\pard\\sl360\\slmult1\\slleading200\\sa240\\sb80\\f0\\fs140 Votum dan Salam}";
    const rtfMeta = parseRtfMetadata(rtfOverride);
    expect(rtfMeta.lineHeightMultiple).toBe(1.5);
    expect(rtfMeta.lineSpacing).toBe(10);
    expect(rtfMeta.paragraphSpacing).toBe(12);
    expect(rtfMeta.paragraphSpacingBefore).toBe(4);
  });

  it("decodes RTF superscript verse numbers (\\super and smaller inline \\fs) and multi-size lines", () => {
    const rtfSuper =
      "{\\rtf0{\\fonttbl\\f0\\fnil BritannicBold;}\\pard\\f0\\fs160\\super 16\\nosupersub  Karena begitu besar kasih Allah}";
    const metaSuper = parseRtfMetadata(rtfSuper);
    expect(metaSuper.fontSize).toBe(80);
    expect(metaSuper.plainText).toBe("¹⁶ Karena begitu besar kasih Allah");

    const rtfSmallerInline =
      "{\\rtf0{\\fonttbl\\f0\\fnil Montserrat-Bold;}\\pard\\f0\\fs84 19 \\fs140 Pada waktu itu datanglah Yesus}";
    const metaInline = parseRtfMetadata(rtfSmallerInline);
    expect(metaInline.fontSize).toBe(70);
    expect(metaInline.plainText).toBe("¹⁹ Pada waktu itu datanglah Yesus");

    const rtfMultiLineSizes =
      "{\\rtf0{\\fonttbl\\f0\\fnil Montserrat-Bold;}\\pard\\f0\\fs180 GOODNESS OF GOD\\par\\pard\\f0\\fs130 Bethel Music}";
    const metaMulti = parseRtfMetadata(rtfMultiLineSizes);
    expect(metaMulti.fontSize).toBe(90);
    expect(metaMulti.lineFontScales).toEqual([1, Number((65 / 90).toFixed(4))]);
  });
});
