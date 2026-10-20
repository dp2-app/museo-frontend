import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { usePermisos } from "../../hooks/usePermisos";
import { api, erroresPorCampo } from "../../lib/api";
import { ROL_ETIQUETA } from "../../lib/secciones";
import type { RolDetalle, Usuario } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "../f0/Comun";

const etiquetaRol = (nombre: string) => ROL_ETIQUETA[nombre] ?? nombre;
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "Nunca");

function FilaUsuario({ usuario, roles, puedeEditar, esYo }: { usuario: Usuario; roles: RolDetalle[]; puedeEditar: boolean; esYo: boolean }) {
  const cache = useQueryClient();
  const [modo, setModo] = useState<"ver" | "clave" | "baja">("ver");
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState("");
  const refrescar = () => cache.invalidateQueries({ queryKey: ["f9", "usuarios"] });

  const editar = useMutation({
    mutationFn: async (cambios: Record<string, unknown>) => (await api.patch<Usuario>(`/usuarios/${usuario.id}`, cambios)).data,
    onSuccess: async (_d, cambios) => {
      setAviso("password" in cambios ? "Contraseña restablecida." : "Cambio guardado.");
      setModo("ver"); setClave("");
      await refrescar();
      if (esYo) await cache.invalidateQueries({ queryKey: ["sesion-v3"] });
    },
    onError: () => { void refrescar(); },
  });
  const baja = useMutation({
    mutationFn: async () => api.delete(`/usuarios/${usuario.id}`),
    onSuccess: async () => { setModo("ver"); await refrescar(); },
  });
  const error = editar.error ?? baja.error;
  const local = !usuario.proveedorAuth || usuario.proveedorAuth === "local";

  return (
    <>
      <tr>
        <th scope="row" className="font-semibold">
          {usuario.nombre}{esYo && <span className="ml-2 f0-badge f0-badge-active">Tú</span>}
          <span className="block text-xs font-normal text-texto/60 mt-1">{usuario.email}</span>
        </th>
        <td>
          {puedeEditar ? (
            <select className="glass-input !min-h-11" aria-label={`Rol de ${usuario.nombre}`} value={usuario.rol.id} disabled={editar.isPending}
              onChange={(e) => { setAviso(""); editar.mutate({ rolId: e.target.value }); }}>
              {roles.map((r) => <option key={r.id} value={r.id} disabled={!r.activo && r.id !== usuario.rol.id}>{etiquetaRol(r.nombre)}{r.activo ? "" : " (inactivo)"}</option>)}
            </select>
          ) : etiquetaRol(usuario.rol.nombre)}
        </td>
        <td>
          <span className={`f0-badge ${usuario.activo ? "f0-badge-active" : ""}`}><span className="h-1 w-1 rounded-pill bg-current" />{usuario.activo ? "Activo" : "Inactivo"}</span>
          <span className="block text-xs text-texto/60 mt-1">Último acceso: {fecha(usuario.ultimoAcceso)}</span>
        </td>
        <td>
          {puedeEditar && (
            <div className="flex flex-wrap gap-1">
              {local && <button type="button" className="f0-action" onClick={() => { setModo(modo === "clave" ? "ver" : "clave"); setAviso(""); }}><KeyRound size={18} aria-hidden="true" />Contraseña</button>}
              <button type="button" className="f0-action" disabled={editar.isPending} onClick={() => { setAviso(""); editar.mutate({ activo: !usuario.activo }); }}>
                {usuario.activo ? "Desactivar" : "Activar"}
              </button>
              <button type="button" className="f0-action" onClick={() => { setModo(modo === "baja" ? "ver" : "baja"); setAviso(""); }}>Dar de baja</button>
            </div>
          )}
        </td>
      </tr>
      {(modo !== "ver" || error || aviso) && (
        <tr>
          <td colSpan={4} className="!bg-fondo-suave/60">
            <ErrorOperacion error={error} />
            {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}
            {modo === "clave" && (
              <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); editar.mutate({ password: clave }); }}>
                <div><Etiqueta htmlFor={`clave-${usuario.id}`}>Nueva contraseña (mínimo 8 caracteres)</Etiqueta>
                  <input id={`clave-${usuario.id}`} type="password" className="glass-input" required minLength={8} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} /></div>
                <button className="btn-primary" disabled={editar.isPending}>Restablecer</button>
                <button type="button" className="btn-glass" onClick={() => { setModo("ver"); setClave(""); }}>Cancelar</button>
              </form>
            )}
            {modo === "baja" && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p>¿Dar de baja a <strong>{usuario.nombre}</strong>? No podrá iniciar sesión; sus registros históricos se conservan.</p>
                <button type="button" className="btn-primary" disabled={baja.isPending} onClick={() => baja.mutate()}>Confirmar baja</button>
                <button type="button" className="btn-glass" onClick={() => setModo("ver")}>Cancelar</button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function NuevoUsuario({ roles }: { roles: RolDetalle[] }) {
  const cache = useQueryClient();
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rolId: "" });
  const [aviso, setAviso] = useState("");
  const crear = useMutation({
    mutationFn: async () => (await api.post<Usuario>("/usuarios", form)).data,
    onSuccess: async (u) => {
      setAviso(`Usuario ${u.email} creado. Entrégale la contraseña temporal por un canal seguro.`);
      setForm({ nombre: "", email: "", password: "", rolId: "" });
      await cache.invalidateQueries({ queryKey: ["f9", "usuarios"] });
    },
  });
  const errores = erroresPorCampo(crear.error);
  return (
    <form className="f0-surface space-y-4" aria-label="Nuevo usuario" onSubmit={(e: FormEvent) => { e.preventDefault(); setAviso(""); crear.mutate(); }}>
      <h3 className="section-title flex items-center gap-2"><UserPlus size={20} aria-hidden="true" />Nuevo usuario</h3>
      <ErrorOperacion error={crear.error && Object.keys(errores).length === 0 ? crear.error : null} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div><Etiqueta htmlFor="u-nombre">Nombre *</Etiqueta>
          <input id="u-nombre" className="glass-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} aria-invalid={Boolean(errores.nombre)} />
          <ErrorCampo id="u-nombre-error" mensaje={errores.nombre} /></div>
        <div><Etiqueta htmlFor="u-email">Correo *</Etiqueta>
          <input id="u-email" type="email" className="glass-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errores.email)} aria-describedby="u-email-error" />
          <ErrorCampo id="u-email-error" mensaje={errores.email} /></div>
        <div><Etiqueta htmlFor="u-password">Contraseña temporal *</Etiqueta>
          <input id="u-password" type="password" className="glass-input" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={Boolean(errores.password)} aria-describedby="u-password-ayuda u-password-error" />
          <p id="u-password-ayuda" className="mt-1 text-sm text-texto/70">Mínimo 8 caracteres.</p><ErrorCampo id="u-password-error" mensaje={errores.password} /></div>
        <div><Etiqueta htmlFor="u-rol">Rol *</Etiqueta>
          <select id="u-rol" className="glass-input" required value={form.rolId} onChange={(e) => setForm({ ...form, rolId: e.target.value })} aria-invalid={Boolean(errores.rolId)} aria-describedby="u-rol-error">
            <option value="">Seleccionar…</option>
            {roles.filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{etiquetaRol(r.nombre)}</option>)}
          </select>
          <ErrorCampo id="u-rol-error" mensaje={errores.rolId} /></div>
      </div>
      {aviso && <p role="status" className="font-semibold text-azul">{aviso}</p>}
      <div><button className="btn-primary" disabled={crear.isPending}>{crear.isPending ? "Creando…" : "Crear usuario"}</button></div>
    </form>
  );
}

