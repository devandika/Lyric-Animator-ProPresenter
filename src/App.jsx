import { useState, useEffect } from "react";
import { ProPresenterLiveApp } from "./components/ProPresenterLiveApp";
import { ProjectorOutputView } from "./components/ProjectorOutputView";
import { MobileRemoteView } from "./components/MobileRemoteView";

export default function App() {
  const [currentHash, setCurrentHash] = useState(() => window.location.hash || "");

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get("mode");

  if (modeParam === "projector") {
    return <ProjectorOutputView />;
  }

  if (modeParam === "live-popout") {
    return <ProjectorOutputView isPopout />;
  }

  if (
    currentHash === "#/remote" ||
    currentHash.startsWith("#/remote") ||
    modeParam === "remote"
  ) {
    return <MobileRemoteView />;
  }

  return <ProPresenterLiveApp />;
}
