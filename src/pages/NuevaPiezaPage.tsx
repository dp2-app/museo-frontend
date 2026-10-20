import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { FormularioFicha } from "../components/f0/FormularioFicha";
import { DatosAlta } from "../components/f2/DatosAlta";
import { api, erroresPorCampo } from "../lib/api";
import type { DatosFichaV3, PiezaAlta, PiezaV3 } from "../types";

/** RF-01: alta de una pieza con el formulario dinámico (F0) más códigos, tenencia y ubicación inicial.
 * Todo viaja en un solo POST /piezas: si algo falla, no se crea nada. */
export function NuevaPiezaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [extras, setExtras] = useState<Pick<PiezaAlta, "codigos" | "tenencia" | "ubicacionInicialId">>(
    { codigos: [], tenencia: null, ubicacionInicialId: null });
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function guardar(datos: DatosFichaV3) {
    const cuerpo: PiezaAlta = {
      ...datos, ...extras,
      codigos: extras.codigos.filter((c) => c.tipoCodigoId && c.valor.trim()).map((c) => ({ ...c, valor: c.valor.trim() })),
    };
    try {
      const { data } = await api.post<PiezaV3>("/piezas", cuerpo);
      queryClient.invalidateQueries({ queryKey: ["piezas"] });
      navigate(`/coleccion/${data.id}`, { state: { creada: true } });
    } catch (e) {
      setErrores(erroresPorCampo(e));
      throw e; // FormularioFicha muestra el mensaje y marca los campos de la ficha
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/coleccion" className="text-sm text-azul hover:underline">← Volver a Colección</Link>
        <h1 className="mt-1">Registrar pieza</h1>
        <p className="text-sm text-gris-2">La ficha queda en borrador hasta que se envíe a revisión. Los campos con * son obligatorios.</p>
      </div>
      <DatosAlta valor={extras} cambiar={setExtras} errores={errores} />
      <FormularioFicha onGuardar={guardar} />
    </div>
  );
}
