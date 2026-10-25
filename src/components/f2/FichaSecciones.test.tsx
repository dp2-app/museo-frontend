import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATALOGOS, ficha } from "../../test/datos";
import { renderizar, simularApi } from "../../test/render";
import type { DocumentoV3, FichaCompleta } from "../../types";
import { Auditoria } from "./Auditoria";
import { Documentos } from "./Documentos";
import { SugerenciasIA } from "./SugerenciasIA";

const RIA01 = "RIA-01-extraccion-observaciones";
const conObservaciones = (): FichaCompleta => ({ ...ficha(), campos: { ...ficha().campos, observaciones: "Donado por la familia Arguedas en 1978" } });
const sugerencia = (id: string, piezaId: string) => ({
  id, tipo: RIA01, piezaId, piezaRelacionadaId: null, modeloUsado: "gemma-4", confianza: "0.82", estado: "pendiente",
  payloadSugerido: { autor: "Familia Arguedas", procedencia: "Lima, Perú, América" }, creadoEn: "2026-10-24T10:00:00Z",
});

describe("Documentos de la pieza (RF-11)", () => {
  const doc: DocumentoV3 = { id: "d1", tipoDocumentoId: "td-acta", titulo: "Acta de donación", fechaDocumento: "1978-03-08",
    descripcion: "Firmada por la familia", url: "https://archivos.museo.pe/acta.pdf", restringidoUso: true, creadoEn: "" };

  it("lista con enlace, tipo y restricción; asocia uno nuevo y retira con motivo", async () => {
    const api = simularApi({ ...CATALOGOS, "POST /piezas/p1/documentos": {}, "POST /piezas/p1/documentos/d1/baja": {} }, ["piezas.ver", "documentos.gestionar"]);
    renderizar(<Documentos piezaId="p1" documentos={[doc]} alCambiar={() => {}} />);
    const enlace = await screen.findByRole("link", { name: /Acta de donación/ });
    expect(enlace).toHaveAttribute("href", "https://archivos.museo.pe/acta.pdf");
    expect(await screen.findByText(/Acta ·/)).toBeInTheDocument();
    expect(screen.getByText("Uso restringido")).toBeInTheDocument();

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: /Asociar documento/ }));
    await usuario.type(screen.getByLabelText(/URL del documento/), "https://archivos.museo.pe/contrato.pdf");
    await usuario.type(screen.getByLabelText("Título"), "Contrato de comodato");
    await usuario.selectOptions(screen.getByLabelText("Tipo"), "td-acta");
    await usuario.click(screen.getByRole("button", { name: "Asociar" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/documentos", {
      url: "https://archivos.museo.pe/contrato.pdf", titulo: "Contrato de comodato", tipoDocumentoId: "td-acta", fechaDocumento: null, descripcion: null }));

    await usuario.click(screen.getByRole("button", { name: "Retirar" }));
    await usuario.type(screen.getByLabelText("Motivo para retirar el documento"), "Subido por error");
    await usuario.click(screen.getAllByRole("button", { name: "Retirar" }).at(-1)!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/piezas/p1/documentos/d1/baja", { motivo: "Subido por error" }));
  });

  it("sin permiso solo se ven", async () => {
    simularApi(CATALOGOS, ["piezas.ver"]);
    renderizar(<Documentos piezaId="p1" documentos={[doc]} alCambiar={() => {}} />);
    expect(await screen.findByRole("link", { name: /Acta de donación/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Asociar documento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar" })).not.toBeInTheDocument();
  });
});

describe("Sugerencias de IA en la ficha (F10, DA-006)", () => {
  const cola = [sugerencia("s1", "p1"), sugerencia("s-otra", "otra-pieza")];

  it("muestra solo las propuestas de esta pieza y aplica únicamente los campos elegidos", async () => {
    const api = simularApi({ ...CATALOGOS, "/ia/sugerencias": cola, "PATCH /ia/sugerencias/s1": {} }, ["piezas.ver", "ia.usar", "ia.resolver"]);
    renderizar(<SugerenciasIA pieza={conObservaciones()} alCambiar={() => {}} />);
    const fila = await screen.findByRole("row", { name: /Autor/ });
    expect(within(fila).getByText("Taller Jiménez")).toBeInTheDocument();
    expect(within(fila).getByText("Familia Arguedas")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith("/ia/sugerencias", { params: { estado: "pendiente", tipo: RIA01 } });

    const usuario = userEvent.setup();
    await usuario.click(screen.getByLabelText("Aplicar Procedencia"));
    await usuario.click(screen.getByRole("button", { name: "Aplicar 1 de 2" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/ia/sugerencias/s1", { estado: "modificado", payloadSugerido: { autor: "Familia Arguedas" } }));
  });

  it("aplicar todo envía aceptado y rechazar envía rechazado", async () => {
    const api = simularApi({ ...CATALOGOS, "/ia/sugerencias": cola, "PATCH /ia/sugerencias/s1": {} }, ["ia.usar", "ia.resolver"]);
    renderizar(<SugerenciasIA pieza={conObservaciones()} alCambiar={() => {}} />);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Aplicar a la ficha" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/ia/sugerencias/s1", { estado: "aceptado", payloadSugerido: undefined }));
    await usuario.click(screen.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith("/ia/sugerencias/s1", { estado: "rechazado", payloadSugerido: undefined }));
  });

  it("pide una propuesta nueva desde las observaciones", async () => {
    const api = simularApi({ ...CATALOGOS, "/ia/sugerencias": [], "POST /ia/extraccion-observaciones/p1": {} }, ["ia.usar"]);
    renderizar(<SugerenciasIA pieza={conObservaciones()} alCambiar={() => {}} />);
    expect(await screen.findByText("No hay propuestas pendientes para esta pieza.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Proponer datos desde las observaciones/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/ia/extraccion-observaciones/p1"));
  });

  it("sin permiso de resolver ve la propuesta pero no la aplica; sin ia.usar no ve la sección", async () => {
    simularApi({ ...CATALOGOS, "/ia/sugerencias": cola }, ["ia.usar"]);
    const { unmount } = renderizar(<SugerenciasIA pieza={conObservaciones()} alCambiar={() => {}} />);
    expect(await screen.findByText(/debe revisarla/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aplicar a la ficha" })).not.toBeInTheDocument();
    unmount();
    simularApi(CATALOGOS, ["piezas.ver"]);
    renderizar(<SugerenciasIA pieza={conObservaciones()} alCambiar={() => {}} />);
    await waitFor(() => expect(screen.queryByText("Sugerencias de IA")).not.toBeInTheDocument());
  });
});

describe("Historial de cambios legible (RNF-11)", () => {
  it("usa la etiqueta del campo y el nombre de los valores que la ficha conoce", async () => {
    const id = "6f1c2a3b-0000-4000-8000-000000000001";
    const datos = { ...ficha(), campos: { ...ficha().campos, estado_conservacion_id: id }, etiquetas: { estado_conservacion_id: "Bueno" } };
    simularApi({ ...CATALOGOS, "/piezas/p1/auditoria": [
      { id: "a1", tabla: "piezas", campo: "estado_conservacion_id", valorAnterior: "6f1c2a3b-0000-4000-8000-000000000009", valorNuevo: id,
        accion: "update", motivo: null, usuarioNombre: "Ana", fecha: "2026-10-24T10:00:00Z" },
      { id: "a2", tabla: "codigos_externos", campo: "codigo:I", valorAnterior: null, valorNuevo: "I-04381", accion: "update",
        motivo: null, usuarioNombre: "Ana", fecha: "2026-10-24T10:00:00Z" },
    ] }, ["piezas.ver"]);
    renderizar(<Auditoria pieza={datos} />);
    const historial = await screen.findByRole("region", { name: "Historial de cambios" });
    await waitFor(() => expect(historial).toHaveTextContent("Cambió estado de conservación"));
    expect(historial).toHaveTextContent("«otro valor de la lista» → «Bueno»");
    expect(historial).toHaveTextContent("Cambió código I");
    expect(historial).not.toHaveTextContent(id);
  });
});
