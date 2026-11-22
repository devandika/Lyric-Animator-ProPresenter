/**
 * Service to connect to ProPresenter OpenAPI (REST HTTP).
 * Tracks live slide text/UUID, active layers (video_input, media, slide, announcements, props, messages),
 * active media playlist item, Look overrides, screens, active presentation .pro path,
 * and surrounding slides (Before / After).
 */

function normalizeSlideText(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function extractActiveProps(propsJson) {
  if (!Array.isArray(propsJson)) return [];
  return propsJson
    .filter((p) => Boolean(p?.is_active))
    .map((p) => ({
      uuid: String(p?.id?.uuid || p?.uuid || "").toLowerCase(),
      name: String(p?.id?.name || p?.name || "Prop").trim()
    }))
    .filter((p) => Boolean(p.name));
}

function extractJsonObjectsFromBuffer(buffer) {
  const messages = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  let lastConsumed = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (objStart === -1) {
      if (ch === "{") {
        objStart = i;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const raw = buffer.slice(objStart, i + 1);
        try {
          messages.push(JSON.parse(raw));
        } catch (_) {}
        lastConsumed = i + 1;
        objStart = -1;
      }
    }
  }

  return {
    messages,
    remainder: objStart !== -1 ? buffer.slice(objStart) : buffer.slice(lastConsumed)
  };
}

function flattenPresentationSlides(pres) {
  if (!pres || !Array.isArray(pres.groups)) return [];
  const groups = pres.groups;
  let orderedGroups = groups;

  if (pres.current_arrangement && Array.isArray(pres.arrangements)) {
    const arr = pres.arrangements.find(
      (a) => a?.id?.uuid && a.id.uuid === pres.current_arrangement
    );
    if (arr && Array.isArray(arr.groups) && arr.groups.length > 0) {
      const mapped = arr.groups
        .map((ref) => {
          const key = typeof ref === "string" ? ref : ref?.uuid || ref?.name;
          return groups.find((g) => g.uuid === key || g.name === key);
        })
        .filter(Boolean);
      if (mapped.length > 0) orderedGroups = mapped;
    }
  }

  const slides = [];
  for (const g of orderedGroups) {
    if (!Array.isArray(g?.slides)) continue;
    for (const s of g.slides) {
      if (s && s.enabled === false) continue;
      slides.push({
        uuid: String(s?.id?.uuid || s?.uuid || "").toLowerCase(),
        text: normalizeSlideText(s?.text),
        label: String(s?.label || "").trim(),
        groupName: String(g?.name || "").trim()
      });
    }
  }
  return slides;
}

