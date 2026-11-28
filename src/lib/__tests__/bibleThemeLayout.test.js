import { describe, it, expect } from "vitest";
import {
  buildTextBoxVisuals,
  doesThemeHaveSlideMedia,
  doesThemeHaveSlideVideo,
  formatBibleVerseNumbers,
  resolveLayoutTextSlots
} from "../../components/ThemedLyricStage.jsx";
import { computeProPresenterLineHeight } from "../../components/LiveLyricStage.jsx";

describe("Bible Theme 1:1 Layout & Superscript Verse Numbers", () => {
  it("converts attached and space-separated leading verse numbers to superscript while leaving normal numbers and references alone", () => {
    expect(
      formatBibleVerseNumbers("1Inilah silsilah Yesus Kristus, anak Daud, anak Abraham.")
    ).toBe("¹Inilah silsilah Yesus Kristus, anak Daud, anak Abraham.");
    expect(
      formatBibleVerseNumbers("16 Karena begitu besar kasih Allah. 17 Sebab Allah mengutus Anak-Nya.")
    ).toBe("¹⁶ Karena begitu besar kasih Allah. ¹⁷ Sebab Allah mengutus Anak-Nya.");
    expect(
      formatBibleVerseNumbers('23 "Sesungguhnya, anak dara itu akan mengandung"')
    ).toBe('²³ "Sesungguhnya, anak dara itu akan mengandung"');
    // Reference lines (including numbered books like "1 Yohanes 4:8") and mid-sentence quantities stay untouched
    expect(formatBibleVerseNumbers("1 Yohanes 4:8")).toBe("1 Yohanes 4:8");
    expect(formatBibleVerseNumbers("Matius 1:1-25")).toBe("Matius 1:1-25");
    expect(formatBibleVerseNumbers("Ia berpuasa selama 40 hari dan 40 malam.")).toBe(
      "Ia berpuasa selama 40 hari dan 40 malam."
    );
  });

  it("splits Reference and Verse into their exact Bible Theme textboxes", () => {
    const bibleThemeInfo = {
      source: "bible-theme",
      themeName: "Alkitab",
      biblePrefs: {
        verseBoxUuid: "verse-uuid",
        referenceBoxUuid: "ref-uuid",
        verseBoxName: "Ini isi ayatnya",
        referenceBoxName: "Ayat 1:1",
        showVerseNumbers: true
      },
      layout: {
        elements: [
          {
            id: "verse-uuid",
            isTextBox: true,
            bounds: { x: 392, y: 255, width: 1182, height: 524 },
            text: { plainText: "Ini isi ayatnya" }
          },
          {
            id: "ref-uuid",
            isTextBox: true,
            bounds: { x: 481, y: 150, width: 502, height: 104 },
            text: { plainText: "Ayat 1:1" }
          }
        ]
      }
    };

    const slots = resolveLayoutTextSlots(
      bibleThemeInfo,
      "Matius 1:1-25\n1Inilah silsilah Yesus Kristus, anak Daud, anak Abraham."
    );

    expect(slots.primaryTextEl.id).toBe("verse-uuid");
    expect(slots.primaryText).toBe("¹Inilah silsilah Yesus Kristus, anak Daud, anak Abraham.");
    expect(slots.secondarySlots).toHaveLength(1);
    expect(slots.secondarySlots[0].element.id).toBe("ref-uuid");
    expect(slots.secondarySlots[0].text).toBe("Matius 1:1-25");

    // ProPresenter sends lone "\r" between reference and verse
    const crSlots = resolveLayoutTextSlots(
      bibleThemeInfo,
      "Matius 1:1-25\r1Inilah silsilah Yesus Kristus."
    );
    expect(crSlots.secondarySlots[0].text).toBe("Matius 1:1-25");
    expect(crSlots.primaryText).toBe("¹Inilah silsilah Yesus Kristus.");

    // Supports unit separator (\u001F) and reference placed on the last line (cross-device ReferenceType)
    const bottomRefSlots = resolveLayoutTextSlots(
      bibleThemeInfo,
      "16Karena begitu besar kasih Allah akan dunia ini.\u001FYohanes 3:16 (TB)"
    );
    expect(bottomRefSlots.secondarySlots[0].text).toBe("Yohanes 3:16 (TB)");
    expect(bottomRefSlots.primaryText).toBe("¹⁶Karena begitu besar kasih Allah akan dunia ini.");
  });

  it("does not leak cue fill boxes into a look-theme without fill and ignores alpha-0 fills", () => {
    const lookThemeTextEl = {
      id: "theme-tb",
      isTextBox: true,
      bounds: { x: 100, y: 100, width: 1720, height: 300 },
      fill: { enabled: false },
      textShape: { enabled: false },
      stroke: { enabled: false },
      shadow: { enabled: false },
      text: { plainText: "Sample", fontSize: 64, fontFamily: "Arial, sans-serif", fontWeight: 700 }
    };

    const cueWithFillBox = {
      id: "cue-tb",
      isTextBox: true,
      bounds: { x: 100, y: 100, width: 1720, height: 300 },
      fill: { enabled: true, type: "color", color: { r: 0, g: 0, b: 0, a: 1, css: "rgba(0, 0, 0, 1)" } },
      textShape: { enabled: true, cornerRadius: 8, padding: 20, offsetY: 0 },
      text: { plainText: "Lirik", fontSize: 64, fontFamily: "Arial, sans-serif", fontWeight: 700 }
    };

    // Look Theme override must NOT inherit the underlying cue's fill box or textShape
    const lookVisuals = buildTextBoxVisuals(lookThemeTextEl, 1920, 1080, cueWithFillBox, {
      inheritCueVisuals: false
    });
    expect(lookVisuals.lineBackground).toBeNull();
    expect(lookVisuals.hasBackdrop).toBe(false);

    // Transparent color fill (alpha = 0) must not render a pill/box
    const transparentFillEl = {
      ...lookThemeTextEl,
      fill: { enabled: true, type: "color", color: { r: 0, g: 0, b: 0, a: 0, css: "rgba(0, 0, 0, 0)" } }
    };
    const transparentVisuals = buildTextBoxVisuals(transparentFillEl, 1920, 1080, null);
    expect(transparentVisuals.lineBackground).toBeNull();
    expect(transparentVisuals.hasBackdrop).toBe(false);

    // textShape enabled WITHOUT fill enabled must NOT force a solid black box
    const textShapeWithoutFillEl = {
      ...lookThemeTextEl,
      fill: { enabled: false },
      textShape: { enabled: true, cornerRadius: 8, padding: 20, offsetY: 0 }
    };
    const noFillVisuals = buildTextBoxVisuals(textShapeWithoutFillEl, 1920, 1080, null);
    expect(noFillVisuals.lineBackground).toBeNull();
    expect(noFillVisuals.hasBackdrop).toBe(false);

    // Look Theme with 1 text box must strip fill/stroke/textShape if a secondary cue box falls back
    const lookThemeWithExtraCueBox = {
      source: "look-theme",
      layout: { elements: [lookThemeTextEl] },
      cueTextBoxes: [
        { ...cueWithFillBox, id: "cue-1", text: { plainText: "Baris Utama" } },
        { ...cueWithFillBox, id: "cue-2", text: { plainText: "Subjudul" } }
      ]
    };
    const lookSlots = resolveLayoutTextSlots(lookThemeWithExtraCueBox, "Baris Utama\nSubjudul");
    expect(lookSlots.secondarySlots).toHaveLength(1);
    expect(lookSlots.secondarySlots[0].element.fill.enabled).toBe(false);
    expect(lookSlots.secondarySlots[0].element.textShape.enabled).toBe(false);
  });

  it("detects slide media and slide video overlays accurately even when text is empty", () => {
    const videoSlideTheme = {
      source: "presentation-slide",
      cueMediaElements: [
        {
          id: "vid-1",
          fill: {
            enabled: true,
            type: "media",
            mediaType: "video",
            fileUrl: "file:///C:/cache/lyric.webm"
          }
        }
      ],
      layout: { elements: [] }
    };

    const imageSlideTheme = {
      source: "presentation-slide",
      cueMediaElements: [
        {
          id: "img-1",
          fill: {
            enabled: true,
            type: "media",
            mediaType: "image",
            fileUrl: "file:///C:/assets/banner.png"
          }
        }
      ],
      layout: { elements: [] }
    };

    expect(doesThemeHaveSlideMedia(videoSlideTheme)).toBe(true);
    expect(doesThemeHaveSlideVideo(videoSlideTheme)).toBe(true);
    expect(doesThemeHaveSlideMedia(imageSlideTheme)).toBe(true);
    expect(doesThemeHaveSlideVideo(imageSlideTheme)).toBe(false);
    expect(doesThemeHaveSlideMedia(null)).toBe(false);
    expect(doesThemeHaveSlideVideo(null)).toBe(false);
  });

  it("renders Liturgi Shape-Fill text boxes as full-box backdrop (not shrunken pill) and respects disabled text shadow", () => {
    const votumHeaderBox = {
      id: "votum-header",
      isTextBox: true,
      bounds: { x: 151, y: 60, width: 545, height: 73 },
      fill: {
        enabled: true,
        type: "color",
        color: { r: 255, g: 255, b: 255, a: 1, css: "rgba(255, 255, 255, 1)" }
      },
      textShape: { enabled: false },
      stroke: { enabled: false },
      shadow: { enabled: false },
      text: {
        plainText: "Votum & Salam",
        fontSize: 70,
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 700,
        textColor: { css: "rgba(0, 0, 0, 1)" },
        textShadow: { enabled: false }
      }
    };

    const visuals = buildTextBoxVisuals(votumHeaderBox, 1920, 1080, null);
    expect(visuals.hasBackdrop).toBe(true);
    expect(visuals.lineBackground).toBeNull();
    expect(visuals.fillBg).toEqual({ backgroundColor: "rgba(255, 255, 255, 1)" });
    expect(visuals.textShadowCss).toBe("none");
    expect(visuals.stageBounds).toEqual({ x: 151, y: 60, width: 545, height: 73 });

    // Unthemed fallback exposes full-canvas stageBounds for pixel-locked crossfade compensation
    const unthemedVisuals = buildTextBoxVisuals(null, 1920, 1080, null);
    expect(unthemedVisuals.stageBounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });

    // Conversely, when ProPresenter Line Background (textShape) IS enabled, render per-line pill
    const lineBgBox = {
      ...votumHeaderBox,
      textShape: { enabled: true, cornerRadius: 8, padding: 20, offsetY: 0 }
    };
    const pillVisuals = buildTextBoxVisuals(lineBgBox, 1920, 1080, null);
    expect(pillVisuals.lineBackground?.enabled).toBe(true);
    expect(pillVisuals.hasBackdrop).toBe(false);
  });

  it("computes 1:1 ProPresenter line-height from natural font ratio, lineHeightMultiple, and lineSpacing", () => {
    // 1.0x natural font line height (1.21 fallback in headless environment) -> ~1.21 (not crushed to 1.0em!)
    const liturgiLh = computeProPresenterLineHeight({
      fontSize: 70,
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      lineHeightMultiple: 1.0,
      lineSpacing: 0
    });
    expect(liturgiLh).toBeCloseTo(1.21, 2);

    // Extra 14px lineSpacing on 70px font adds +0.20 ratio
    const spacedLh = computeProPresenterLineHeight({
      fontSize: 70,
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      lineHeightMultiple: 1.0,
      lineSpacing: 14
    });
    expect(spacedLh).toBeCloseTo(1.41, 2);

    // Preserves RTF multi-newline paragraph breaks when OpenAPI collapses whitespace
    const liturgiSlide = {
      source: "presentation-slide",
      layout: {
        elements: [
          {
            id: "body-box",
            isTextBox: true,
            bounds: { x: 150, y: 200, width: 1620, height: 700 },
            text: { plainText: "Liturgos: Kasih karunia.\n\nUmat: Dan damai sejahtera." }
          }
        ]
      }
    };
    const resolved = resolveLayoutTextSlots(
      liturgiSlide,
      "Liturgos: Kasih karunia.\nUmat: Dan damai sejahtera."
    );
    expect(resolved.primaryText).toBe("Liturgos: Kasih karunia.\n\nUmat: Dan damai sejahtera.");

    // Preserves RTF superscript verse numbers in .pro presentation slides when OpenAPI sends plain digits
    const firmanSlide = {
      source: "presentation-slide",
      layout: {
        elements: [
          {
            id: "verse-box",
            isTextBox: true,
            bounds: { x: 200, y: 250, width: 1520, height: 600 },
            text: { plainText: "¹⁹ Pada waktu itu datanglah Yesus dan berdiri di tengah-tengah mereka." }
          },
          {
            id: "ref-box",
            isTextBox: true,
            bounds: { x: 200, y: 150, width: 600, height: 90 },
            text: { plainText: "Yohanes 20:19" }
          }
        ]
      }
    };
    const resolvedFirman = resolveLayoutTextSlots(
      firmanSlide,
      "Yohanes 20:19\n19 Pada waktu itu datanglah Yesus dan berdiri di tengah-tengah mereka."
    );
    expect(resolvedFirman.primaryText).toBe(
      "¹⁹ Pada waktu itu datanglah Yesus dan berdiri di tengah-tengah mereka."
    );
  });
});
