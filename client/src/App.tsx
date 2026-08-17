import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            {isShareRoute ? <ProgressPlaceholder /> : <Home />}
          </TooltipProvider>
        </FirebaseAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
