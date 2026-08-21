import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ClientPortalPage from "./pages/ClientPortalPage";
import ProgressPlaceholder from "./pages/ProgressPlaceholder";

function App() {
  const hashRoute = window.location.hash.replace(/^#/, "");
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
