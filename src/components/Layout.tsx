import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, CircleUser, LogOut, Menu, X } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAuth } from "../contexts/AuthContext";
import { usePermisos } from "../hooks/usePermisos";
import { seccionesPara } from "../lib/secciones";

function NavEnlaces({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const { puedeAlguno } = usePermisos();
  return <nav aria-label="Principal" className={className}>{seccionesPara(puedeAlguno).map(({ ruta,nombre,Icono }) =>
    <NavLink key={ruta} to={ruta} end={ruta === "/"} onClick={onNavigate}><Icono size={18} aria-hidden="true" /><span>{nombre}</span></NavLink>)}</nav>;
}

function MenuMovil({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);const { logout } = useAuth();
  useEffect(() => { const d=ref.current;if (!d) return;if (abierto && !d.open) d.showModal();if (!abierto && d.open) d.close(); },[abierto]);
  return <dialog ref={ref} onClose={onCerrar} aria-label="Navegación del museo" className="m-0 h-full max-h-none w-full max-w-none bg-white p-0 backdrop:bg-azul/60">
    <div className="flex items-center justify-between border-b border-linea p-4"><img src="/brand/matp_lockup_positivo.svg" alt="Museo Luis Repetto Málaga" className="h-10" />
      <button type="button" onClick={onCerrar} className="rounded-btn p-3 text-azul" aria-label="Cerrar menú"><X size={24} aria-hidden="true" /></button></div>
    <NavEnlaces onNavigate={onCerrar} className="flex flex-col p-4 gap-2 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:p-4 [&_a]:rounded-btn [&_a]:text-azul [&_a]:font-semibold [&_a[aria-current=page]]:bg-fondo-suave" />
    <div className="border-t border-linea p-4"><button type="button" className="btn-glass w-full" onClick={() => { onCerrar();logout(); }}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></div>
  </dialog>;
}

export function Layout() {
  const { logout }=useAuth();const { rol }=usePermisos();const { pathname }=useLocation();
  const [menuAbierto,setMenuAbierto]=useState(false);const [cuentaAbierta,setCuentaAbierta]=useState(false);const cuenta=useRef<HTMLDivElement>(null);const botonCuenta=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cuentaAbierta) return;
    const pointer=(e:PointerEvent) => { if (!cuenta.current?.contains(e.target as Node)) setCuentaAbierta(false); };
    const key=(e:KeyboardEvent) => { if (e.key === "Escape") { setCuentaAbierta(false);botonCuenta.current?.focus(); } };
    document.addEventListener("pointerdown",pointer);document.addEventListener("keydown",key);
    return () => { document.removeEventListener("pointerdown",pointer);document.removeEventListener("keydown",key); };
  },[cuentaAbierta]);
  return <div className="museum-app min-h-screen flex flex-col">
    <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
    <header className="workspace-header"><div className="workspace-brandbar">
      <Link to="/" aria-label="Museo Luis Repetto Málaga · Inicio"><img src="/brand/matp_lockup_positivo.svg" alt="" className="h-10 sm:h-12" /></Link>
      <p className="hidden xl:block text-sm text-gris-2 mr-auto pl-5 border-l border-linea">Sistema de gestión de colecciones</p>
      <div ref={cuenta} className="relative hidden lg:block"><button ref={botonCuenta} type="button" onClick={() => setCuentaAbierta(!cuentaAbierta)} className="workspace-account" aria-expanded={cuentaAbierta} aria-controls="cuenta-opciones" aria-label="Menú de cuenta">
        <CircleUser size={22} aria-hidden="true" /><span className="text-sm font-semibold">{rol || "Mi cuenta"}</span><ChevronDown size={16} aria-hidden="true" /></button>
        {cuentaAbierta && <div id="cuenta-opciones" className="absolute right-0 mt-2 w-56 glass-panel p-2 shadow-sombra">
          <p className="px-3 py-2 text-sm text-gris-2">{rol}</p><button type="button" onClick={logout} className="flex items-center gap-2 rounded-btn px-3 min-h-11 w-full text-sm text-azul hover:bg-fondo-suave"><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></div>}
      </div>
      <button type="button" className="lg:hidden rounded-btn p-3 text-azul" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}><Menu size={24} aria-hidden="true" /></button>
    </div><NavEnlaces className="workspace-nav" /></header>
    <MenuMovil abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    <main id="contenido-principal" tabIndex={-1} className="workspace-main"><ErrorBoundary key={pathname}><Outlet /></ErrorBoundary></main>
    <footer className="workspace-footer"><div><span>Museo de Artes y Tradiciones Populares · Luis Repetto Málaga</span><span>Instituto Riva-Agüero · PUCP</span></div></footer>
  </div>;
}
