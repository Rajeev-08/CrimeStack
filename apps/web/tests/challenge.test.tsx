import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Registry from "../src/components/Registry";
import Network from "../src/components/Network";
import { Evidence } from "../src/components/Evidence";
import { CopilotResult } from "../src/components/Copilot";
import { printSection } from "../src/lib/print";
const ok = (data: any) => ({ ok: true, json: async () => data });
afterEach(() => {
  vi.restoreAllMocks();
  document.getElementById("crimestack-print-root")?.remove();
});
it("explains an incomplete import and focuses the source field", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(
    ok({
      quality: {
        accepted_rows: 3,
        total_rows: 3,
        map_ready_rows: 3,
        column_mappings: { date: "occurred_at" },
      },
    }) as any,
  );
  render(
    <Registry
      datasets={[]}
      user={{ id: "U", email: "u@x.test", role: "analyst" }}
      onImported={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Incident CSV"), {
    target: { files: [new File(["date,category"], "demo.csv")] },
  });
  const button = await screen.findByRole("button", { name: "Confirm import" });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Enter a publisher",
  );
  expect(screen.getByLabelText("Publisher / source label")).toHaveFocus();
  expect(screen.getByLabelText("Publisher / source label")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
it("renders structured evidence without JSON code blocks", () => {
  render(
    <Evidence
      value={{
        quality_score: 98,
        rows: [{ district: "Bengaluru", count: 12 }],
      }}
    />,
  );
  expect(screen.getByText("Quality Score")).toBeInTheDocument();
  expect(
    screen.getByRole("columnheader", { name: "District" }),
  ).toBeInTheDocument();
  expect(document.querySelector("pre")).toBeNull();
});
it("renders repeat-case inspection and case history", () => {
  const network = {
    nodes: [
      {
        id: "A",
        alias: "Entity A",
        entity_type: "declared_entity",
        connections: 1,
        case_count: 2,
        case_history: [
          {
            case_reference: "CASE-1",
            dates: ["2026-01-01"],
            relationship_types: ["declared_link"],
          },
        ],
      },
    ],
    edges: [],
    components: [["A"]],
    limitation: "Declared evidence only",
  };
  render(<Network network={network} />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Entity A" }));
  expect(screen.getByText("CASE-1")).toBeInTheDocument();
  expect(screen.getByText("2026-01-01")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search network"), {
    target: { value: "missing" },
  });
  expect(
    screen.getByText("No entities match these filters."),
  ).toBeInTheDocument();
});
it("formats Copilot category answers as readable distributions", () => {
  render(
    <CopilotResult
      message={{ tool: "categories", result: { Theft: 12, Fraud: 4 } }}
    />,
  );
  expect(screen.getByText("Theft")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(document.querySelector("pre")).toBeNull();
});
it("prints only the selected conversation and removes interactive controls", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const section = document.createElement("section");
  const p = document.createElement("p");
  p.textContent = "Cited evidence in Kannada: ಘಟನೆಗಳು";
  section.append(p);
  const button = document.createElement("button");
  button.textContent = "Unrelated action";
  section.append(button);
  printSection(section, "Conversation export");
  const output = document.getElementById("crimestack-print-root")!;
  expect(output).toHaveTextContent("Cited evidence in Kannada");
  expect(output.querySelector("button")).toBeNull();
  expect(print).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("afterprint"));
  expect(document.getElementById("crimestack-print-root")).toBeNull();
});
