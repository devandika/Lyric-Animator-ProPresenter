import { ProPresenterLiveApp, ProjectorOutputView } from "./components/ProPresenterLiveApp";

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get("mode");

  if (modeParam === "projector") {
    return <ProjectorOutputView />;
  }

  if (modeParam === "live-popout") {
    return <ProjectorOutputView isPopout />;
  }

  return <ProPresenterLiveApp />;
}
