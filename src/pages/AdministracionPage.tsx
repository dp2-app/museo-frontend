import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, SlidersHorizontal, List, Landmark, Eye, Users, History } from "lucide-react";
import { api, extraerMensajeError } from "../lib/api";
import { ROL_ETIQUETA } from "../lib/secciones";
import type { Pagina, RegistroAuditoriaGlobal, Rol, Usuario } from "../types";

import { CamposFicha } from "../components/f0/CamposFicha";
import { ListasValores } from "../components/f0/ListasValores";
import { Institucion } from "../components/f0/Institucion";
import { VistaPreviaFicha } from "../components/f0/FormularioFicha";
import { usePermisos } from "../hooks/usePermisos";

type Pestana = "usuarios" | "catalogos" | "bitacora" | "campos" | "institucion" | "vista-previa";

const seccionesAdministracion = [
  ["campos", "Campos de ficha", SlidersHorizontal],
  ["catalogos", "Listas de valores", List],
  ["institucion", "Institución", Landmark],
  ["vista-previa", "Vista previa", Eye],
  ["usuarios", "Usuarios y roles", Users],
  ["bitacora", "Bitácora de auditoría", History],
] as const;

function SeccionUsuarios() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState("");

  const usuariosQuery = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data,
  });
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<Rol[]>("/roles")).data,
  });

  const crear = useMutation({
    mutationFn: async () => (await api.post<Usuario>("/usuarios", { nombre, email, password, rolId })).data,
    onSuccess: () => {
      setNombre("");
      setEmail("");
      setPassword("");
      setRolId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      (await api.patch(`/usuarios/${id}`, { activo })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (err) => setError(extraerMensajeError(err)),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          crear.mutate();
        }}
        className="glass-panel-sm p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="form-label" htmlFor="u-nombre">
            Nombre
          </label>
          <input id="u-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label className="form-label" htmlFor="u-email">
            Correo
          </label>
          <input id="u-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label className="form-label" htmlFor="u-password">
            Contraseña temporal
          </label>
          <input id="u-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label className="form-label" htmlFor="u-rol">
            Rol
          </label>
          <select id="u-rol" required value={rolId} onChange={(e) => setRolId(e.target.value)} className="glass-input min-w-[10rem]">
            <option value="">Seleccionar...</option>
            {rolesQuery.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {ROL_ETIQUETA[r.nombre] ?? r.nombre}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={crear.isPending} className="btn-primary">
          Crear usuario
        </button>
      </form>
      {error && <p className="text-sm text-rojo">{error}</p>}

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gris-2 text-xs uppercase tracking-wide bg-fondo-suave">
            <tr>
              <th className="px-5 py-3 font-semibold">Nombre</th>
              <th className="px-5 py-3 font-semibold">Correo</th>
              <th className="px-5 py-3 font-semibold">Rol</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {usuariosQuery.data?.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3 font-medium text-texto">{u.nombre}</td>
                <td className="px-5 py-3 text-gris-2">{u.email}</td>
                <td className="px-5 py-3 text-gris-2">{ROL_ETIQUETA[u.rol.nombre] ?? u.rol.nombre}</td>
                <td className="px-5 py-3">
                  <span className={`chip ${u.activo ? "!bg-verde/15 !border-verde/40 !text-verde" : ""}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right space-x-3">
                  <button onClick={() => cambiarActivo.mutate({ id: u.id, activo: !u.activo })} className="btn-danger-text">
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => confirm(`¿Eliminar a ${u.nombre}?`) && eliminar.mutate(u.id)}
                    className="text-sm font-semibold text-rojo hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionBitacora() {
  const { data } = useQuery({
    queryKey: ["auditoria"],
    queryFn: async () => (await api.get<Pagina<RegistroAuditoriaGlobal>>("/auditoria", { params: { page_size: 100 } })).data,
  });

  return (
    <ul className="glass-panel divide-y divide-linea text-sm">
      {data?.items.map((r) => (
        <li key={r.id} className="px-5 py-2.5">
          <span className="chip mr-2">{r.accion}</span>
          <span className="text-gris-2">{r.tabla}</span> · {r.campo}: "{r.valorAnterior ?? "—"}" → "{r.valorNuevo ?? "—"}"
        </li>
      ))}
      {data?.items.length === 0 && <li className="px-5 py-3 text-gris-2">Sin registros de auditoría todavía.</li>}
    </ul>
  );
}

// Administración (HU-06, HU-22): usuarios y roles, catálogos maestros y
// bitácora de auditoría. Único rol: Administrador (spec §6).
export function AdministracionPage() {
  const [pestana, setPestana] = useState<Pestana>("campos");

  const { puede } = usePermisos();
  const deshabilitada = (clave: Pestana) => (clave === "campos" && !puede("config.campos")) || (clave === "catalogos" && !puede("config.listas")) || (clave === "institucion" && !puede("config.institucion"));
  return (
    <div className="f0-admin space-y-6">
      <div className="flex items-center gap-4">
        <span className="hidden sm:flex h-14 w-14 items-center justify-center rounded-card bg-white border border-linea"><Settings size={24} className="text-azul" aria-hidden="true" /></span>
        <div>
          <h1>Administración</h1>
          <p className="text-sm text-gris-2">Configura la ficha, las listas y los datos de la institución.</p>
        </div>
      </div>

      <div className="f0-workspace"><div className="lg:hidden"><label htmlFor="f0-seccion" className="block text-sm font-semibold text-azul mb-2">Sección de administración</label><select id="f0-seccion" className="glass-input" value={pestana} onChange={(e) => setPestana(e.target.value as Pestana)}>{seccionesAdministracion.map(([clave, etiqueta]) => <option key={clave} value={clave} disabled={deshabilitada(clave)}>{etiqueta}</option>)}</select></div><nav className="f0-sidebar" aria-label="Secciones de administración"><p className="f0-nav-label">Configuración</p>
        {seccionesAdministracion.map(([clave, etiqueta, Icono]) => (
          <button
            key={clave}
            aria-pressed={pestana === clave}
            disabled={deshabilitada(clave)}
            onClick={() => setPestana(clave)}
            className={`f0-nav-item ${pestana === clave ? "f0-nav-active" : ""}`}
          >
            <Icono size={20} aria-hidden="true" />{etiqueta}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
      {pestana === "usuarios" && <SeccionUsuarios />}
      {pestana === "catalogos" && <ListasValores />}
      {pestana === "campos" && <CamposFicha />}
      {pestana === "institucion" && <Institucion />}
      {pestana === "vista-previa" && <VistaPreviaFicha />}
      {pestana === "bitacora" && <SeccionBitacora />}
      </div></div>
    </div>
  );
}
