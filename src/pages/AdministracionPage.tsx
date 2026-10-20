import { useState } from "react";
import { Eye, History, Landmark, List, Settings, ShieldCheck, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { Bitacora } from "../components/f9/Bitacora";
import { RolesPermisos } from "../components/f9/RolesPermisos";
import { Usuarios } from "../components/f9/Usuarios";
import { CamposFicha } from "../components/f0/CamposFicha";
import { ListasValores } from "../components/f0/ListasValores";
import { Institucion } from "../components/f0/Institucion";
import { VistaPreviaFicha } from "../components/f0/FormularioFicha";
import { usePermisos } from "../hooks/usePermisos";

type Pestana = "campos" | "catalogos" | "institucion" | "vista-previa" | "usuarios" | "roles" | "bitacora";

interface Seccion {
  clave: Pestana;
  etiqueta: string;
  Icono: LucideIcon;
  /** Permiso para ver la sección: sin él, la sección no se muestra (la API lo valida de todos modos). */
  permiso: string;
}

const GRUPOS: { titulo: string; secciones: Seccion[] }[] = [
  {
    titulo: "Configuración",
    secciones: [
      { clave: "campos", etiqueta: "Campos de ficha", Icono: SlidersHorizontal, permiso: "config.campos.ver" },
      { clave: "catalogos", etiqueta: "Listas de valores", Icono: List, permiso: "config.listas" },
      { clave: "institucion", etiqueta: "Institución", Icono: Landmark, permiso: "config.institucion.ver" },
      { clave: "vista-previa", etiqueta: "Vista previa", Icono: Eye, permiso: "piezas.ver" },
    ],
  },
  {
    titulo: "Acceso y seguridad",
    secciones: [
      { clave: "usuarios", etiqueta: "Usuarios", Icono: Users, permiso: "usuarios.ver" },
      { clave: "roles", etiqueta: "Roles y permisos", Icono: ShieldCheck, permiso: "roles.ver" },
      { clave: "bitacora", etiqueta: "Bitácora de auditoría", Icono: History, permiso: "auditoria.ver" },
    ],
  },
];

// Administración (HU-06, HU-22, F9): cada sección aparece solo si el rol tiene su permiso «ver»;
// dentro de ella, las acciones de edición dependen de su permiso «editar».
export function AdministracionPage() {
  const { puede } = usePermisos();
  const grupos = GRUPOS.map((g) => ({ ...g, secciones: g.secciones.filter((s) => puede(s.permiso)) })).filter((g) => g.secciones.length > 0);
  const disponibles = grupos.flatMap((g) => g.secciones);
  const [elegida, setElegida] = useState<Pestana | null>(null);
  const pestana = disponibles.find((s) => s.clave === elegida)?.clave ?? disponibles[0]?.clave ?? null;

  return (
    <div className="f0-admin space-y-6">
      <div className="flex items-center gap-4">
        <span className="hidden sm:flex h-14 w-14 items-center justify-center rounded-card bg-white border border-linea"><Settings size={24} className="text-azul" aria-hidden="true" /></span>
        <div>
          <h1>Administración</h1>
          <p className="text-sm text-gris-2">Configura la ficha y los datos de la institución; administra usuarios, roles y permisos.</p>
        </div>
      </div>

      {pestana === null ? (
        <p role="status">Tu rol no tiene secciones de administración habilitadas.</p>
      ) : (
        <div className="f0-workspace">
          <div className="lg:hidden">
            <label htmlFor="f0-seccion" className="block text-sm font-semibold text-azul mb-2">Sección de administración</label>
            <select id="f0-seccion" className="glass-input" value={pestana} onChange={(e) => setElegida(e.target.value as Pestana)}>
              {grupos.map((g) => (
                <optgroup key={g.titulo} label={g.titulo}>
                  {g.secciones.map((s) => <option key={s.clave} value={s.clave}>{s.etiqueta}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <nav className="f0-sidebar" aria-label="Secciones de administración">
            {grupos.map((g) => (
              <div key={g.titulo} className="flex flex-col gap-1">
                <p className="f0-nav-label">{g.titulo}</p>
                {g.secciones.map(({ clave, etiqueta, Icono }) => (
                  <button key={clave} aria-pressed={pestana === clave} onClick={() => setElegida(clave)}
                    className={`f0-nav-item ${pestana === clave ? "f0-nav-active" : ""}`}>
                    <Icono size={20} aria-hidden="true" />{etiqueta}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="min-w-0">
            {pestana === "campos" && <CamposFicha />}
            {pestana === "catalogos" && <ListasValores />}
            {pestana === "institucion" && <Institucion />}
            {pestana === "vista-previa" && <VistaPreviaFicha />}
            {pestana === "usuarios" && <Usuarios />}
            {pestana === "roles" && <RolesPermisos />}
            {pestana === "bitacora" && <Bitacora />}
          </div>
        </div>
      )}
    </div>
  );
}
