import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, CircleUser, LogOut, Menu, PanelLeftClose, X } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAuth } from "../contexts/AuthContext";
import { useSelectoresInferiores } from "../hooks/useSelectoresInferiores";
import { usePermisos } from "../hooks/usePermisos";
import { SECCIONES, seccionesPara } from "../lib/secciones";

function NavEnlaces({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const { puedeAlguno } = usePermisos();
  return <nav aria-label="Principal" className={className}>{seccionesPara(puedeAlguno).map(({ ruta,nombre,Icono }) =>
    <NavLink key={ruta} to={ruta} end={ruta === "/"} onClick={onNavigate} title={nombre}><Icono size={18} className="studio-navigation-icon" aria-hidden="true" /><span className="studio-navigation-label">{nombre}</span></NavLink>)}</nav>;
}

function ContenidoMenu({ colapsado = false, onNavigate, onCerrar }: { colapsado?: boolean; onNavigate?: () => void; onCerrar?: () => void }) {
  const { logout } = useAuth();
  return <>
    <Link to="/" onClick={onNavigate} className="studio-brand" aria-label="Museo Luis Repetto Málaga · Inicio"><img src={colapsado ? "/brand/pucp_isotipo_blanco.svg" : "/brand/matp_lockup_blanco.svg"} alt="" /></Link>
    {onCerrar && <button type="button" onClick={onCerrar} className="studio-drawer-close" aria-label="Cerrar menú" title="Cerrar menú"><PanelLeftClose size={22} aria-hidden="true" /></button>}
    <div className="studio-sidebar-heading">Gestión del patrimonio</div>
    <NavEnlaces onNavigate={onNavigate} className="studio-navigation" />
    <div className="studio-menu-footer">
      <div className="studio-sidebar-bottom"><span className="studio-status-dot" aria-hidden="true" /><div><strong>Espacio del museo</strong><p>Instituto Riva-Agüero · PUCP</p></div></div>
      <button type="button" className="studio-signout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => { onNavigate?.(); logout(); }}><LogOut size={18} aria-hidden="true" /><span>Cerrar sesión</span></button>
    </div>
  </>;
}

function MenuMovil({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const { logout } = useAuth();
  useEffect(() => { const d=ref.current;if (!d) return;if (abierto && !d.open) d.showModal();if (!abierto && d.open) d.close(); },[abierto]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const cerrar = () => { if (media.matches) onCerrar(); };
    media.addEventListener("change", cerrar);
    return () => media.removeEventListener("change", cerrar);
  }, [onCerrar]);
  return <dialog id="menu-compacto" ref={ref} onClose={onCerrar} aria-label="Navegación del museo" className="studio-mobile-menu backdrop:bg-azul/60">
    <div className="flex items-center justify-between border-b border-white/15 p-4"><img src="/brand/matp_lockup_blanco.svg" alt="Museo Luis Repetto Málaga" className="h-10" />
      <button type="button" onClick={onCerrar} className="rounded-btn p-3 text-white hover:bg-white/10" aria-label="Cerrar menú"><X size={24} aria-hidden="true" /></button></div>
    <NavEnlaces onNavigate={onCerrar} className="studio-navigation py-5" />
    <div className="border-t border-white/15 p-4"><button type="button" className="flex items-center justify-center gap-2 min-h-11 w-full rounded-btn border border-white/30 text-white hover:bg-white/10" onClick={() => { onCerrar();logout(); }}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></div>
  </dialog>;
}

export function Layout() {
  useSelectoresInferiores();
  const { logout }=useAuth();const { rol }=usePermisos();const { pathname }=useLocation();
  const [sidebarColapsada, setSidebarColapsada] = useState(() => {
    try { return localStorage.getItem("museo.sidebarColapsada") === "true"; } catch { return false; }
  });
  const alternarSidebar = () => setSidebarColapsada(actual => {
    const siguiente = !actual;
    try { localStorage.setItem("museo.sidebarColapsada", String(siguiente)); } catch { /* La navegación funciona sin almacenamiento. */ }
    return siguiente;
  });
  const [menuAbierto,setMenuAbierto]=useState(false);const [cuentaAbierta,setCuentaAbierta]=useState(false);const cuenta=useRef<HTMLDivElement>(null);const botonCuenta=useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cuentaAbierta) return;
    const pointer=(e:PointerEvent) => { if (!cuenta.current?.contains(e.target as Node)) setCuentaAbierta(false); };
    const key=(e:KeyboardEvent) => { if (e.key === "Escape") { setCuentaAbierta(false);botonCuenta.current?.focus(); } };
    document.addEventListener("pointerdown",pointer);document.addEventListener("keydown",key);
    return () => { document.removeEventListener("pointerdown",pointer);document.removeEventListener("keydown",key); };
  },[cuentaAbierta]);
  const seccion = SECCIONES.find((s) => s.ruta !== "/" && pathname.startsWith(s.ruta))?.nombre ?? "Inicio";
  return <div className={`museum-app museum-studio min-h-screen${sidebarColapsada ? " sidebar-collapsed" : ""}`}>
    <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
    <aside id="menu-lateral" className="studio-sidebar print:hidden" aria-label="Espacio de trabajo">
      <ContenidoMenu colapsado={sidebarColapsada} />
    </aside>
    <div className="studio-workspace">
    <header className="studio-topbar print:hidden">
      <button type="button" className="studio-menu-toggle hidden lg:inline-flex" onClick={alternarSidebar} aria-label={sidebarColapsada ? "Expandir menú lateral" : "Contraer menú lateral"} title={sidebarColapsada ? "Expandir menú lateral" : "Contraer menú lateral"} aria-expanded={!sidebarColapsada} aria-controls="menu-lateral">
        <Menu size={24} aria-hidden="true" />
      </button>
      <button type="button" className="studio-menu-toggle lg:hidden" aria-label="Abrir menú" aria-controls="menu-compacto" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(true)}><Menu size={24} aria-hidden="true" /></button>
      <div className="studio-breadcrumb"><span>Museo Luis Repetto Málaga</span><span aria-hidden="true">/</span><strong>{seccion}</strong></div>
      <div className="studio-account-area">      <div ref={cuenta} className="relative hidden lg:block"><button ref={botonCuenta} type="button" onClick={() => setCuentaAbierta(!cuentaAbierta)} className="workspace-account" aria-expanded={cuentaAbierta} aria-controls="cuenta-opciones" aria-label="Menú de cuenta">
        <CircleUser size={22} aria-hidden="true" /><span className="hidden sm:inline text-sm font-semibold">{rol || "Mi cuenta"}</span><ChevronDown size={16} aria-hidden="true" /></button>
        {cuentaAbierta && <div id="cuenta-opciones" className="absolute right-0 mt-2 w-56 glass-panel p-2 shadow-sombra">
          <p className="px-3 py-2 text-sm text-gris-2">{rol}</p><button type="button" onClick={logout} className="flex items-center gap-2 rounded-btn px-3 min-h-11 w-full text-sm text-azul hover:bg-fondo-suave"><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></div>}
      </div>
</div>
    </header>
    <MenuMovil abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    <main id="contenido-principal" tabIndex={-1} className="workspace-main"><ErrorBoundary key={pathname}><Outlet /></ErrorBoundary></main>
    <footer className="workspace-footer"><div><span>Museo de Artes y Tradiciones Populares · Luis Repetto Málaga</span><span>Instituto Riva-Agüero · PUCP</span></div></footer>
    </div>
  </div>;
}
