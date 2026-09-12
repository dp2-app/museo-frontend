import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CargaDetailPage } from "./pages/CargaDetailPage";
import { ColeccionesPage } from "./pages/ColeccionesPage";
import { IASugerenciasPage } from "./pages/IASugerenciasPage";
import { ImportacionPage } from "./pages/ImportacionPage";
import { LoginPage } from "./pages/LoginPage";
import { PiezaDetailPage } from "./pages/PiezaDetailPage";
import { PiezasPage } from "./pages/PiezasPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/piezas" replace />} />
        <Route path="/piezas" element={<PiezasPage />} />
        <Route path="/piezas/:piezaId" element={<PiezaDetailPage />} />
        <Route path="/colecciones" element={<ColeccionesPage />} />
        <Route path="/importacion" element={<ImportacionPage />} />
        <Route path="/importacion/:cargaId" element={<CargaDetailPage />} />
        <Route path="/ia" element={<IASugerenciasPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
