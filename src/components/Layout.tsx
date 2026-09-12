import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const enlaces = [
  { to: "/piezas", label: "Piezas" },
  { to: "/colecciones", label: "Colecciones" },
  { to: "/importacion", label: "Importación" },
  { to: "/ia", label: "Calidad de Datos" },
];

function Marca() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#B8622F" />
      <path
        d="M16 6 L26 16 L16 26 L6 16 Z"
        fill="none"
        stroke="#F6E4D4"
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="3.2" fill="#F6E4D4" />
    </svg>
  );
}

export function Layout() {
  const { rol, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-5">
        <header className="glass-nav max-w-6xl mx-auto rounded-3xl text-white">
          <div className="px-4 py-3 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex items-center gap-2.5">
              <Marca />
              <div className="min-w-0">
                <h1 className="font-display text-[15px] leading-tight font-semibold truncate">
                  Museo "Luis Repetto Málaga"
                </h1>
                <p className="text-[11px] text-white/60 tracking-wide">Gestión de colecciones</p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
              {enlaces.map((enlace) => (
                <NavLink
                  key={enlace.to}
                  to={enlace.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 transition ${
                      isActive ? "bg-white/15 text-clay-200 font-medium" : "text-white/70 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  {enlace.label}
                </NavLink>
              ))}
              <span className="hidden sm:inline text-white/40 text-xs px-2">{rol}</span>
              <button
                onClick={logout}
                className="rounded-full px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                Salir
              </button>
            </nav>
          </div>
        </header>
      </div>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
