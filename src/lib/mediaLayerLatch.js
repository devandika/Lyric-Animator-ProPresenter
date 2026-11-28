/**
 * Manages background media ownership between ProPresenter's Media Playlist (`/v1/media/playlist/active`)
 * and Slide-embedded Background Media Actions (`cueMedia` inside `.pro` cues).
 *
 * Ensures slide-included background videos remain playing across "Clear Slide" (`themeInfo = null`)
 * and across subsequent lyric slides in the same song for as long as ProPresenter's Media layer
 * (`showMediaLayer`) stays active, while still yielding immediately when Clear Media / Clear All
 * is triggered or when the operator picks a new item in the Media Playlist.
 */

export function createMediaLatchState() {
  return {
    activeSource: "", // "" | "cue" | "playlist"
    latchedCueMedia: null,
    lastCueSignature: "",
    playlistKeyAtCueLatch: ""
  };
}

export function resetMediaLatchState(state) {
  if (!state) return;
  state.activeSource = "";
  state.latchedCueMedia = null;
  state.lastCueSignature = "";
  state.playlistKeyAtCueLatch = "";
}

export function reconcileActiveBackgroundMedia(
  state,
  {
    showMediaLayer = false,
    activeMediaItem = null,
    resolvedPlaylistMedia = null,
    thumbUrl = "",
    cueMedia = null,
    cueIdentity = ""
  } = {}
) {
  if (!showMediaLayer) {
    resetMediaLatchState(state);
    return null;
  }

  const normUuid = String(activeMediaItem?.uuid || "").trim().toLowerCase();
  const normName = String(activeMediaItem?.name || "").trim().toLowerCase();
  const playlistKey = normUuid || normName ? `${normUuid}::${normName}` : "";

  const incomingCueMedia = cueMedia?.fileUrl ? cueMedia : null;
  const cueSig = incomingCueMedia
    ? `${cueIdentity || ""}::${incomingCueMedia.fileUrl}`
    : "";

  if (incomingCueMedia) {
    // A slide cue carrying an embedded background media action is active
    if (
      cueSig !== state.lastCueSignature ||
      state.activeSource !== "cue" && cueSig !== state.lastCueSignature ||
      !state.latchedCueMedia && state.activeSource !== "playlist"
    ) {
      state.activeSource = "cue";
      state.latchedCueMedia = incomingCueMedia;
      state.lastCueSignature = cueSig;
      state.playlistKeyAtCueLatch = playlistKey;
    }
  } else {
    // Left the cue that carried cueMedia (e.g. Clear Slide or moved to Verse 2 without cueMedia):
    // reset signature so re-clicking that cue later re-triggers it, while keeping latchedCueMedia alive!
    state.lastCueSignature = "";
  }

  // If operator explicitly clicked a DIFFERENT playable item from ProPresenter's Media Playlist
  // while no new slide cueMedia was just triggered, hand ownership over to the Media Playlist.
  if (
    state.activeSource === "cue" &&
    playlistKey &&
    playlistKey !== state.playlistKeyAtCueLatch &&
    resolvedPlaylistMedia?.fileUrl
  ) {
    const latchedUrl = state.latchedCueMedia?.fileUrl || "";
    const latchedName = String(state.latchedCueMedia?.name || "").trim().toLowerCase();
    const isSameUnderlyingMedia =
      resolvedPlaylistMedia.fileUrl === latchedUrl ||
      (normName && latchedName && normName === latchedName);

    if (!isSameUnderlyingMedia) {
      state.activeSource = "playlist";
      state.latchedCueMedia = null;
    } else {
      state.playlistKeyAtCueLatch = playlistKey;
    }
  }

  if (state.activeSource === "cue" && state.latchedCueMedia?.fileUrl) {
    return {
      url: state.latchedCueMedia.fileUrl,
      thumbUrl: "",
      mediaType: state.latchedCueMedia.mediaType || "video",
      name: state.latchedCueMedia.name || "Media",
      transition: state.latchedCueMedia.transition || null
    };
  }

  if (playlistKey) {
    if (resolvedPlaylistMedia?.fileUrl) {
      state.activeSource = "playlist";
      return {
        url: resolvedPlaylistMedia.fileUrl,
        thumbUrl,
        mediaType: resolvedPlaylistMedia.mediaType,
        name: resolvedPlaylistMedia.name || activeMediaItem?.name || "Media",
        transition: resolvedPlaylistMedia.transition || null
      };
    }
    if (thumbUrl) {
      state.activeSource = "playlist";
      return {
        url: thumbUrl,
        thumbUrl,
        mediaType: "image",
        name: activeMediaItem?.name || "Media",
        transition: null
      };
    }
  }

  return null;
}
