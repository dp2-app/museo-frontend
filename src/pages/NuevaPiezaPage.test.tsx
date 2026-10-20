import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATALOGOS } from "../test/datos";
import { errorApi, renderizar, simularApi } from "../test/render";
import { NuevaPiezaPage } from "./NuevaPiezaPage";

const PERMISOS = ["piezas.ver", "piezas.crear", "codigos.gestionar", "tenencias.gestionar", "propietarios.ver"];

function abrir(respuestas = {}) {
  const api = simularApi({ ...CATALOGOS, ...respuestas }, PERMISOS);
  renderizar(<NuevaPiezaPage />, { ruta: "/coleccion/nueva", patron: "/coleccion/nueva", otras: { "/coleccion/:id": <p>Ficha abierta</p> } });
  return api;
}

describe("Registrar pieza (RF-01)", () => {
  it("no envía nada si falta un obligatorio", async () => {
    const api = abrir();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByText(/completa este campo obligatorio/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("envía ficha, código, comodato con contraparte y ubicación en un solo POST y abre la ficha", async () => {
    const api = abrir({ "POST /piezas": { id: "nueva-1" } });
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText(/Título \/ Denominación/), "Retablo ayacuchano");
    await usuario.click(screen.getByRole("button", { name: /Agregar código/ }));
    await usuario.selectOptions(await screen.findByLabelText("Tipo de código 1"), "tc-i");
    await usuario.type(screen.getByLabelText("Valor del código 1"), "  I-04381 ");
    await usuario.selectOptions(screen.getByLabelText("Régimen"), "r-com");
    // El comodato pide la contraparte (RF-56)
    await usuario.selectOptions(await screen.findByLabelText(/Propietario o institución que cede/), "pr-1");
    await usuario.selectOptions(screen.getByLabelText("Sede o ubicación"), "rack");
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));

    expect(await screen.findByText("Ficha abierta")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/piezas", {
      campos: { denominacion: "Retablo ayacuchano" }, listas: {},
      codigos: [{ tipoCodigoId: "tc-i", valor: "I-04381" }],
      tenencia: { regimenId: "r-com", contraparteId: "pr-1" },
      ubicacionInicialId: "rack",
    });
  });

  it("muestra junto al código el error del backend y no sale de la pantalla", async () => {
    abrir({ "POST /piezas": () => { throw errorApi(409, [{ campo: "codigos[0].valor", codigo: "duplicado", mensaje: "El código I-1 ya está asignado a otra pieza" }]); } });
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText(/Título \/ Denominación/), "Retablo");
    await usuario.click(screen.getByRole("button", { name: /Agregar código/ }));
    await usuario.selectOptions(await screen.findByLabelText("Tipo de código 1"), "tc-i");
    await usuario.type(screen.getByLabelText("Valor del código 1"), "I-1");
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));

    await waitFor(() => expect(screen.getAllByText("El código I-1 ya está asignado a otra pieza").length).toBeGreaterThan(0));
    expect(screen.getByLabelText("Valor del código 1")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Ficha abierta")).not.toBeInTheDocument();
  });

  it("sin permiso de códigos ni tenencia no muestra esas secciones", async () => {
    simularApi(CATALOGOS, ["piezas.crear"]);
    renderizar(<NuevaPiezaPage />);
    expect(await screen.findByLabelText("Sede o ubicación")).toBeInTheDocument();
    expect(screen.queryByText("Códigos del museo")).not.toBeInTheDocument();
    expect(screen.queryByText("Régimen de tenencia")).not.toBeInTheDocument();
  });
});
