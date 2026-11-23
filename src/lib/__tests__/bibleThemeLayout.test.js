import { describe, it, expect } from "vitest";
import {
  buildTextBoxVisuals,
  formatBibleVerseNumbers,
  resolveLayoutTextSlots
} from "../../components/ThemedLyricStage.jsx";

describe("Bible Theme 1:1 Layout & Superscript Verse Numbers", () => {
  it("converts attached leading verse numbers to superscript while leaving normal numbers alone", () => {
    expect(
      formatBibleVerseNumbers("1Inilah silsilah Yesus Kristus, anak Daud, anak Abraham.")
    ).toBe("¹Inilah silsilah Yesus Kristus, anak Daud, anak Abraham.");
    expect(
      formatBibleVerseNumbers('23"Sesungguhnya, anak dara itu akan mengandung"')
    ).toBe('²³"Sesungguhnya, anak dara itu akan mengandung"');
    expect(formatBibleVerseNumbers("Matius 1:1-25")).toBe("Matius 1:1-25");
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
});
