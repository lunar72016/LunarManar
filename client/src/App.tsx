import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ClientPortalPage from "./pages/ClientPortalPage";
import ProgressPlaceholder from "./pages/ProgressPlaceholder";
import { useEffect, useState } from "react";

function useHashRoute() {
  const [hashRoute, setHashRoute] = useState(() => window.location.hash.replace(/^#/, ""));

  useEffect(() => {
    const refreshRoute = () => setHashRoute(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", refreshRoute);
    return () => window.removeEventListener("hashchange", refreshRoute);
  }, []);

  return hashRoute;
}

function App() {
  const hashRoute = useHashRoute();
  const isClientRoute = hashRoute.startsWith("/client") || window.location.pathname.startsWith("/client");
  const isShareRoute = window.location.pathname.startsWith("/progress/");
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <FirebaseAuthProvider>
          {isClientRoute ? <ClientPortalPage /> : isShareRoute ? <ProgressPlaceholder /> : <Home />}
        </FirebaseAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
