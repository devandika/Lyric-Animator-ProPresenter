import { describe, it, expect } from "vitest";
import {
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
});
