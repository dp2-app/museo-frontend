import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequireRole } from "./components/RequireRole";
import {
  ADMINISTRADOR,
  CATALOGADOR,
  CONSERVACION,
  CONSULTA_INTERNA,
  GESTOR_COLECCIONES,
} from "./lib/secciones";
import { AdministracionPage } from "./pages/AdministracionPage";
import { AsistenteIAPage } from "./pages/AsistenteIAPage";
import { CargaDetailPage } from "./pages/CargaDetailPage";
import { ConsultasReportesPage } from "./pages/ConsultasReportesPage";
import { ImportacionPage } from "./pages/ImportacionPage";
import { LoginPage } from "./pages/LoginPage";
import { PanelPrincipalPage } from "./pages/PanelPrincipalPage";
import { PiezaDetailPage } from "./pages/PiezaDetailPage";
import { PiezasPage } from "./pages/PiezasPage";
import { UbicacionMovimientosPage } from "./pages/UbicacionMovimientosPage";

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
        {/* Panel principal (HU-17, HU-09): todos los roles con sesión lo ven. */}
        <Route index element={<PanelPrincipalPage />} />

        {/* Colección (HU-01 a HU-05). Rutas legadas /piezas redirigen aquí. */}
        <Route
          path="/coleccion"
          element={
            <RequireRole roles={[ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR, CONSULTA_INTERNA]}>
              <PiezasPage />
            </RequireRole>
          }
        />
        <Route
          path="/coleccion/:piezaId"
          element={
            <RequireRole roles={[ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR, CONSULTA_INTERNA]}>
              <PiezaDetailPage />
            </RequireRole>
          }
        />
        <Route path="/piezas" element={<Navigate to="/coleccion" replace />} />
        <Route path="/piezas/:piezaId" element={<RedirigirAPiezaDetalle />} />
        <Route path="/colecciones" element={<Navigate to="/coleccion" replace />} />

        {/* Ubicación y movimientos (HU-07, HU-08). */}
        <Route
          path="/ubicacion-y-movimientos"
          element={
            <RequireRole roles={[ADMINISTRADOR, CONSERVACION]}>
              <UbicacionMovimientosPage />
            </RequireRole>
          }
        />

        {/* Importación (HU-10 a HU-13). */}
        <Route
          path="/importacion"
          element={
            <RequireRole roles={[ADMINISTRADOR, CATALOGADOR]}>
              <ImportacionPage />
            </RequireRole>
          }
        />
        <Route
          path="/importacion/:cargaId"
          element={
            <RequireRole roles={[ADMINISTRADOR, CATALOGADOR]}>
              <CargaDetailPage />
            </RequireRole>
          }
        />

        {/* Consultas y reportes (HU-14 a HU-16). */}
        <Route
          path="/consultas-y-reportes"
          element={
            <RequireRole roles={[ADMINISTRADOR, GESTOR_COLECCIONES, CONSULTA_INTERNA]}>
              <ConsultasReportesPage />
            </RequireRole>
          }
        />

        {/* Asistente IA (HU-18 a HU-21, RIA-01/02). Ruta legada /ia redirige aquí. */}
        <Route
          path="/asistente-ia"
          element={
            <RequireRole roles={[ADMINISTRADOR, GESTOR_COLECCIONES, CATALOGADOR]}>
              <AsistenteIAPage />
            </RequireRole>
          }
        />
        <Route path="/ia" element={<Navigate to="/asistente-ia" replace />} />

        {/* Administración (HU-06, HU-22). */}
        <Route
          path="/administracion"
          element={
            <RequireRole roles={[ADMINISTRADOR]}>
              <AdministracionPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RedirigirAPiezaDetalle() {
  const { piezaId } = useParams<{ piezaId: string }>();
  return <Navigate to={`/coleccion/${piezaId}`} replace />;
}
