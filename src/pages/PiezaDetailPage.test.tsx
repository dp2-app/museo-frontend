import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATALOGOS, ficha } from "../test/datos";
import { errorApi, renderizar, simularApi } from "../test/render";
import type { FichaCompleta } from "../types";
import { PiezaDetailPage } from "./PiezaDetailPage";

function abrir(permisos: string[], datos: FichaCompleta = ficha(), respuestas = {}) {
  const api = simularApi({ ...CATALOGOS, "/piezas/p1/ficha-completa": datos, "/piezas/p1/auditoria": [], ...respuestas }, permisos);
  renderizar(<PiezaDetailPage />, { ruta: "/coleccion/p1", patron: "/coleccion/:piezaId" });
  return api;
}

describe("Ficha de la pieza", () => {
  it("muestra los campos con dato, lo que falta y el código bloqueado; sin permisos no ofrece acciones", async () => {
    abrir(["piezas.ver"]);
    expect(await screen.findByRole("heading", { name: "Retablo ayacuchano" })).toBeInTheDocument();
    const conservacion = await screen.findByRole("region", { name: "Conservación" });
    expect(within(conservacion).getByText("Bueno")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Información faltante" })).toHaveTextContent("Procedencia");
    expect(screen.queryByRole("region", { name: "Descripción" })).toHaveTextContent("Taller Jiménez");
    expect(screen.getByLabelText("No se puede modificar (RN-02)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar como principal/ })).not.toBeInTheDocument();
  });

  it("al editar envía la versión leída y, si otra persona guardó antes, ofrece recargar", async () => {
    const api = abrir(["piezas.ver", "piezas.editar"], ficha(), {
      "PATCH /piezas/p1": () => { throw errorApi(409, [{ codigo: "conflicto_version", mensaje: "Otra persona modificó esta ficha; recárguela antes de guardar" }]); },
    });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /Editar/ }));
    const autor = await screen.findByLabelText(/Autor/);
    await usuario.clear(autor);
    await usuario.type(autor, "Otro autor");
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));

    expect(await screen.findByText(/Otra persona modificó esta ficha/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recargar la ficha/ })).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith("/piezas/p1", expect.objectContaining({
      version: "2026-10-20T10:00:00.000001+00:00", campos: expect.objectContaining({ autor: "Otro autor" }) }));
  });

  it("rechazar exige justificación y la envía al backend", async () => {
    const api = abrir(["piezas.ver", "piezas.aprobar_ficha"], ficha({ estadoFicha: "en_revision" }), { "PATCH /piezas/p1/estado-ficha": {} });
    const usuario = userEvent.setup();
    expect(await screen.findByRole("button", { name: /Aprobar/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar a revisión/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /^Rechazar$/ }));
    const confirmar = screen.getAllByRole("button", { name: "Rechazar" }).at(-1)!;
    expect(confirmar).toBeDisabled();
    await usuario.type(screen.getByLabelText("Justificación del rechazo"), "Falta la medida del alto");
    await usuario.click(confirmar);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/piezas/p1/estado-ficha", { accion: "rechazar", motivoRechazo: "Falta la medida del alto" }));
  });

  it("fotografías (RF-10): elige otra principal y reordena", async () => {
    const api = abrir(["piezas.ver", "fotos.gestionar"], ficha(), {
      "PATCH /piezas/p1/fotografias/f2": {}, "PUT /piezas/p1/fotografias/orden": [],
    });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Ver fotografía 2" }));
    await usuario.click(screen.getByRole("button", { name: /Usar como principal/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/piezas/p1/fotografias/f2", { esPrincipal: true }));
    await usuario.click(screen.getByRole("button", { name: "Mover antes" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/piezas/p1/fotografias/orden", { ids: ["f2", "f1"] }));
    expect(screen.getByRole("button", { name: "Mover después" })).toBeDisabled();
  });

  it("códigos: agrega uno nuevo y retira uno no bloqueado con motivo", async () => {
    const datos = ficha();
    datos.codigosDetalle.push({ ...datos.codigosDetalle[0], id: "c2", tipoCodigoId: "tc-col", tipoCodigo: "coleccion",
      tipoNombre: "Código de la colección", valor: "MMZ 300", bloqueado: false });
    const api = abrir(["piezas.ver", "codigos.gestionar"], datos, { "POST /piezas/p1/codigos": {}, "POST /piezas/p1/codigos/c2/baja": {} });
    const usuario = userEvent.setup();
    const seccion = await screen.findByRole("region", { name: "Códigos del museo" });
    expect(within(seccion).getAllByRole("button", { name: "Retirar" })).toHaveLength(1); // el código I no se retira
    await usuario.selectOptions(within(seccion).getByLabelText("Tipo"), "tc-col");
    await usuario.type(within(seccion).getByLabelText("Valor"), " MMZ 301 ");
    await usuario.click(within(seccion).getByRole("button", { name: "Agregar código" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/codigos", { tipoCodigoId: "tc-col", valor: "MMZ 301" }));
    await usuario.click(within(seccion).getByRole("button", { name: "Retirar" }));
    await usuario.type(within(seccion).getByLabelText("Motivo para retirar el código"), "Era de otra pieza");
    await usuario.click(within(seccion).getAllByRole("button", { name: "Retirar" }).at(-1)!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/codigos/c2/baja", { motivo: "Era de otra pieza" }));
  });

  it("tenencia: comodato con contraparte, condiciones y restricción de publicación (RN-07)", async () => {
    const api = abrir(["piezas.ver", "tenencias.gestionar", "propietarios.ver"], ficha(), { "POST /piezas/p1/tenencias": {} });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Cambiar régimen" }));
    await usuario.selectOptions(screen.getByLabelText("Nuevo régimen"), "r-com");
    await usuario.selectOptions(await screen.findByLabelText("Propietario o institución que cede"), "pr-1");
    await usuario.type(screen.getByLabelText("Condiciones del contrato"), "Solo exhibición en sala");
    await usuario.click(screen.getByLabelText(/No se puede publicar/));
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/tenencias", {
      regimenId: "r-com", contraparteId: "pr-1", condicionesContractuales: "Solo exhibición en sala", restringidoPublicacion: true }));
  });

  it("propiedad no pide contraparte ni condiciones", async () => {
    abrir(["piezas.ver", "tenencias.gestionar"]);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Cambiar régimen" }));
    await usuario.selectOptions(screen.getByLabelText("Nuevo régimen"), "r-prop");
    expect(screen.queryByLabelText("Condiciones del contrato")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Propietario o institución/)).not.toBeInTheDocument();
  });

  it("corrección del código I (RF-05): solo con el permiso especial, con valor nuevo y motivo", async () => {
    const sinPermiso = abrir(["piezas.ver", "codigos.gestionar"]);
    const seccion = await screen.findByRole("region", { name: "Códigos del museo" });
    expect(within(seccion).queryByRole("button", { name: "Corregir" })).not.toBeInTheDocument(); // el código I está bloqueado
    expect(sinPermiso.post).not.toHaveBeenCalled();
  });

  it("corrige el código I con codigos.corregir_inmutable", async () => {
    const api = abrir(["piezas.ver", "codigos.corregir_inmutable"], ficha(), { "POST /piezas/p1/codigos/c1/correccion": {} });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Corregir" }));
    const form = screen.getByRole("form", { name: /Corregir N° de inventario/ });
    const corregir = within(form).getByRole("button", { name: "Corregir" });
    expect(corregir).toBeDisabled(); // mismo valor y sin motivo
    await usuario.clear(within(form).getByLabelText("Valor correcto"));
    await usuario.type(within(form).getByLabelText("Valor correcto"), "I-04382");
    expect(corregir).toBeDisabled(); // falta el motivo
    await usuario.type(within(form).getByLabelText("Motivo de la corrección"), "Error de transcripción");
    await usuario.click(corregir);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/codigos/c1/correccion", { valor: "I-04382", motivo: "Error de transcripción" }));
  });

  it("si falta información para enviar a revisión, dice qué falta", async () => {
    abrir(["piezas.ver", "piezas.editar"], ficha(), { "PATCH /piezas/p1/estado-ficha": () => { throw errorApi(422, [
      { campo: "codigos_externos", codigo: "obligatorio", mensaje: "Complete el campo antes de enviar a revisión" },
      { campo: "procedencia", codigo: "obligatorio", mensaje: "Complete el campo antes de enviar a revisión" },
    ]); } });
    await userEvent.setup().click(await screen.findByRole("button", { name: /Enviar a revisión/ }));
    expect(await screen.findByText("No se puede enviar a revisión. Falta: Código del museo, Procedencia.")).toBeInTheDocument();
  });

  it("marca una foto como de uso restringido (RN-07)", async () => {
    const api = abrir(["piezas.ver", "fotos.gestionar"], ficha(), { "PATCH /piezas/p1/fotografias/f1": {} });
    await userEvent.setup().click(await screen.findByLabelText(/Uso restringido/));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/piezas/p1/fotografias/f1", { restringidoUso: true }));
  });

  it("dar de baja pide motivo y vuelve a la colección", async () => {
    const api = simularApi({ ...CATALOGOS, "/piezas/p1/ficha-completa": ficha(), "/piezas/p1/auditoria": [], "POST /piezas/p1/baja": null }, ["piezas.ver", "piezas.baja"]);
    renderizar(<PiezaDetailPage />, { ruta: "/coleccion/p1", patron: "/coleccion/:piezaId", otras: { "/coleccion": <p>Lista de la colección</p> } });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /Dar de baja/ }));
    await usuario.type(screen.getByLabelText(/Motivo de la baja/), "Registro duplicado");
    await usuario.click(screen.getByRole("button", { name: "Confirmar baja" }));
    expect(await screen.findByText("Lista de la colección")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/piezas/p1/baja", { motivo: "Registro duplicado" });
  });

  it("agrega una foto con fotógrafo y fecha de la toma, e indica el tipo de vista", async () => {
    const api = abrir(["piezas.ver", "fotos.gestionar"], ficha(), {
      "POST /piezas/p1/fotografias": { id: "f3" }, "PATCH /piezas/p1/fotografias/f1": {},
    });
    const usuario = userEvent.setup();
    await usuario.selectOptions(await screen.findByLabelText("Fotógrafo"), "per-1");
    await usuario.type(screen.getByLabelText("Fecha de la toma"), "2026-10-20");
    await usuario.type(screen.getByLabelText(/URL ya subida/), "https://archivos.museo.pe/f3.jpg");
    await usuario.click(screen.getByRole("button", { name: "Añadir" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/fotografias",
      { url: "https://archivos.museo.pe/f3.jpg", fotografoId: "per-1", fechaFotografia: "2026-10-20" }));
    await usuario.selectOptions(screen.getByLabelText("Tipo de vista"), "v-frontal");
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/piezas/p1/fotografias/f1", { tipoVistaId: "v-frontal" }));
  });

  it("historial de cambios: quién, qué, cuándo y el motivo", async () => {
    abrir(["piezas.ver"], ficha(), { "/piezas/p1/auditoria": [
      { id: "a1", tabla: "piezas", campo: "autor", valorAnterior: "Desconocido", valorNuevo: "Taller Jiménez", accion: "update",
        motivo: null, usuarioNombre: "Ana", fecha: "2026-10-20T10:00:00Z" },
      { id: "a2", tabla: "piezas", campo: "*", valorAnterior: null, valorNuevo: null, accion: "soft_delete",
        motivo: "Duplicado", usuarioNombre: null, fecha: "2026-10-20T11:00:00Z" },
    ] });
    const historial = await screen.findByRole("region", { name: "Historial de cambios" });
    await waitFor(() => expect(historial).toHaveTextContent("«Desconocido» → «Taller Jiménez»"));
    expect(historial).toHaveTextContent("Sistema · Dio de baja");
    expect(historial).toHaveTextContent("Motivo: Duplicado");
  });

  it("reordena arrastrando una miniatura sobre otra", async () => {
    const api = abrir(["piezas.ver", "fotos.gestionar"], ficha(), { "PUT /piezas/p1/fotografias/orden": [] });
    const miniaturas = within(await screen.findByRole("list", { name: "Miniaturas" })).getAllByRole("listitem");
    fireEvent.dragStart(miniaturas[1]);
    fireEvent.dragOver(miniaturas[0]);
    fireEvent.drop(miniaturas[0]);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/piezas/p1/fotografias/orden", { ids: ["f2", "f1"] }));
  });

  it("al editar envía solo lo que cambió, aunque haya obligatorios vacíos (R2)", async () => {
    const api = abrir(["piezas.ver", "piezas.editar"], ficha(), { "PATCH /piezas/p1": {} });
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /Editar/ }));
    const autor = await screen.findByLabelText(/Autor/);
    await usuario.clear(autor);
    await usuario.type(autor, "Otro autor");
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/piezas/p1",
      { campos: { autor: "Otro autor" }, listas: {}, version: "2026-10-20T10:00:00.000001+00:00" }));
  });

  it("vaciar un obligatorio que tenía valor sigue bloqueado; sin cambios no llama al backend", async () => {
    const api = abrir(["piezas.ver", "piezas.editar"]);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /Editar/ }));
    await usuario.clear(await screen.findByLabelText(/Título \/ Denominación/));
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));
    expect(await screen.findByText(/completa este campo obligatorio/)).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/Título \/ Denominación/), "Retablo ayacuchano");
    await usuario.click(screen.getByRole("button", { name: "Guardar ficha" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Editar ficha" })).not.toBeInTheDocument());
    expect(api.patch).not.toHaveBeenCalled();
  });
});
