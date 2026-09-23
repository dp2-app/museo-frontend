import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { CircleUser, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROL_ETIQUETA, seccionesPara } from "../lib/secciones";

// Header/nav/footer per la especificación de diseño §6. El nombre del
// archivo/export se conserva (Layout) para no tocar App.tsx ni los imports
// existentes; lo que cambia es el shell completo: logo oficial, navegación
// filtrada por rol (RBAC visual, spec §5), menú móvil a pantalla completa y
// footer institucional.

function NavEnlaces({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { rol } = useAuth();
  const secciones = seccionesPara(rol);

  return (
    <nav className={className}>
      {secciones.map(({ ruta, nombre, Icono }) => (
        <NavLink
          key={ruta}
          to={ruta}
          end={ruta === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2 border-b-2 px-1 py-1 transition ${
              isActive ? "border-rojo text-azul font-semibold" : "border-transparent text-azul/80 hover:text-azul"
            }`
          }
        >
          <Icono size={18} aria-hidden="true" />
          {nombre}
        </NavLink>
      ))}
    </nav>
  );
}

function MenuMovil({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (abierto && !dialog.open) dialog.showModal();
    if (!abierto && dialog.open) dialog.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCerrar}
      className="m-0 h-full max-h-none w-full max-w-none bg-azul p-0 backdrop:bg-azul/60"
    >
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-btn p-2 text-white hover:bg-white/10"
          aria-label="Cerrar menú"
        >
          <X size={28} aria-hidden="true" />
        </button>
      </div>
      <NavEnlaces
        onNavigate={onCerrar}
        className="flex flex-col gap-1 px-6 pb-8 text-[24px] font-semibold text-white [&_a]:text-white/90 [&_a.font-semibold]:text-white [&_a]:border-b-0 [&_a]:py-3"
      />
    </dialog>
  );
}

export function Layout() {
  const { rol, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-linea shadow-sombra">
        <div className="max-w-contenido mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Escritorio: lockup completo. Móvil: solo isotipo + rol activo (spec §6). */}
          <img
            src="/brand/matp_lockup_positivo.svg"
            alt='Museo de Artes y Tradiciones Populares "Luis Repetto Málaga"'
            className="h-10 hidden md:block"
          />
          <img src="/brand/pucp_isotipo_positivo.svg" alt="" aria-hidden="true" className="h-9 md:hidden" />

          <NavEnlaces className="hidden lg:flex items-center gap-5 text-[15px] font-semibold" />

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs font-semibold uppercase tracking-wide text-gris-2">
              {rol ? ROL_ETIQUETA[rol] ?? rol : ""}
            </span>

            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setCuentaAbierta((v) => !v)}
                className="flex items-center gap-1.5 rounded-btn p-1.5 text-azul hover:bg-fondo-suave"
                aria-haspopup="menu"
                aria-expanded={cuentaAbierta}
                aria-label="Menú de cuenta"
              >
                <CircleUser size={24} aria-hidden="true" />
              </button>
              {cuentaAbierta && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 glass-panel-sm py-2 text-sm"
                  onMouseLeave={() => setCuentaAbierta(false)}
                >
                  <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gris-2">
                    {rol ? ROL_ETIQUETA[rol] ?? rol : ""}
                  </p>
                  <button
                    role="menuitem"
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-azul hover:bg-fondo-suave"
                  >
                    <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              className="lg:hidden rounded-btn p-2 text-azul hover:bg-fondo-suave"
              aria-label="Abrir menú"
            >
              <Menu size={28} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <MenuMovil abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <main className="flex-1 max-w-contenido w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
        <Outlet />
      </main>

      <footer className="bg-azul text-white/80 mt-auto">
        <div className="max-w-contenido mx-auto px-4 sm:px-6 py-6 flex flex-col items-center gap-3 text-center">
          <img src="/brand/matp_lockup_sobre_azul_blanco.svg" alt="" aria-hidden="true" className="h-8" />
          <p className="text-xs leading-relaxed">
            Sistema de Gestión y Digitalización de Colecciones Museográficas · v1.0
            <br />
            Instituto Riva-Agüero · Dirección de Asuntos Culturales · Pontificia Universidad Católica del Perú
          </p>
        </div>
      </footer>
    </div>
  );
}
