import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { BillingProvider } from "@/context/BillingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import DocumentDetail from "@/pages/DocumentDetail";
import Archive from "@/pages/Archive";
import Reminders from "@/pages/Reminders";
import Profiles from "@/pages/Profiles";
import Pricing from "@/pages/Pricing";
import Checkout from "@/pages/Checkout";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import Legal from "@/pages/Legal";
import Guide from "@/pages/Guide";
import Care from "@/pages/Care";
import Therapy from "@/pages/care/Therapy";
import Vitals from "@/pages/care/Vitals";
import Expenses from "@/pages/care/Expenses";
import Dossier from "@/pages/care/Dossier";
import Kit from "@/pages/care/Kit";
import Compare from "@/pages/care/Compare";
import Bureaucracy from "@/pages/care/Bureaucracy";
import Clinical from "@/pages/care/Clinical";

const withLayout = (el) => (
  <ProtectedRoute>
    <Layout>{el}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <div className="App">
      <LanguageProvider>
        <AuthProvider>
          <BillingProvider>
            <ProfileProvider>
              <BrowserRouter>
                <Toaster position="top-center" richColors />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/privacy" element={<Legal page="privacy" />} />
                  <Route path="/terms" element={<Legal page="terms" />} />
                  <Route path="/disclaimer" element={<Legal page="disclaimer" />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/" element={withLayout(<Home />)} />
                  <Route path="/upload" element={withLayout(<Upload />)} />
                  <Route path="/document/:id" element={withLayout(<DocumentDetail />)} />
                  <Route path="/archive" element={withLayout(<Archive />)} />
                  <Route path="/reminders" element={withLayout(<Reminders />)} />
                  <Route path="/profiles" element={withLayout(<Profiles />)} />
                  <Route path="/pricing" element={withLayout(<Pricing />)} />
                  <Route path="/checkout/:plan" element={withLayout(<Checkout />)} />
                  <Route path="/admin" element={withLayout(<Admin />)} />
                  <Route path="/guide" element={withLayout(<Guide />)} />
                  <Route path="/care" element={withLayout(<Care />)} />
                  <Route path="/care/therapy" element={withLayout(<Therapy />)} />
                  <Route path="/care/vitals" element={withLayout(<Vitals />)} />
                  <Route path="/care/expenses" element={withLayout(<Expenses />)} />
                  <Route path="/care/dossier" element={withLayout(<Dossier />)} />
                  <Route path="/care/kit" element={withLayout(<Kit />)} />
                  <Route path="/care/compare" element={withLayout(<Compare />)} />
                  <Route path="/care/bureaucracy" element={withLayout(<Bureaucracy />)} />
                  <Route path="/care/clinical" element={withLayout(<Clinical />)} />
                  <Route path="*" element={withLayout(<NotFound />)} />
                </Routes>
              </BrowserRouter>
            </ProfileProvider>
          </BillingProvider>
        </AuthProvider>
      </LanguageProvider>
    </div>
  );
}

export default App;