async function fetchJsonWithTimeout(url, timeoutMs = 1000) {
  const ac = new AbortController();
  const timer = setTimeout(() => {
    try {
      ac.abort();
    } catch (_) {}
  }, timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ac.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class ProPresenterConnector {
  constructor({
    host = "127.0.0.1",
    port = 50001,
    onStatusChange = () => {},
    onSlideChange = () => {},
    onMetaChange = () => {},
    onError = () => {}
  } = {}) {
    this.host = host;
    this.port = port;
    this.onStatusChange = onStatusChange;
    this.onSlideChange = onSlideChange;
    this.onMetaChange = onMetaChange;
    this.onError = onError;

    this.pollTimer = null;
    this.presRefreshTimer = null;
    this.streamSyncTimer = null;
    this.reconnectTimer = null;
    this.streamAbortController = null;
    this.isPolling = false;
    this.isReconcilingSlide = false;
    this.streamSlideSeq = 0;
    this.streamLayerSeq = 0;
    this.streamMediaSeq = 0;
    this.streamPropsSeq = 0;
    this.isFetchingPres = false;
    this.isFetchingScreens = false;
    this.isFetchingActiveMedia = false;
    this.pendingActiveMediaRefresh = false;
    this.isFetchingProps = false;
    this.pendingPropsRefresh = false;
    this.isConnected = false;
    this.isManualClosed = false;

    this.currentText = "";
    this.currentUuid = "";
    this.nextText = "";
    this.lastSlideVisible = null;
    this.lastMetaKey = "";
    this.lastPresentationFetchAt = 0;
    this.presentationPath = "";
    this.presentationName = "";
    this.presentationId = "";
    this.presentationSlides = [];
    this.lastMatchedSlideIdx = -1;
    this.lastMatchedGroupName = "";
    this.lastNonEmptySlide = null;
    this.audienceScreens = [];
    this.latestState = this.createEmptyState();
  }

  createEmptyState() {
    return {
      slideJson: null,
      layersJson: {
        video_input: false,
        media: false,
        slide: true,
        announcements: false,
        props: false,
        messages: false,
        audio: false
      },
      lookJson: null,
      mediaActiveJson: null,
      propsJson: [],
      stageMsg: "",
      annObj: null
    };
  }

  connect() {
    this.isManualClosed = false;
    this.cleanup();
    this.connectOpenApi();
  }

  disconnect() {
    this.isManualClosed = true;
    this.cleanup();
    this.setConnected(false, "Terputus");
  }

  cleanup() {
    if (this.streamAbortController) {
      try {
        this.streamAbortController.abort();
      } catch (_) {}
      this.streamAbortController = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.presRefreshTimer) {
      clearInterval(this.presRefreshTimer);
      this.presRefreshTimer = null;
    }
    if (this.streamSyncTimer) {
      clearInterval(this.streamSyncTimer);
      this.streamSyncTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isPolling = false;
    this.isReconcilingSlide = false;
    this.isFetchingPres = false;
    this.isFetchingScreens = false;
    this.isFetchingActiveMedia = false;
    this.pendingActiveMediaRefresh = false;
    this.isFetchingProps = false;
    this.pendingPropsRefresh = false;
  }

  setConnected(status, message = "") {
    if (this.isConnected === status && this._lastMsg === message) return;
    this._lastMsg = message;
    this.isConnected = status;
    this.onStatusChange({
      connected: status,
      message,
      host: this.host,
      port: this.port
    });
  }

  applyPresentationData(pres) {
    if (!pres) return;
    const nextPresId = pres?.id?.uuid || "";
    if (nextPresId && nextPresId !== this.presentationId) {
      this.lastMatchedSlideIdx = -1;
    }
    this.presentationPath = pres.presentation_path || "";
    this.presentationName = pres?.id?.name || "";
    this.presentationId = nextPresId;
    this.presentationSlides = flattenPresentationSlides(pres);
  }

  ensureAudienceScreensAsync(baseUrl) {
    if (this.audienceScreens.length > 0 || this.isFetchingScreens) return;
    this.isFetchingScreens = true;
    fetchJsonWithTimeout(`${baseUrl}/v1/status/screens`, 2500)
      .then((screensJson) => {
        if (this.isManualClosed || !Array.isArray(screensJson)) return;
        this.audienceScreens = screensJson
          .filter((s) => s?.screen_type === "audience")
          .map((s, idx) => ({
            index: idx,
            uuid: String(s?.id?.uuid || "").toLowerCase(),
            name: s?.id?.name || `Audience ${idx + 1}`,
            width: s?.size?.width || 1920,
            height: s?.size?.height || 1080
          }));
        if (this.latestState.slideJson) {
          this.processLatestState(baseUrl, { skipAsyncPresRefresh: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.isFetchingScreens = false;
      });
  }

  refreshPresentationAsync(baseUrl) {
    if (this.isFetchingPres || this.isManualClosed) return;
    this.isFetchingPres = true;
    this.lastPresentationFetchAt = Date.now();
    fetchJsonWithTimeout(`${baseUrl}/v1/presentation/active?chunked=false`, 3500)
      .then((presJson) => {
        if (this.isManualClosed || !presJson?.presentation) return;
        this.applyPresentationData(presJson.presentation);
        if (this.latestState.slideJson) {
          this.processLatestState(baseUrl, { skipAsyncPresRefresh: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.isFetchingPres = false;
      });
  }

  refreshActiveMediaAsync(baseUrl) {
    if (this.isManualClosed) return;
    if (this.isFetchingActiveMedia) {
      this.pendingActiveMediaRefresh = true;
      return;
    }
    this.isFetchingActiveMedia = true;
    const startMediaSeq = this.streamMediaSeq;
    fetchJsonWithTimeout(`${baseUrl}/v1/media/playlist/active`, 900)
      .then((activeJson) => {
        if (this.isManualClosed || !activeJson || this.streamMediaSeq !== startMediaSeq) return;
        this.latestState.mediaActiveJson = activeJson;
        if (this.latestState.slideJson) {
          this.processLatestState(baseUrl, { skipAsyncPresRefresh: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.isFetchingActiveMedia = false;
        if (this.pendingActiveMediaRefresh && !this.isManualClosed) {
          this.pendingActiveMediaRefresh = false;
          this.refreshActiveMediaAsync(baseUrl);
        }
      });
  }

  refreshActivePropsAsync(baseUrl) {
    if (this.isManualClosed) return;
    if (this.isFetchingProps) {
      this.pendingPropsRefresh = true;
      return;
    }
    this.isFetchingProps = true;
    const startPropsSeq = this.streamPropsSeq;
    fetchJsonWithTimeout(`${baseUrl}/v1/props`, 900)
      .then((propsJson) => {
        if (this.isManualClosed || !Array.isArray(propsJson) || this.streamPropsSeq !== startPropsSeq) {
          return;
        }
        this.latestState.propsJson = propsJson;
        if (this.latestState.slideJson) {
          this.processLatestState(baseUrl, { skipAsyncPresRefresh: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.isFetchingProps = false;
        if (this.pendingPropsRefresh && !this.isManualClosed) {
          this.pendingPropsRefresh = false;
          this.refreshActivePropsAsync(baseUrl);
        }
      });
  }

  processLatestState(baseUrl, { skipAsyncPresRefresh = false } = {}) {
    const { slideJson, layersJson, lookJson, mediaActiveJson, propsJson, stageMsg, annObj } =
      this.latestState;
    if (!slideJson) return;

    this.setConnected(true, "Terhubung (OpenAPI)");

    const now = Date.now();
    const rawText = String(slideJson?.current?.text || "").trim();
    const rawUuid = String(slideJson?.current?.uuid || "").trim().toLowerCase();
    const nextText = String(slideJson?.next?.text || "").trim();
    const slideLayerActive = layersJson?.slide !== false;
    const effectiveText = slideLayerActive ? rawText : "";

    const normCurr = normalizeSlideText(rawText);
    const normNext = normalizeSlideText(nextText);
    const normPrevCurr = normalizeSlideText(this.currentText);

    const neighborInfo = this.resolveNeighborSlides(normCurr, normNext);
    if (neighborInfo.currSlide?.groupName) {
      this.lastMatchedGroupName = neighborInfo.currSlide.groupName;
    }

    const effectiveUuid = rawUuid || neighborInfo.currSlide?.uuid || "";

    const isSlideChanged =
      effectiveText !== this.currentText ||
      effectiveUuid !== this.currentUuid ||
      slideLayerActive !== this.lastSlideVisible;

    if (
      normPrevCurr &&
      (effectiveText !== this.currentText || effectiveUuid !== this.currentUuid)
    ) {
      this.lastNonEmptySlide = {
        text: this.currentText,
        groupName: this.lastMatchedGroupName || ""
      };
    }

    let prevSlide = null;
    if (neighborInfo.prevSlide) {
      prevSlide = {
        text: neighborInfo.prevSlide.text,
        groupName: neighborInfo.prevSlide.groupName,
        label: neighborInfo.prevSlide.label,
        source: "presentation"
      };
    } else if (
      this.lastNonEmptySlide &&
      normalizeSlideText(this.lastNonEmptySlide.text) !== normalizeSlideText(effectiveText)
    ) {
      prevSlide = {
        text: this.lastNonEmptySlide.text,
        groupName: this.lastNonEmptySlide.groupName || "Baru tampil",
        label: "",
        source: "history"
      };
    }

    const afterSlide = nextText
      ? {
          text: nextText,
          groupName:
            neighborInfo.nextSlide &&
            normalizeSlideText(neighborInfo.nextSlide.text) === normNext
              ? neighborInfo.nextSlide.groupName
              : "",
          label:
            neighborInfo.nextSlide &&
            normalizeSlideText(neighborInfo.nextSlide.text) === normNext
              ? neighborInfo.nextSlide.label
              : "",
          source: "openapi"
        }
      : null;

    this.nextText = nextText;

    const lookName = lookJson?.id?.name || "";
    const lookScreens = Array.isArray(lookJson?.screens) ? lookJson.screens : [];
    const activeMediaItem = mediaActiveJson?.item
      ? {
          uuid: String(mediaActiveJson.item.uuid || "").toLowerCase(),
          name: mediaActiveJson.item.name || ""
        }
      : null;

    const activeProps = layersJson?.props ? extractActiveProps(propsJson) : [];

    const metaObj = {
      audienceScreens: this.audienceScreens,
      lookName,
      lookScreens,
      layers: layersJson,
      activeMediaItem,
      activeProps,
      stageMessage: stageMsg,
      announcementActive: annObj,
      presentationPath: this.presentationPath,
      presentationName: this.presentationName,
      presentationId: this.presentationId,
      cueUuid: effectiveUuid,
      slideLayerActive,
      currSlideGroup: neighborInfo.currSlide?.groupName || "",
      slidePosition:
        neighborInfo.matchedIdx >= 0
          ? { index: neighborInfo.matchedIdx + 1, total: neighborInfo.totalSlides }
          : null,
      prevSlide,
      afterSlide
    };

    const metaKey = JSON.stringify(metaObj);
    if (metaKey !== this.lastMetaKey) {
      this.lastMetaKey = metaKey;
      this.onMetaChange(metaObj);
    }

    // Always emit slide text/UUID immediately without waiting for screens or presentation JSON
    if (isSlideChanged) {
      this.lastSlideVisible = slideLayerActive;
      this.emitSlideChange(effectiveText, effectiveUuid);
    }

    this.ensureAudienceScreensAsync(baseUrl);

    if (!skipAsyncPresRefresh) {
      const needsPresRefresh =
        !this.presentationId ||
        !this.presentationPath ||
        this.presentationSlides.length === 0 ||
        isSlideChanged ||
        now - this.lastPresentationFetchAt > 1500;
      if (needsPresRefresh) {
        this.refreshPresentationAsync(baseUrl);
      }
    }
  }

  /* -------------------------------------------------------------
   * OpenAPI / REST HTTP (ProPresenter 7.9+ / 20.x)
   * Primary: Real-time chunked push stream (/v1/status/updates)
   * Fallback: Fast 60ms non-blocking HTTP polling
   * ------------------------------------------------------------- */
  connectOpenApi() {
    const baseUrl = `http://${this.host}:${this.port}`;
    this.setConnected(false, `Menghubungkan OpenAPI (${baseUrl})...`);
    this.lastMetaKey = "";
    this.lastPresentationFetchAt = 0;
    this.latestState = this.createEmptyState();

    const startPollingFallback = () => {
      if (this.isManualClosed || this.pollTimer) return;

      const fetchJson = async (endpoint) => {
        const ac = new AbortController();
        const timer = setTimeout(() => {
          try {
            ac.abort();
          } catch (_) {}
        }, 900);
        try {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            cache: "no-store",
            signal: ac.signal
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } finally {
          clearTimeout(timer);
        }
      };

      const pollOnce = async () => {
        if (this.isPolling || this.isManualClosed) return;
        this.isPolling = true;
        try {
          const [slideRes, layersRes, lookRes, mediaActiveRes, propsRes, stageMsgRes, annRes] =
            await Promise.allSettled([
              fetchJson("/v1/status/slide"),
              fetchJson("/v1/status/layers"),
              fetchJson("/v1/look/current"),
              fetchJson("/v1/media/playlist/active"),
              fetchJson("/v1/props"),
              fetchJson("/v1/stage/message"),
              fetchJson("/v1/announcement/active")
            ]);

          if (slideRes.status !== "fulfilled") {
            this.setConnected(false, `OpenAPI tidak merespon (${this.host}:${this.port})`);
            return;
          }

          this.latestState.slideJson = slideRes.value;
          if (layersRes.status === "fulfilled" && layersRes.value) {
            this.latestState.layersJson = layersRes.value;
          }
          if (lookRes.status === "fulfilled") {
            this.latestState.lookJson = lookRes.value;
          }
          if (mediaActiveRes.status === "fulfilled") {
            this.latestState.mediaActiveJson = mediaActiveRes.value;
          }
          if (propsRes.status === "fulfilled" && Array.isArray(propsRes.value)) {
            this.latestState.propsJson = propsRes.value;
          }
          if (stageMsgRes.status === "fulfilled") {
            this.latestState.stageMsg =
              typeof stageMsgRes.value === "string" ? stageMsgRes.value.trim() : "";
          }
          if (annRes.status === "fulfilled") {
            this.latestState.annObj = annRes.value?.announcement || null;
          }

          this.processLatestState(baseUrl);
        } catch (_) {
          this.setConnected(false, "Koneksi OpenAPI terputus");
        } finally {
          this.isPolling = false;
        }
      };

      pollOnce();
      this.pollTimer = setInterval(pollOnce, 60);
    };

    const reconcileLiveState = async () => {
      if (this.isReconcilingSlide || this.isManualClosed) return;
      this.isReconcilingSlide = true;
      const startSlideSeq = this.streamSlideSeq;
      const startLayerSeq = this.streamLayerSeq;
      const startMediaSeq = this.streamMediaSeq;
      try {
        const [slideRes, layersRes, mediaActiveRes] = await Promise.allSettled([
          fetchJsonWithTimeout(`${baseUrl}/v1/status/slide`, 900),
          fetchJsonWithTimeout(`${baseUrl}/v1/status/layers`, 900),
          fetchJsonWithTimeout(`${baseUrl}/v1/media/playlist/active`, 900)
        ]);

        if (this.isManualClosed) return;

        let changed = false;
        if (
          this.streamSlideSeq === startSlideSeq &&
          slideRes.status === "fulfilled" &&
          slideRes.value
        ) {
          const nextSlide = slideRes.value;
          const prevSlide = this.latestState.slideJson;
          const prevCurrUuid = String(prevSlide?.current?.uuid || "").trim().toLowerCase();
          const nextCurrUuid = String(nextSlide?.current?.uuid || "").trim().toLowerCase();
          const prevCurrText = String(prevSlide?.current?.text || "").trim();
          const nextCurrText = String(nextSlide?.current?.text || "").trim();
          const prevNextText = String(prevSlide?.next?.text || "").trim();
          const nextNextText = String(nextSlide?.next?.text || "").trim();

          if (
            !prevSlide ||
            prevCurrUuid !== nextCurrUuid ||
            prevCurrText !== nextCurrText ||
            prevNextText !== nextNextText
          ) {
            this.latestState.slideJson = nextSlide;
            changed = true;
          }
        }

        if (
          this.streamMediaSeq === startMediaSeq &&
          mediaActiveRes.status === "fulfilled"
        ) {
          const nextMediaActive = mediaActiveRes.value;
          const prevItem = this.latestState.mediaActiveJson?.item;
          const nextItem = nextMediaActive?.item;
          const prevUuid = String(prevItem?.uuid || "").trim().toLowerCase();
          const nextUuid = String(nextItem?.uuid || "").trim().toLowerCase();
          const prevName = String(prevItem?.name || "").trim();
          const nextName = String(nextItem?.name || "").trim();
          if (
            Boolean(prevItem) !== Boolean(nextItem) ||
            prevUuid !== nextUuid ||
            prevName !== nextName
          ) {
            this.latestState.mediaActiveJson = nextMediaActive;
            changed = true;
          }
        }

        if (
          this.streamLayerSeq === startLayerSeq &&
          layersRes.status === "fulfilled" &&
          layersRes.value
        ) {
          const nextLayers = layersRes.value;
          const prevLayers = this.latestState.layersJson;
          if (
            Boolean(prevLayers?.video_input) !== Boolean(nextLayers?.video_input) ||
            Boolean(prevLayers?.slide) !== Boolean(nextLayers?.slide) ||
            Boolean(prevLayers?.media) !== Boolean(nextLayers?.media) ||
            Boolean(prevLayers?.props) !== Boolean(nextLayers?.props) ||
            Boolean(prevLayers?.messages) !== Boolean(nextLayers?.messages) ||
            Boolean(prevLayers?.announcements) !== Boolean(nextLayers?.announcements)
          ) {
            const wasMedia = Boolean(prevLayers?.media);
            const wasProps = Boolean(prevLayers?.props);
            this.latestState.layersJson = nextLayers;
            if (nextLayers.media && (!wasMedia || !this.latestState.mediaActiveJson?.item)) {
              this.refreshActiveMediaAsync(baseUrl);
            }
            if (nextLayers.props && (!wasProps || extractActiveProps(this.latestState.propsJson).length === 0)) {
              this.refreshActivePropsAsync(baseUrl);
            }
            changed = true;
          } else if (nextLayers.props) {
            this.refreshActivePropsAsync(baseUrl);
          }
        }

        if (changed && this.latestState.slideJson) {
          this.processLatestState(baseUrl, { skipAsyncPresRefresh: Boolean(this.presentationPath) });
        }
      } catch (_) {
      } finally {
        this.isReconcilingSlide = false;
      }
    };

    const startReconcileLoop = () => {
      reconcileLiveState();
      if (!this.streamSyncTimer) {
        this.streamSyncTimer = setInterval(() => {
          if (!this.isManualClosed) reconcileLiveState();
        }, 50);
      }
    };

    const startStream = async () => {
      if (this.isManualClosed) return;

      // Always keep fast 50ms reconciliation running even while stream headers are pending
      startReconcileLoop();

      const ac = new AbortController();
      this.streamAbortController = ac;

      try {
        const res = await fetch(`${baseUrl}/v1/status/updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: ac.signal,
          body: JSON.stringify([
            "status/slide",
            "status/layers",
            "look/current",
            "media/playlist/active",
            "props",
            "stage/message",
            "announcement/active",
            "presentation/active"
          ])
        });

        if (!res.ok || !res.body) {
          if (this.streamSyncTimer) {
            clearInterval(this.streamSyncTimer);
            this.streamSyncTimer = null;
          }
          startPollingFallback();
          return;
        }

        // Periodic background check for presentation metadata updates
        if (!this.presRefreshTimer) {
          this.presRefreshTimer = setInterval(() => {
            if (!this.isManualClosed) {
              this.refreshPresentationAsync(baseUrl);
            }
          }, 2500);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (!this.isManualClosed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const { messages, remainder } = extractJsonObjectsFromBuffer(buffer);
          buffer = remainder;

          let dirty = false;
          let sawMediaActive = false;
          let sawMediaLayerTrue = false;
          let sawProps = false;
          let sawPropsLayerTrue = false;
          for (const parsed of messages) {
            const url = parsed?.url;
            const data = parsed?.data;
            if (!url || url === "timer/system_time") continue;

            dirty = true;
            if (url === "status/slide") {
              this.streamSlideSeq++;
              this.latestState.slideJson = data;
            } else if (url === "status/layers" && data) {
              this.streamLayerSeq++;
              this.latestState.layersJson = data;
              if (data.media) sawMediaLayerTrue = true;
              if (data.props) sawPropsLayerTrue = true;
            } else if (url === "look/current") {
              this.latestState.lookJson = data;
            } else if (url === "media/playlist/active") {
              sawMediaActive = true;
              this.streamMediaSeq++;
              this.latestState.mediaActiveJson = data;
            } else if (url === "props") {
              sawProps = true;
              this.streamPropsSeq++;
              this.latestState.propsJson = Array.isArray(data) ? data : [];
            } else if (url === "stage/message") {
              this.latestState.stageMsg = typeof data === "string" ? data.trim() : "";
            } else if (url === "announcement/active") {
              this.latestState.annObj = data?.announcement || null;
            } else if (url === "presentation/active" && data?.presentation) {
              this.applyPresentationData(data.presentation);
            }
          }

          if (sawMediaLayerTrue && !sawMediaActive) {
            this.refreshActiveMediaAsync(baseUrl);
          }
          if (sawPropsLayerTrue && !sawProps) {
            this.refreshActivePropsAsync(baseUrl);
          }

          if (dirty && this.latestState.slideJson) {
            this.processLatestState(baseUrl, { skipAsyncPresRefresh: Boolean(this.presentationPath) });
          }
        }
      } catch (err) {
        if (this.isManualClosed || err?.name === "AbortError") return;
      }

      if (this.presRefreshTimer) {
        clearInterval(this.presRefreshTimer);
        this.presRefreshTimer = null;
      }
      if (this.streamSyncTimer) {
        clearInterval(this.streamSyncTimer);
        this.streamSyncTimer = null;
      }

      if (!this.isManualClosed) {
        this.setConnected(false, `OpenAPI tidak merespon (${this.host}:${this.port})`);
        this.reconnectTimer = setTimeout(() => {
          if (!this.isManualClosed) startStream();
        }, 500);
      }
    };

    startStream();
  }

  resolveNeighborSlides(currText, nextText) {
    const slides = this.presentationSlides || [];
    const c = normalizeSlideText(currText);
    const n = normalizeSlideText(nextText);

    let matchedIdx = -1;
    if (slides.length > 0 && c) {
      const candidates = [];
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].text !== c) continue;
        const nextMatch = n ? i + 1 < slides.length && slides[i + 1].text === n : i === slides.length - 1;
        candidates.push({ idx: i, exactPair: nextMatch });
      }
      const exact = candidates.filter((x) => x.exactPair);
      const pool = exact.length > 0 ? exact : candidates;
      if (pool.length > 0) {
        if (this.lastMatchedSlideIdx >= 0) {
          pool.sort(
            (a, b) =>
              Math.abs(a.idx - this.lastMatchedSlideIdx) -
              Math.abs(b.idx - this.lastMatchedSlideIdx)
          );
        }
        matchedIdx = pool[0].idx;
        this.lastMatchedSlideIdx = matchedIdx;
      }
    } else if (slides.length > 0 && !c && n) {
      // Find slide whose text is empty and next slide matches n
      for (let i = 0; i < slides.length - 1; i++) {
        if (!slides[i].text && slides[i + 1].text === n) {
          matchedIdx = i;
          this.lastMatchedSlideIdx = matchedIdx;
          break;
        }
      }
    }

    return {
      matchedIdx,
      totalSlides: slides.length,
      prevSlide: matchedIdx > 0 ? slides[matchedIdx - 1] : null,
      currSlide: matchedIdx >= 0 ? slides[matchedIdx] : null,
      nextSlide: matchedIdx >= 0 && matchedIdx + 1 < slides.length ? slides[matchedIdx + 1] : null
    };
  }

  emitSlideChange(newText, newUuid = "") {
    const trimmed = String(newText || "").trim();
    const uuid = String(newUuid || "").trim().toLowerCase();
    this.currentText = trimmed;
    this.currentUuid = uuid;
    this.onSlideChange({
      text: trimmed,
      uuid,
      nextText: this.nextText,
      timestamp: Date.now()
    });
  }

  async triggerPreviousSlide() {
    const baseUrl = `http://${this.host}:${this.port}`;
    try {
      const res = await fetch(`${baseUrl}/v1/presentation/active/previous/trigger`, {
        cache: "no-store"
      });
      if (res.ok) return true;
      const fallback = await fetch(`${baseUrl}/v1/presentation/focused/previous/trigger`, {
        cache: "no-store"
      });
      return fallback.ok;
    } catch (_) {
      return false;
    }
  }

  async triggerNextSlide() {
    const baseUrl = `http://${this.host}:${this.port}`;
    try {
      const res = await fetch(`${baseUrl}/v1/presentation/active/next/trigger`, {
        cache: "no-store"
      });
      if (res.ok) return true;
      const fallback = await fetch(`${baseUrl}/v1/presentation/focused/next/trigger`, {
        cache: "no-store"
      });
      return fallback.ok;
    } catch (_) {
      return false;
    }
  }

  async clearSlideLayer() {
    const baseUrl = `http://${this.host}:${this.port}`;
    try {
      const res = await fetch(`${baseUrl}/v1/clear/layer/slide`, {
        cache: "no-store"
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }
}
