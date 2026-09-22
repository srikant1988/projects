import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import ClientPortal from "./pages/ClientPortal";
import { api, Me } from "./api";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loggedIn) {
      setMe(null);
      return;
    }
    setChecking(true);
    api
      .me()
      .then(setMe)
      .catch(() => {
        localStorage.removeItem("token");
        setLoggedIn(false);
      })
      .finally(() => setChecking(false));
  }, [loggedIn]);

  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }
  if (checking || !me) {
    return null;
  }
  // A share link (?share=TOKEN) always drops into the client portal, even
  // for an internal user testing the link -- the portal itself resolves
  // the token and is structurally incapable of reaching Model Studio.
  const shareToken = new URLSearchParams(window.location.search).get("share");
  if (me.client_only || shareToken) {
    return <ClientPortal me={me} onLogout={logout} shareToken={shareToken} />;
  }
  return <Workspace onLogout={logout} />;
}
