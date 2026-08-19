import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProgressPlaceholder from "./pages/ProgressPlaceholder";

function App() {
  const isShareRoute = window.location.pathname.startsWith("/progress/");
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <FirebaseAuthProvider>
          {isShareRoute ? <ProgressPlaceholder /> : <Home />}
        </FirebaseAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
