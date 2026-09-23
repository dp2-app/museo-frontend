import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { api, extraerMensajeError } from "../lib/api";
import { ROL_ETIQUETA } from "../lib/secciones";
import type { Pagina, RegistroAuditoriaGlobal, Rol, Usuario, ValorVocabulario } from "../types";

type Pestana = "usuarios" | "catalogos" | "bitacora";

const VOCABULARIOS_ADMINISTRABLES = [
  { tipo: "categoria", etiqueta: "Categoría" },
  { tipo: "estado_conservacion", etiqueta: "Estado de conservación" },
  { tipo: "tipo_identificador", etiqueta: "Tipo de identificador" },
  { tipo: "material", etiqueta: "Material" },
  { tipo: "tecnica", etiqueta: "Técnica" },
  { tipo: "procedencia", etiqueta: "Procedencia" },
  { tipo: "autor", etiqueta: "Autor" },
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

function SeccionCatalogos() {
  const queryClient = useQueryClient();
  const [tipoActivo, setTipoActivo] = useState<(typeof VOCABULARIOS_ADMINISTRABLES)[number]["tipo"]>("categoria");
  const [nuevoValor, setNuevoValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valoresQuery = useQuery({
    queryKey: ["vocabularios", tipoActivo],
    queryFn: async () => (await api.get<ValorVocabulario[]>(`/vocabularios/${tipoActivo}`)).data,
  });

  const agregar = useMutation({
    mutationFn: async () => (await api.post(`/vocabularios/${tipoActivo}`, { valor: nuevoValor })).data,
    onSuccess: () => {
      setNuevoValor("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["vocabularios", tipoActivo] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/vocabularios/${tipoActivo}/${id}`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["vocabularios", tipoActivo] });
    },
    onError: (err) => setError(extraerMensajeError(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VOCABULARIOS_ADMINISTRABLES.map((v) => (
          <button
            key={v.tipo}
            onClick={() => setTipoActivo(v.tipo)}
            className={`chip ${tipoActivo === v.tipo ? "!bg-azul !text-white !border-azul" : ""}`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (nuevoValor.trim()) agregar.mutate();
        }}
        className="flex gap-2 max-w-md"
      >
        <input value={nuevoValor} onChange={(e) => setNuevoValor(e.target.value)} className="glass-input" placeholder="Nuevo término..." />
        <button type="submit" className="btn-primary shrink-0">
          Añadir
        </button>
      </form>
      {error && <p className="text-sm text-rojo">{error}</p>}

      <ul className="glass-panel divide-y divide-linea">
        {valoresQuery.data?.map((v) => (
          <li key={v.id} className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-sm text-texto">{v.valor}</span>
            <button onClick={() => eliminar.mutate(v.id)} className="text-sm font-semibold text-rojo hover:underline">
              Eliminar
            </button>
          </li>
        ))}
        {valoresQuery.data?.length === 0 && <li className="px-5 py-3 text-sm text-gris-2">Sin valores registrados.</li>}
      </ul>
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
  const [pestana, setPestana] = useState<Pestana>("usuarios");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <Settings size={28} className="text-azul" aria-hidden="true" />
        <div>
          <h1>Administración</h1>
          <p className="text-sm text-gris-2">HU-06, HU-22 · usuarios, catálogos maestros y bitácora.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-linea">
        {(
          [
            ["usuarios", "Usuarios y roles"],
            ["catalogos", "Catálogos maestros"],
            ["bitacora", "Bitácora de auditoría"],
          ] as const
        ).map(([clave, etiqueta]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              pestana === clave ? "border-rojo text-azul" : "border-transparent text-gris-2 hover:text-azul"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "usuarios" && <SeccionUsuarios />}
      {pestana === "catalogos" && <SeccionCatalogos />}
      {pestana === "bitacora" && <SeccionBitacora />}
    </div>
  );
}
