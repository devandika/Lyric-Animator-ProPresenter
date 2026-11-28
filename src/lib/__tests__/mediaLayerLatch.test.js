import { describe, it, expect } from "vitest";
import {
  createMediaLatchState,
  reconcileActiveBackgroundMedia
} from "../mediaLayerLatch.js";

describe("mediaLayerLatch (Slide-included Background Video Persistence)", () => {
  const slideBgVideo = {
    uuid: "cue-vid-1",
    name: "WorshipLoop.mp4",
    fileUrl: "file:///C:/ProPresenter/Media/Assets/WorshipLoop.mp4",
    mediaType: "video",
    transition: { type: "dissolve", durationSeconds: 0.5 }
  };

  const playlistBgVideo = {
    uuid: "pl-vid-9",
    name: "WelcomeLoop.mp4",
    fileUrl: "file:///C:/ProPresenter/Media/Assets/WelcomeLoop.mp4",
    mediaType: "video",
    transition: null
  };

  it("keeps slide-included background video playing when Clear Slide sets themeInfo/cueMedia to null", () => {
    const latch = createMediaLatchState();

    // 1. Trigger Slide 1 (which includes WorshipLoop.mp4)
    const onSlide1 = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: null,
      resolvedPlaylistMedia: null,
      cueMedia: slideBgVideo,
      cueIdentity: "Song.pro::cue-1"
    });
    expect(onSlide1?.url).toBe(slideBgVideo.fileUrl);
    expect(onSlide1?.mediaType).toBe("video");

    // 2. Operator clicks Clear Slide ("Hapus Slide"): themeInfo becomes null (cueMedia = null),
    // while ProPresenter's Media layer stays active (showMediaLayer = true)
    const afterClearSlide = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: null,
      resolvedPlaylistMedia: null,
      cueMedia: null,
      cueIdentity: ""
    });
    expect(afterClearSlide).toEqual(onSlide1);

    // 3. Operator clicks Clear Media / Clear All (showMediaLayer = false) -> video stops
    const afterClearMedia = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: false,
      activeMediaItem: null,
      resolvedPlaylistMedia: null,
      cueMedia: null,
      cueIdentity: ""
    });
    expect(afterClearMedia).toBeNull();
  });

  it("keeps slide-included background video playing across subsequent lyric slides without cueMedia", () => {
    const latch = createMediaLatchState();

    reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      cueMedia: slideBgVideo,
      cueIdentity: "Song.pro::cue-1"
    });

    // Advance to Slide 2 & Slide 3 (lyrics only, cueMedia: null)
    const onSlide2 = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      cueMedia: null,
      cueIdentity: "Song.pro::cue-2"
    });
    expect(onSlide2?.url).toBe(slideBgVideo.fileUrl);
  });

  it("prioritizes slide cueMedia over stale Media Playlist items and switches when a new Media Playlist item is clicked", () => {
    const latch = createMediaLatchState();
    const stalePlaylistItem = { uuid: "pl-vid-9", name: "WelcomeLoop.mp4" };

    // Earlier in service: WelcomeLoop from Media Playlist was active
    const initial = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: stalePlaylistItem,
      resolvedPlaylistMedia: playlistBgVideo,
      cueMedia: null,
      cueIdentity: ""
    });
    expect(initial?.url).toBe(playlistBgVideo.fileUrl);

    // Operator clicks Song Slide 1 with its own embedded WorshipLoop.mp4 while OpenAPI still reports stalePlaylistItem
    const onSongSlide = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: stalePlaylistItem,
      resolvedPlaylistMedia: playlistBgVideo,
      cueMedia: slideBgVideo,
      cueIdentity: "Song.pro::cue-1"
    });
    expect(onSongSlide?.url).toBe(slideBgVideo.fileUrl);

    // Operator clicks Clear Slide -> WorshipLoop.mp4 MUST stay on screen, NOT snap back to stale WelcomeLoop!
    const afterClearSlide = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: stalePlaylistItem,
      resolvedPlaylistMedia: playlistBgVideo,
      cueMedia: null,
      cueIdentity: ""
    });
    expect(afterClearSlide?.url).toBe(slideBgVideo.fileUrl);

    // Operator explicitly clicks a brand new Media Playlist item ("SermonBg.mp4")
    const newPlaylistItem = { uuid: "pl-vid-10", name: "SermonBg.mp4" };
    const newResolved = {
      uuid: "pl-vid-10",
      name: "SermonBg.mp4",
      fileUrl: "file:///C:/ProPresenter/Media/Assets/SermonBg.mp4",
      mediaType: "video",
      transition: null
    };
    const afterNewPlaylistClick = reconcileActiveBackgroundMedia(latch, {
      showMediaLayer: true,
      activeMediaItem: newPlaylistItem,
      resolvedPlaylistMedia: newResolved,
      cueMedia: null,
      cueIdentity: ""
    });
    expect(afterNewPlaylistClick?.url).toBe(newResolved.fileUrl);
  });
});
