import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const enlaces = [
  { to: "/piezas", label: "Piezas" },
  { to: "/colecciones", label: "Colecciones" },
  { to: "/importacion", label: "Importación" },
  { to: "/ia", label: "Sugerencias IA" },
];

export function Layout() {
  const { rol, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-stone-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">Museo "Luis Repetto Málaga"</h1>
            <p className="text-xs text-stone-300">Gestión de colecciones</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {enlaces.map((enlace) => (
              <NavLink
                key={enlace.to}
                to={enlace.to}
                className={({ isActive }) =>
                  `hover:text-amber-300 ${isActive ? "text-amber-300 font-medium" : "text-stone-200"}`
                }
              >
                {enlace.label}
              </NavLink>
            ))}
            <span className="text-stone-400 text-xs">{rol}</span>
            <button onClick={logout} className="text-stone-200 hover:text-amber-300">
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
