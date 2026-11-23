let koffiModule = null;
let user32Funcs = null;

function getKoffi() {
  if (process.platform !== "win32") return null;
  if (!koffiModule) {
    koffiModule = require("koffi");
  }
  return koffiModule;
}

function getUser32() {
  if (process.platform !== "win32") return null;
  if (user32Funcs) return user32Funcs;
  const koffi = getKoffi();
  if (!koffi) return null;
  const user32 = koffi.load("user32.dll");

  const DEVMODEW = koffi.struct("DEVMODEW", {
    dmDeviceName: koffi.array("uint16_t", 32),
    dmSpecVersion: "uint16_t",
    dmDriverVersion: "uint16_t",
    dmSize: "uint16_t",
    dmDriverExtra: "uint16_t",
    dmFields: "uint32_t",
    dmPositionX: "int32_t",
    dmPositionY: "int32_t",
    dmDisplayOrientation: "uint32_t",
    dmDisplayFixedOutput: "uint32_t",
    dmColor: "int16_t",
    dmDuplex: "int16_t",
    dmYResolution: "int16_t",
    dmTTOption: "int16_t",
    dmCollate: "int16_t",
    dmFormName: koffi.array("uint16_t", 32),
    dmLogPixels: "uint16_t",
    dmBitsPerPel: "uint32_t",
    dmPelsWidth: "uint32_t",
    dmPelsHeight: "uint32_t",
    dmDisplayFlags: "uint32_t",
    dmDisplayFrequency: "uint32_t",
    dmICMMethod: "uint32_t",
    dmICMIntent: "uint32_t",
    dmMediaType: "uint32_t",
    dmDitherType: "uint32_t",
    dmReserved1: "uint32_t",
    dmReserved2: "uint32_t",
    dmPanningWidth: "uint32_t",
    dmPanningHeight: "uint32_t"
  });

  const DISPLAY_DEVICEW = koffi.struct("DISPLAY_DEVICEW", {
    cb: "uint32_t",
    DeviceName: koffi.array("uint16_t", 32),
    DeviceString: koffi.array("uint16_t", 128),
    StateFlags: "uint32_t",
    DeviceID: koffi.array("uint16_t", 128),
    DeviceKey: koffi.array("uint16_t", 128)
  });

  user32Funcs = {
    DEVMODEW,
    DISPLAY_DEVICEW,
    EnumDisplayDevicesW: user32.func(
      "bool __stdcall EnumDisplayDevicesW(const uint16_t*, uint32_t, _Inout_ DISPLAY_DEVICEW*, uint32_t)"
    ),
    EnumDisplaySettingsW: user32.func(
      "bool __stdcall EnumDisplaySettingsW(const uint16_t*, uint32_t, _Inout_ DEVMODEW*)"
    ),
    SetWindowPos: user32.func(
      "bool __stdcall SetWindowPos(uintptr_t, intptr_t, int, int, int, int, uint32_t)"
    )
  };
  return user32Funcs;
}

/**
 * Forces a Windows HWND into the topmost Z-order band without stealing focus,
 * ensuring the window stays above ProPresenter even after focus/fullscreen changes.
 */
function forceWindowTopMost(nativeHandleBuffer) {
  if (process.platform !== "win32" || !nativeHandleBuffer || !Buffer.isBuffer(nativeHandleBuffer)) {
    return false;
  }
  try {
    const u32 = getUser32();
    if (!u32?.SetWindowPos) return false;
    const hwnd =
      nativeHandleBuffer.length >= 8
        ? nativeHandleBuffer.readBigUInt64LE(0)
        : BigInt(nativeHandleBuffer.readUInt32LE(0));
    if (!hwnd) return false;
    const HWND_TOPMOST = -1;
    const SWP_NOSIZE = 0x0001;
    const SWP_NOMOVE = 0x0002;
    const SWP_NOACTIVATE = 0x0010;
    const SWP_SHOWWINDOW = 0x0040;
    return Boolean(
      u32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW)
    );
  } catch (_) {
    return false;
  }
}

function u16ToStr(arr) {
  if (!arr) return "";
  const end = arr.indexOf(0);
  const slice = end >= 0 ? arr.slice(0, end) : arr;
  return Buffer.from(new Uint16Array(slice).buffer).toString("utf16le").trim();
}

function makeEmptyDisplayDevice(size) {
  return {
    cb: size,
    DeviceName: new Array(32).fill(0),
    DeviceString: new Array(128).fill(0),
    StateFlags: 0,
    DeviceID: new Array(128).fill(0),
    DeviceKey: new Array(128).fill(0)
  };
}

/**
 * Reads physical display resolutions, refresh rates, and coordinates directly from Windows Win32 API.
 */
function getWindowsDisplays() {
  if (process.platform !== "win32") return [];
  const koffi = getKoffi();
  const u32 = getUser32();
  if (!koffi || !u32) return [];
  const { DEVMODEW, DISPLAY_DEVICEW, EnumDisplayDevicesW, EnumDisplaySettingsW } = u32;
  const ddSize = koffi.sizeof(DISPLAY_DEVICEW);
  const dmSize = koffi.sizeof(DEVMODEW);
  const ENUM_CURRENT_SETTINGS = 0xffffffff;
  const DISPLAY_DEVICE_ACTIVE = 0x00000001;
  const DISPLAY_DEVICE_PRIMARY_DEVICE = 0x00000004;

  const displays = [];
  for (let i = 0; i < 16; i++) {
    const adapter = makeEmptyDisplayDevice(ddSize);
    if (!EnumDisplayDevicesW(null, i, adapter, 0)) break;
    if ((adapter.StateFlags & DISPLAY_DEVICE_ACTIVE) === 0) continue;

    const dm = { dmSize };
    if (!EnumDisplaySettingsW(adapter.DeviceName, ENUM_CURRENT_SETTINGS, dm)) continue;

    const monitor = makeEmptyDisplayDevice(ddSize);
    let monitorName = "";
    if (EnumDisplayDevicesW(adapter.DeviceName, 0, monitor, 0)) {
      monitorName = u16ToStr(monitor.DeviceString);
    }

    const isPrimary = (adapter.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) !== 0;
    const width = dm.dmPelsWidth || 0;
    const height = dm.dmPelsHeight || 0;
    const hz = dm.dmDisplayFrequency || 60;
    const idx = displays.length;

    displays.push({
      index: idx,
      deviceName: u16ToStr(adapter.DeviceName),
      adapterName: u16ToStr(adapter.DeviceString),
      monitorName,
      isPrimary,
      x: dm.dmPositionX,
      y: dm.dmPositionY,
      width,
      height,
      hz,
      label: `Layar ${idx + 1} (${width}x${height})`
    });
  }

  return displays;
}

module.exports = { getWindowsDisplays, forceWindowTopMost };
