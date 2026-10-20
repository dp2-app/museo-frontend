import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Info, Plus, ShieldCheck } from "lucide-react";
import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { usePermisos } from "../../hooks/usePermisos";
import { api, erroresPorCampo } from "../../lib/api";
import { armarMatriz, efectosEnOtras, mismoConjunto, nivelDe } from "../../lib/permisos";
import type { Permiso, RolDetalle, VisibilidadCampo } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";
import { CamposVisibles, type CampoDeFicha } from "./CamposVisibles";
import { MatrizPermisos } from "./MatrizPermisos";

interface EditorProps {
  rol: RolDetalle | null; // null: rol nuevo
  roles: RolDetalle[];
  catalogo: Permiso[];
  visibilidad: UseQueryResult<VisibilidadCampo[]>;
  puedeEditar: boolean;
  onGuardado: (id: string, mensaje: string) => void;
}

const enLista = (nombres: string[]) => nombres.join(", ");

/** Campos que el rol no ve según el servidor. */
const ocultosDe = (datos: VisibilidadCampo[] | undefined, rolId: string | null) =>
  new Set((datos ?? []).filter((d) => d.rolId === rolId && !d.visible).map((d) => d.campoId));

function EditorRol({ rol, roles, catalogo, visibilidad, puedeEditar, onGuardado }: EditorProps) {
  const cache = useQueryClient();
  const { puede } = usePermisos();
  const verCampos = puede("config.visibilidad.ver");
  const editarCampos = puede("config.visibilidad");
  const inicial = new Set(rol?.permisos ?? []);
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [activo, setActivo] = useState(rol?.activo ?? true);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(inicial));
  const [efectos, setEfectos] = useState<string[]>([]);
  // Cambios de visibilidad todavía sin guardar: campoId → visible deseado.
  const [cambiosCampos, setCambiosCampos] = useState<Map<string, boolean>>(new Map());

  const modulos = useMemo(() => armarMatriz(catalogo), [catalogo]);
  const filas = modulos.flatMap((m) => m.filas);
  const conAcceso = filas.filter((f) => nivelDe(f, seleccion) !== "sin").length;

  const rolId = rol?.id ?? null;
  const camposDeFicha = useMemo<CampoDeFicha[]>(
    () => [...new Map((visibilidad.data ?? []).map((d) => [d.campoId, { campoId: d.campoId, clave: d.clave, etiqueta: d.etiqueta, grupo: d.grupo }])).values()],
    [visibilidad.data],
  );
  const ocultosServidor = useMemo(() => ocultosDe(visibilidad.data, rolId), [visibilidad.data, rolId]);
  const visibleCampo = (campoId: string) => cambiosCampos.get(campoId) ?? !ocultosServidor.has(campoId);
  const camposPendientes = [...cambiosCampos].filter(([campoId, visible]) => visible !== !ocultosServidor.has(campoId));

  const sinGuardar = !rol
    ? true
    : nombre !== rol.nombre || descripcion !== (rol.descripcion ?? "") || activo !== rol.activo || !mismoConjunto(seleccion, inicial) || camposPendientes.length > 0;
  const puedeGuardar = puedeEditar || (Boolean(rol) && editarCampos);

  const guardar = useMutation({
    mutationFn: async () => {
      let guardado: RolDetalle;
      if (!rol) {
        guardado = (await api.post<RolDetalle>("/roles", { nombre, descripcion: descripcion || null, permisos: [...seleccion] })).data;
      } else {
        const cambios: Record<string, unknown> = {};
        if (nombre !== rol.nombre && !rol.esSistema) cambios.nombre = nombre;
        if (descripcion !== (rol.descripcion ?? "")) cambios.descripcion = descripcion;
        if (activo !== rol.activo) cambios.activo = activo;
        if (Object.keys(cambios).length) await api.patch(`/roles/${rol.id}`, cambios);
        guardado = !mismoConjunto(seleccion, inicial)
          ? (await api.put<RolDetalle>(`/roles/${rol.id}/permisos`, { permisos: [...seleccion] })).data
          : rol;
      }
      await Promise.all(camposPendientes.map(([campoId, visible]) =>
        api.put("/config/visibilidad-campos", { campoId, rolId: guardado.id, visible })));
      return guardado;
    },
    onSuccess: async (guardado) => {
      setCambiosCampos(new Map());
      setEfectos([]);
      await cache.invalidateQueries({ queryKey: ["f9"] });
      await cache.invalidateQueries({ queryKey: ["sesion-v3"] }); // si cambió el rol del propio usuario, el menú se actualiza
      onGuardado(guardado.id, rol ? "Rol guardado. Los cambios rigen desde la próxima acción de sus usuarios." : "Rol creado. Ya puedes asignarlo a usuarios.");
    },
    onError: () => { void cache.invalidateQueries({ queryKey: ["f9"] }); },
  });
  const errores = erroresPorCampo(guardar.error);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (puedeGuardar && sinGuardar) guardar.mutate();
  }
  function descartar() {
    setNombre(rol?.nombre ?? ""); setDescripcion(rol?.descripcion ?? ""); setActivo(rol?.activo ?? true);
    setSeleccion(new Set(inicial)); setCambiosCampos(new Map()); setEfectos([]); guardar.reset();
  }
  /** Aplica un cambio de la matriz y avisa de lo que se ajustó solo en otras funcionalidades (dependencias). */
  function cambiarPermisos(siguiente: Set<string>, recurso: string) {
    const { activadas, quitadas } = efectosEnOtras(catalogo, seleccion, siguiente, recurso);
    setSeleccion(siguiente);
    setEfectos([
      ...(activadas.length ? [`También se activó el acceso a ${enLista(activadas)}, porque es necesario.`] : []),
      ...(quitadas.length ? [`También se quitó el acceso a ${enLista(quitadas)}, porque dependía de lo que cambiaste.`] : []),
    ]);
  }
  function fijarVisible(campoId: string, visible: boolean) {
    setCambiosCampos((previo) => {
      const siguiente = new Map(previo);
      if (visible === !ocultosServidor.has(campoId)) siguiente.delete(campoId); else siguiente.set(campoId, visible);
      return siguiente;
    });
  }
  function partirDe(origen: RolDetalle | undefined) {
    setSeleccion(new Set(origen?.permisos ?? []));
    setEfectos([]);
    const ocultos = origen ? ocultosDe(visibilidad.data, origen.id) : new Set<string>();
    setCambiosCampos(new Map(camposDeFicha.filter((c) => ocultos.has(c.campoId)).map((c) => [c.campoId, false])));
  }

  return (
    <form className="space-y-5" onSubmit={enviar} aria-label={rol ? `Permisos del rol ${rol.nombre}` : "Nuevo rol"}>
      <div className="f0-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">{rol ? rol.nombre : "Nuevo rol"}</h3>
          <p className="text-sm text-texto/70" role="status">{conAcceso} de {filas.length} funcionalidades con acceso{sinGuardar && rol ? " · cambios sin guardar" : ""}</p>
        </div>
        <ErrorOperacion error={guardar.error && Object.keys(errores).length === 0 ? guardar.error : null} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Etiqueta htmlFor="rol-nombre">Nombre del rol *</Etiqueta>
            <input id="rol-nombre" className="glass-input" required value={nombre} readOnly={!puedeEditar || Boolean(rol?.esSistema)}
              onChange={(e) => setNombre(e.target.value)} aria-invalid={Boolean(errores.nombre)} aria-describedby="rol-nombre-ayuda rol-nombre-error" />
            <p id="rol-nombre-ayuda" className="mt-1 text-sm text-texto/70">{rol?.esSistema ? "Rol precargado del museo: su nombre no se cambia, sus permisos sí." : "Por ejemplo: Voluntariado, Auditor de cargas."}</p>
            <ErrorCampo id="rol-nombre-error" mensaje={errores.nombre} />
          </div>
          <div>
            <Etiqueta htmlFor="rol-descripcion">Descripción</Etiqueta>
            <input id="rol-descripcion" className="glass-input" value={descripcion} readOnly={!puedeEditar} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>
        {!rol && puedeEditar && (
          <div className="max-w-md">
            <Etiqueta htmlFor="rol-copiar">Partir de otro rol</Etiqueta>
            <select id="rol-copiar" className="glass-input" defaultValue="" onChange={(e) => partirDe(roles.find((r) => r.id === e.target.value))}>
              <option value="">Sin permisos (empezar de cero)</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
            <p className="mt-1 text-sm text-texto/70">Copia sus accesos y los campos de la ficha que ve; después puedes ajustarlos.</p>
          </div>
        )}
        {rol && puedeEditar && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-azul" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Rol activo <span className="text-sm text-texto/70">(si se desactiva, sus usuarios dejan de poder usar el sistema)</span>
          </label>
        )}
      </div>

      {!puedeEditar && <p className="f0-notice"><Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Solo lectura: tu rol puede ver los roles y sus permisos, no modificarlos.</span></p>}
      <p className="f0-notice">
        <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Elige, para cada funcionalidad, si el rol puede <strong>solo ver</strong> o <strong>ver y editar</strong>. Aprobar, exportar, dar de baja y similares se marcan aparte, en «Acciones adicionales».
          Si un acceso necesita otro, se activa solo; si quitas un acceso, se quitan los que dependían de él.</span>
      </p>
      {efectos.length > 0 && <div role="status" className="f0-notice">{efectos.map((e) => <p key={e}>{e}</p>)}</div>}
      <MatrizPermisos modulos={modulos} catalogo={catalogo} seleccion={seleccion} soloLectura={!puedeEditar} onCambiar={cambiarPermisos} />

      {verCampos && (
        visibilidad.isPending || visibilidad.isError
          ? <EstadoConsulta cargando={visibilidad.isPending} error={visibilidad.error} reintentar={() => { void visibilidad.refetch(); }} />
          : <CamposVisibles rolNombre={nombre} campos={camposDeFicha} visible={visibleCampo} onCambiar={fijarVisible} soloLectura={!editarCampos} />
      )}

      {puedeGuardar ? (
        <div className="flex flex-wrap gap-3 border-t border-linea pt-4">
          <button className="btn-primary" disabled={guardar.isPending || !sinGuardar || !nombre.trim()}>
            {guardar.isPending ? "Guardando…" : rol ? "Guardar cambios" : "Crear rol"}
          </button>
          <button type="button" className="btn-glass" onClick={descartar} disabled={guardar.isPending || (Boolean(rol) && !sinGuardar)}>
            Descartar cambios
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** Roles y permisos (RF-52, RF-57): qué puede hacer un rol en cada funcionalidad y qué campos de la ficha ve. */
export function RolesPermisos() {
  const { puede } = usePermisos();
  const verRoles = puede("roles.ver");
  const puedeEditar = puede("roles.gestionar");
  const [seleccionId, setSeleccionId] = useState<string | "nuevo" | null>(null);
  const [aviso, setAviso] = useState("");

  const roles = useQuery({ queryKey: ["f9", "roles"], enabled: verRoles, queryFn: async () => (await api.get<RolDetalle[]>("/roles")).data });
  const permisos = useQuery({ queryKey: ["f9", "permisos"], enabled: verRoles, queryFn: async () => (await api.get<Permiso[]>("/permisos")).data });
  const visibilidad = useQuery({ queryKey: ["f9", "visibilidad"], enabled: verRoles && puede("config.visibilidad.ver"),
    queryFn: async () => (await api.get<VisibilidadCampo[]>("/config/visibilidad-campos")).data });

  if (!verRoles) return <p>No tienes permiso para ver los roles y permisos.</p>;
  if (roles.isPending || roles.isError || permisos.isPending || permisos.isError) {
    return <EstadoConsulta cargando={roles.isPending || permisos.isPending} error={roles.error ?? permisos.error}
      reintentar={() => { void roles.refetch(); void permisos.refetch(); }} />;
  }
  const lista = roles.data;
  const actualId = seleccionId ?? lista.find((r) => r.activo)?.id ?? lista[0]?.id ?? null;
  const rol = actualId && actualId !== "nuevo" ? lista.find((r) => r.id === actualId) ?? null : null;

  return (
    <section className="space-y-5" aria-label="Roles y permisos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Roles y permisos</h2>
          <p className="text-texto">Define qué puede ver y hacer cada rol en cada funcionalidad, y qué campos de la ficha ve. La API valida estos permisos en cada llamada.</p>
        </div>
        {puedeEditar && (
          <button type="button" className="btn-primary" onClick={() => { setAviso(""); setSeleccionId("nuevo"); }}><Plus size={20} aria-hidden="true" />Nuevo rol</button>
        )}
      </div>

      <nav aria-label="Roles" className="flex flex-wrap gap-2">
        {lista.map((r) => (
          <button key={r.id} type="button" aria-pressed={actualId === r.id} onClick={() => { setAviso(""); setSeleccionId(r.id); }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition ${actualId === r.id ? "border-azul bg-azul text-white" : "border-linea bg-white text-azul hover:bg-fondo-suave"}`}>
            <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
            <span>{r.nombre}</span>
            <span className={`text-xs font-normal ${actualId === r.id ? "text-white/80" : "text-texto/60"}`}>
              {r.esSistema ? "precargado" : ""}{r.esSistema && !r.activo ? " · " : ""}{r.activo ? "" : "inactivo"}
            </span>
          </button>
        ))}
        {actualId === "nuevo" && (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-azul bg-azul px-4 py-2 text-sm font-semibold text-white"><Plus size={16} aria-hidden="true" />Nuevo rol</span>
        )}
      </nav>
      <div className="min-w-0 space-y-4">
        {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}
        <EditorRol key={rol?.id ?? "nuevo"} rol={rol} roles={lista} catalogo={permisos.data} visibilidad={visibilidad} puedeEditar={puedeEditar}
          onGuardado={(id, mensaje) => { setSeleccionId(id); setAviso(mensaje); }} />
      </div>
    </section>
  );
}
