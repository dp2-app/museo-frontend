import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ficha } from "../test/datos";
import { renderizar, simularApi } from "../test/render";
import { PiezasPage } from "./PiezasPage";

const pieza = ficha();
const pagina = (total: number) => ({ items: [pieza], total });

describe("Colección: búsqueda y bajas", () => {
  it("busca con los filtros aplicados y pagina", async () => {
    const api = simularApi({ "/colecciones": [{ id: "col-1", nombre: "Mildred Merino de Zela", descripcion: null }], "/piezas": pagina(60) }, ["piezas.ver"]);
    renderizar(<PiezasPage />);
    expect(await screen.findByText("Retablo ayacuchano")).toBeInTheDocument();
    expect(screen.getByText("I-04381")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Registrar pieza/ })).not.toBeInTheDocument(); // sin piezas.crear

    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText("Código"), "mmz-300");
    await usuario.selectOptions(screen.getByLabelText("Colección"), "col-1");
    await usuario.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/piezas", { params: expect.objectContaining({ codigo: "mmz-300", coleccionId: "col-1", pagina: 1 }) }));

    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/piezas", { params: expect.objectContaining({ pagina: 2 }) }));
  });

  it("restaura una pieza dada de baja con motivo", async () => {
    const api = simularApi({ "/colecciones": [], "/piezas": pagina(1), "/piezas/eliminadas": [pieza], "POST /piezas/p1/restaurar": {} },
      ["piezas.ver", "piezas.crear", "piezas.restaurar"]);
    renderizar(<PiezasPage />);
    const usuario = userEvent.setup();
    expect(await screen.findByRole("link", { name: /Registrar pieza/ })).toHaveAttribute("href", "/coleccion/nueva");
    await usuario.click(screen.getByRole("button", { name: "Piezas dadas de baja" }));
    await usuario.click(await screen.findByRole("button", { name: "Restaurar" }));
    await usuario.type(screen.getByLabelText("Motivo de la restauración"), "Se dio de baja por error");
    await usuario.click(screen.getAllByRole("button", { name: "Restaurar" }).at(-1)!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/restaurar", { motivo: "Se dio de baja por error" }));
  });
});

describe("Subcolecciones (RF-07)", () => {
  it("lista las de la colección elegida y crea una nueva", async () => {
    const api = simularApi({
      "/colecciones": [{ id: "col-1", nombre: "Mildred Merino de Zela", descripcion: null }], "/piezas": { items: [], total: 0 },
      "/colecciones/col-1/subcolecciones": [{ id: "s1", coleccionId: "col-1", nombre: "Retablos", descripcion: null }],
      "POST /colecciones/col-1/subcolecciones": {},
    }, ["piezas.ver", "colecciones.gestionar"]);
    renderizar(<PiezasPage />);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Gestionar colecciones" }));
    expect(await screen.findByLabelText("Nombre de la nueva subcolección")).toBeDisabled();
    await usuario.selectOptions(screen.getByLabelText("Colección de la subcolección"), "col-1");
    expect(await screen.findByText("Retablos")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText("Nombre de la nueva subcolección"), "Mates burilados");
    await usuario.click(screen.getByRole("button", { name: "Crear subcolección" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/colecciones/col-1/subcolecciones", { nombre: "Mates burilados" }));
  });
});
