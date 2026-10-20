import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props { children: ReactNode }
interface Estado { error: Error | null }

/** Una pantalla que falla no debe dejar la aplicación en blanco: el menú y las demás secciones siguen usables.
 * Se reinicia al cambiar de ruta (el Layout le pasa `key={pathname}`). */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Pantalla con error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="glass-panel p-6 space-y-3 max-w-2xl">
        <p className="flex items-center gap-2 font-semibold text-azul">
          <TriangleAlert size={22} className="shrink-0 text-rojo" aria-hidden="true" />Esta pantalla no se pudo mostrar
        </p>
        <p className="text-texto">
          Es posible que todavía no esté adaptada a la versión actual de la API. El resto de las secciones del menú siguen funcionando.
        </p>
        <button type="button" className="btn-glass" onClick={() => this.setState({ error: null })}>Reintentar</button>
      </div>
    );
  }
}