/** Usuarios (RF-51, RF-53): alta, rol, contraseña, desactivación y baja lógica. Ver y editar son permisos distintos. */
export function Usuarios() {
  const { puede, sesion } = usePermisos();
  const verUsuarios = puede("usuarios.ver");
  const puedeEditar = puede("usuarios.gestionar");
  const usuarios = useQuery({ queryKey: ["f9", "usuarios"], enabled: verUsuarios, queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data });
  const roles = useQuery({ queryKey: ["f9", "roles"], enabled: verUsuarios && (puede("roles.ver") || puedeEditar), queryFn: async () => (await api.get<RolDetalle[]>("/roles")).data });

  if (!verUsuarios) return <p>No tienes permiso para ver los usuarios.</p>;
  if (usuarios.isPending || usuarios.isError) return <EstadoConsulta cargando={usuarios.isPending} error={usuarios.error} reintentar={() => { void usuarios.refetch(); }} />;
  const listaRoles = roles.data ?? [];

  return (
    <section className="space-y-5" aria-label="Usuarios">
      <div>
        <h2 className="section-title">Usuarios</h2>
        <p className="text-texto">{puedeEditar
          ? "Crea cuentas, cambia el rol, restablece contraseñas y desactiva usuarios. Siempre debe quedar un administrador activo."
          : "Consulta las cuentas del sistema. Tu rol no puede modificarlas."}</p>
      </div>
      {puedeEditar && <NuevoUsuario roles={listaRoles} />}
      <div className="f0-catalogue">
        <div className="overflow-x-auto [contain:paint]" role="region" aria-label="Lista de usuarios" tabIndex={0}>
          <table className="f0-table min-w-[44rem]">
            <thead><tr>{["Usuario", "Rol", "Estado", puedeEditar ? "Acciones" : ""].map((t, i) => <th scope="col" key={i}>{t}</th>)}</tr></thead>
            <tbody>
              {usuarios.data.map((u) => <FilaUsuario key={u.id} usuario={u} roles={listaRoles} puedeEditar={puedeEditar} esYo={u.id === sesion?.usuario.id} />)}
            </tbody>
          </table>
        </div>
        {!usuarios.data.length && <p className="p-6">No hay usuarios.</p>}
      </div>
    </section>
  );
}
