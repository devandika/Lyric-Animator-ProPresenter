const dgram = require("dgram");
const http = require("http");
const os = require("os");

let mdnsSocket = null;
let isScanning = false;
const discoveredDevices = new Map();

/**
 * Get local IPv4 interfaces
 */
function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        if (parts.length === 4) {
          subnets.push({
            address: iface.address,
            prefix: `${parts[0]}.${parts[1]}.${parts[2]}.`
          });
        }
      }
    }
  }
  return subnets;
}

/**
 * Check a single IP and port for ProPresenter OpenAPI
 */
function testProPresenterEndpoint(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host,
        port,
        path: "/v1/version",
        timeout: timeoutMs
      },
      (res) => {
        if (res.statusCode === 200) {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve({
                id: `${host}:${port}`,
                name: json.name || `ProPresenter (${host})`,
                version: json.version || "",
                host,
                port,
                online: true,
                discoveredVia: "smart-probe"
              });
            } catch (_) {
              resolve({
                id: `${host}:${port}`,
                name: `ProPresenter (${host})`,
                host,
                port,
                online: true,
                discoveredVia: "smart-probe"
              });
            }
          });
        } else {
          resolve(null);
        }
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Scan local subnet IPs in parallel for ports 50001 and 1025
 */
async function scanSubnet(onFound) {
  const commonPorts = [50001, 1025];
  const subnets = getLocalSubnets();

  // 1. Always check localhost first
  for (const p of commonPorts) {
    testProPresenterEndpoint("127.0.0.1", p, 300).then((res) => {
      if (res && !discoveredDevices.has(res.id)) {
        discoveredDevices.set(res.id, res);
        if (onFound) onFound(Array.from(discoveredDevices.values()));
      }
    });
  }

  // 2. Scan active local subnet
  for (const sub of subnets) {
    const tasks = [];
    // Probe 1..254
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${sub.prefix}${i}`;
      for (const p of commonPorts) {
        tasks.push(
          testProPresenterEndpoint(targetIp, p, 450).then((res) => {
            if (res && !discoveredDevices.has(res.id)) {
              discoveredDevices.set(res.id, res);
              if (onFound) onFound(Array.from(discoveredDevices.values()));
            }
          })
        );
      }
      // Chunk batches of 30 to avoid overwhelming network socket pool
      if (tasks.length >= 30) {
        await Promise.all(tasks);
        tasks.length = 0;
      }
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }
}

/**
 * Start UDP mDNS listener on 224.0.0.251:5353
 */
function startMdnsListener(onFound) {
  try {
    mdnsSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    mdnsSocket.on("error", (err) => {
      console.warn("mDNS socket error:", err.message);
      try {
        mdnsSocket.close();
      } catch (_) {}
      mdnsSocket = null;
    });

    mdnsSocket.on("message", (msg, rinfo) => {
      const msgStr = msg.toString("utf8");
      if (msgStr.includes("ProPresenter") || msgStr.includes("_pro-remote") || msgStr.includes("renewedvision")) {
        const devId = `${rinfo.address}:50001`;
        if (!discoveredDevices.has(devId)) {
          // Probe found mDNS IP to verify port
          testProPresenterEndpoint(rinfo.address, 50001, 400).then((res) => {
            const dev = res || {
              id: devId,
              name: `ProPresenter (${rinfo.address})`,
              host: rinfo.address,
              port: 50001,
              online: true,
              discoveredVia: "mDNS"
            };
            discoveredDevices.set(dev.id, dev);
            if (onFound) onFound(Array.from(discoveredDevices.values()));
          });
        }
      }
    });

    mdnsSocket.bind(5353, () => {
      try {
        mdnsSocket.addMembership("224.0.0.251");
      } catch (_) {}
    });
  } catch (e) {
    console.warn("Could not bind mDNS listener:", e.message);
  }
}

/**
 * Start discovery service
 */
function startProPresenterDiscovery(onDeviceFound) {
  if (isScanning) {
    if (onDeviceFound) onDeviceFound(Array.from(discoveredDevices.values()));
    return;
  }
  isScanning = true;

  startMdnsListener(onDeviceFound);
  scanSubnet(onDeviceFound).finally(() => {
    isScanning = false;
  });
}

function stopProPresenterDiscovery() {
  isScanning = false;
  if (mdnsSocket) {
    try {
      mdnsSocket.close();
    } catch (_) {}
    mdnsSocket = null;
  }
}

function getDiscoveredDevices() {
  return Array.from(discoveredDevices.values());
}

module.exports = {
  startProPresenterDiscovery,
  stopProPresenterDiscovery,
  getDiscoveredDevices,
  testProPresenterEndpoint
};
