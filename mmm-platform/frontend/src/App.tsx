import { useState } from "react";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));

  function logout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
  }

  return loggedIn ? <Workspace onLogout={logout} /> : <Login onLoggedIn={() => setLoggedIn(true)} />;
}
