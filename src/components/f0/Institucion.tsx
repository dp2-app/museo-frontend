import { useConsultaF0 as useQuery } from "../../hooks/useConsultaF0";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { api, erroresPorCampo } from "../../lib/api";
import { usePermisos } from "../../hooks/usePermisos";
import type { Parametro } from "../../types";
import { ErrorCampo, ErrorOperacion, EstadoConsulta, Etiqueta } from "./Comun";

const definiciones = [
  { clave: "nombre", etiqueta: "Nombre de la institución" },
  { clave: "direccion", etiqueta: "Dirección" },
  { clave: "logo_url", etiqueta: "URL del logo" },
] as const;
type Clave = typeof definiciones[number]["clave"];
function EditorInstitucion({ parametros }: { parametros: Parametro[] }) {
  const puede = usePermisos().puede("config.institucion");
  const cache = useQueryClient();
  const iniciales = Object.fromEntries(definiciones.map(({ clave }) => [clave, String(parametros.find((p) => p.clave === `institucion.${clave}`)?.valor ?? "")])) as Record<Clave, string>;
  const [form, setForm] = useState(iniciales);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallos, setFallos] = useState<unknown[]>([]);
  const [aviso, setAviso] = useState("");
  const [logoFallido, setLogoFallido] = useState("");
  const guardar = useMutation({
    mutationFn: async () => {
      // El contrato guarda un parámetro por petición: informar cualquier éxito parcial.
      const resultados = await Promise.allSettled(definiciones.map(({ clave }) => api.put(`/config/parametros/institucion.${clave}`, { valor: clave === "nombre" ? form[clave] : form[clave].trim() || null })));
      const rechazados = resultados.flatMap((r) => r.status === "rejected" ? [r.reason as unknown] : []);
      setFallos(rechazados); setErrores(Object.assign({}, ...rechazados.map(erroresPorCampo)));
      setAviso(rechazados.length ? `${resultados.length - rechazados.length} de ${resultados.length} datos guardados. Corrige los campos indicados.` : "Datos de la institución guardados.");
      await cache.invalidateQueries({ queryKey: ["f0", "parametros"] });
    },
  });
  const logo = /^https?:\/\//i.test(form.logo_url) && logoFallido !== form.logo_url ? form.logo_url : "";
  return <form className="glass-panel p-4 sm:p-6 space-y-5" onSubmit={(e: FormEvent) => { e.preventDefault(); if (puede) { setAviso(""); guardar.mutate(); } }} aria-label="Datos de la institución">
    <h2 className="section-title">Datos de la institución</h2><p>Los cambios se reflejan en los siguientes reportes y exportaciones.</p>
    {fallos.map((error, i) => <ErrorOperacion key={i} error={error} />)}
    <ErrorOperacion error={guardar.error} />
    {definiciones.map(({ clave, etiqueta }) => <div key={clave}><Etiqueta htmlFor={`institucion-${clave}`}>{etiqueta}{clave === "nombre" && " *"}</Etiqueta><input id={`institucion-${clave}`} className="glass-input" required={clave === "nombre"} type={clave === "logo_url" ? "url" : "text"} value={form[clave]} onChange={(e) => setForm({ ...form, [clave]: e.target.value })} aria-invalid={Boolean(errores[`institucion.${clave}`])} aria-describedby={`institucion-${clave}-error`} /><ErrorCampo id={`institucion-${clave}-error`} mensaje={errores[`institucion.${clave}`]} /></div>)}
    <div className="rounded-card border border-linea bg-fondo-suave p-4"><h3 className="section-title mb-3">Vista previa del logo</h3>
      {logo ? <img src={logo} alt="Logo de la institución" className="max-h-40 max-w-full object-contain" referrerPolicy="no-referrer" onError={() => setLogoFallido(form.logo_url)} /> : <p className="flex items-center gap-2"><ImageOff size={24} aria-hidden="true" />{form.logo_url ? "No se puede mostrar el logo. Comprueba que la URL sea pública y corresponda a una imagen." : "Sin logo configurado. Puedes agregar una URL cuando esté disponible."}</p>}
    </div>
    {aviso && <p role="status">{aviso}</p>}<button className="btn-primary" disabled={!puede || guardar.isPending}>{guardar.isPending ? "Guardando…" : "Guardar institución"}</button>
  </form>;
}

export function Institucion() {
  const puede = usePermisos().puede("config.institucion");
  const query = useQuery({ queryKey: ["f0", "parametros"], enabled: puede, queryFn: async () => (await api.get<Parametro[]>("/config/parametros")).data });
  if (!puede) return <p>No tienes permiso para configurar la institución.</p>;
  if (query.isPending || query.isError) return <EstadoConsulta cargando={query.isPending} error={query.error} reintentar={() => { void query.refetch(); }} />;
  return <EditorInstitucion parametros={query.data} />;
}
