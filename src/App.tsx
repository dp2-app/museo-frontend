import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequirePermiso } from "./components/RequirePermiso";
import { SECCIONES } from "./lib/secciones";
import { AdministracionPage } from "./pages/AdministracionPage";
import { AsistenteIAPage } from "./pages/AsistenteIAPage";
import { CuracionImportacionPage } from "./pages/CuracionImportacionPage";
import { CargaDetailPage } from "./pages/CargaDetailPage";
import { ConsultasReportesPage } from "./pages/ConsultasReportesPage";
import { ImportacionPage } from "./pages/ImportacionPage";
import { LoginPage } from "./pages/LoginPage";
import { PanelPrincipalPage } from "./pages/PanelPrincipalPage";
import { PiezaDetailPage } from "./pages/PiezaDetailPage";
import { PiezasPage } from "./pages/PiezasPage";
import { UbicacionMovimientosPage } from "./pages/UbicacionMovimientosPage";

/** Permisos que dan acceso a una sección: una sola fuente con el menú (lib/secciones.ts). */
const permisosDe = (ruta: string) => SECCIONES.find((s) => s.ruta === ruta)?.permisos ?? [];

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
            <RequirePermiso permisos={permisosDe("/coleccion")}>
              <PiezasPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/coleccion/:piezaId"
          element={
            <RequirePermiso permisos={permisosDe("/coleccion")}>
              <PiezaDetailPage />
            </RequirePermiso>
          }
        />
        <Route path="/piezas" element={<Navigate to="/coleccion" replace />} />
        <Route path="/piezas/:piezaId" element={<RedirigirAPiezaDetalle />} />
        <Route path="/colecciones" element={<Navigate to="/coleccion" replace />} />

        {/* Ubicación y movimientos (HU-07, HU-08). */}
        <Route
          path="/ubicacion-y-movimientos"
          element={
            <RequirePermiso permisos={permisosDe("/ubicacion-y-movimientos")}>
              <UbicacionMovimientosPage />
            </RequirePermiso>
          }
        />

        {/* Importación (HU-10 a HU-13). */}
        <Route
          path="/importacion"
          element={
            <RequirePermiso permisos={permisosDe("/importacion")}>
              <ImportacionPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/importacion/curacion"
          element={
            <RequirePermiso permisos={["importacion.ver"]}>
              <CuracionImportacionPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/importacion/:cargaId"
          element={
            <RequirePermiso permisos={permisosDe("/importacion")}>
              <CargaDetailPage />
            </RequirePermiso>
          }
        />

        {/* Consultas y reportes (HU-14 a HU-16). */}
        <Route
          path="/consultas-y-reportes"
          element={
            <RequirePermiso permisos={permisosDe("/consultas-y-reportes")}>
              <ConsultasReportesPage />
            </RequirePermiso>
          }
        />

        {/* Asistente IA (HU-18 a HU-21, RIA-01/02). Ruta legada /ia redirige aquí. */}
        <Route
          path="/asistente-ia"
          element={
            <RequirePermiso permisos={permisosDe("/asistente-ia")}>
              <AsistenteIAPage />
            </RequirePermiso>
          }
        />
        <Route path="/ia" element={<Navigate to="/asistente-ia" replace />} />

        {/* Administración (HU-06, HU-22). */}
        <Route
          path="/administracion"
          element={
            <RequirePermiso permisos={permisosDe("/administracion")}>
              <AdministracionPage />
            </RequirePermiso>
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
