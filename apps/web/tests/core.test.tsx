import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { api, setToken } from "../src/lib/api";
import { frameStats, groupEvents } from "../src/lib/surveillance";
import { recognize, speak, speechAvailable } from "../src/lib/voice";
import Copilot from "../src/components/Copilot";
import Modules from "../src/components/Modules";
import App from "../src/App";
vi.mock("../src/components/MapPanel", () => ({
  default: () => <div>Map</div>,
}));
const ok = (data: any) => ({ ok: true, json: async () => data });
beforeEach(() => {
  vi.restoreAllMocks();
  setToken("");
});
it("attaches authorization and JSON content type", async () => {
  const fetcher = vi
    .spyOn(window, "fetch")
    .mockResolvedValue(ok({ total: 4 }) as any);
  setToken("abc");
  await api("/api/test", { method: "POST", body: "{}" });
  const headers = fetcher.mock.calls[0][1]!.headers as Headers;
  expect(headers.get("Authorization")).toBe("Bearer abc");
  expect(headers.get("Content-Type")).toBe("application/json");
});
it("preserves multipart boundary behavior", async () => {
  const fetcher = vi.spyOn(window, "fetch").mockResolvedValue(ok({}) as any);
  const form = new FormData();
  form.append("file", new File(["date,category"], "test.csv"));
  await api("/api/datasets/preview", { method: "POST", body: form });
  expect(
    (fetcher.mock.calls[0][1]!.headers as Headers).has("Content-Type"),
  ).toBe(false);
});
it("expires session explicitly", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ detail: "Expired" }),
  } as any);
  const listener = vi.fn();
  window.addEventListener("session-expired", listener);
  await expect(api("/api/auth/me")).rejects.toThrow("Expired");
  expect(listener).toHaveBeenCalled();
  window.removeEventListener("session-expired", listener);
});
it("calculates luminance and frame differences", () => {
  const black = new Uint8ClampedArray([0, 0, 0, 255]);
  const white = new Uint8ClampedArray([255, 255, 255, 255]);
  expect(frameStats(white, black).motion).toBeCloseTo(255);
  expect(frameStats(black).motion).toBe(0);
});
it("groups motion events with temporal gaps", () => {
  expect(
    groupEvents(
      [
        { time: 0, motion: 20 },
        { time: 1, motion: 25 },
        { time: 5, motion: 30 },
      ],
      12,
    ),
  ).toEqual([
    { start: 0, end: 1, peak: 25 },
    { start: 5, end: 5, peak: 30 },
  ]);
});
it("explains unsupported speech", () => {
  const error = vi.fn();
  recognize("en", vi.fn(), error);
  expect(error).toHaveBeenCalledWith(expect.stringContaining("unsupported"));
  expect(speechAvailable()).toBe(false);
});
it("routes English and Kannada recognition languages", () => {
  const start = vi.fn();
  class Recognition {
    lang = "";
    start = start;
  }
  Object.defineProperty(window, "SpeechRecognition", {
    value: Recognition,
    configurable: true,
  });
  expect(recognize("kn", vi.fn(), vi.fn()).lang).toBe("kn-IN");
  expect(recognize("en", vi.fn(), vi.fn()).lang).toBe("en-IN");
  delete (window as any).SpeechRecognition;
});
it("renders cited conversation and preserves context in follow-up", async () => {
  const fetcher = vi.spyOn(window, "fetch").mockResolvedValue(
    ok({
      answer: "There are 4 incidents.",
      result: 4,
      context: { district: "A" },
      previous_tool: {tool: "totals", scope: {district: "A"}},
      mode: "Rules-based evidence mode",
      citations: [{ dataset_name: "Demo", matched_rows: 4 }],
      followups: ["Show severity"],
    }) as any,
  );
  fetcher.mockResolvedValueOnce(ok({mode: "Guided evidence queries", description: "Configure AI routing on the backend."}) as any);
  render(<Copilot datasetId="D" />);
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Total incidents" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask Copilot" }));
  expect(await screen.findByText("There are 4 incidents.")).toBeInTheDocument();
  expect(screen.getByText(/Evidence \[1\]/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show severity" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetcher.mock.calls[2][1]!.body as string).context).toEqual({
    district: "A",
  });
  expect(JSON.parse(fetcher.mock.calls[2][1]!.body as string).previous_tool.tool).toBe("totals");
  expect(screen.getByText("Guided evidence queries")).toBeInTheDocument();
});
it("shows copilot API failure", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue({
    ok: false,
    status: 502,
    json: async () => ({ detail: "Provider failed" }),
  } as any);
  render(<Copilot datasetId="D" />);
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Total" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask Copilot" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Provider failed");
});
it("renders bootstrap form and submits credentials contract", async () => {
  const fetcher = vi
    .spyOn(window, "fetch")
    .mockImplementation(async (path: any, options: any) => {
      if (path === "/api/auth/me")
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: "Sign in" }),
        } as any;
      if (path === "/api/auth/status")
        return ok({ bootstrap_required: true }) as any;
      if (path === "/api/auth/bootstrap")
        return ok({
          access_token: "abc",
          user: { id: "U", email: "test@example.test", role: "administrator" },
        }) as any;
      return ok([]) as any;
    });
  render(<App />);
  expect(
    await screen.findByRole("button", { name: "Create administrator" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "test@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "test-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Bootstrap secret"), {
    target: { value: "test-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create administrator" }));
  expect(await screen.findByRole("navigation")).toBeInTheDocument();
  const request = fetcher.mock.calls.find(
    (c) => c[0] === "/api/auth/bootstrap",
  );
  expect(JSON.parse(request![1]!.body as string).bootstrap_secret).toBe(
    "test-secret",
  );
});
it("viewer navigation hides privileged modules and import", async () => {
  vi.spyOn(window, "fetch").mockImplementation(
    async (path: any) =>
      ok(
        path === "/api/auth/me"
          ? { id: "U", email: "viewer@example.test", role: "viewer" }
          : [],
      ) as any,
  );
  render(<App />);
  expect(await screen.findByRole("navigation")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Security and Audit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Import data" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Start with a dataset")).toBeInTheDocument();
});
it("notification read request carries version and action", async () => {
  const notice = {
    id: "N",
    kind: "notification",
    status: "unread",
    version: 2,
    data: { message: "Assigned" },
    created_at: "2026-01-01",
  };
  const fetcher = vi
    .spyOn(window, "fetch")
    .mockResolvedValue(ok([notice]) as any);
  render(
    <Modules
      kind="notification"
      dataset={{ id: "D" } as any}
      user={{ id: "U", email: "u@x.test", role: "analyst" }}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mark read" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(true),
  );
  const request = fetcher.mock.calls.find((c) => c[1]?.method === "PATCH");
  expect(JSON.parse(request![1]!.body as string)).toMatchObject({
    version: 2,
    action: "read",
  });
});
it("task claim request is functional", async () => {
  const record = {
    id: "T",
    kind: "task",
    version: 1,
    status: "new",
    data: { title: "Review", priority: "high", due_at: "2026-01-02" },
    created_at: "2026-01-01",
  };
  const fetcher = vi
    .spyOn(window, "fetch")
    .mockImplementation(
      async (path: any) => ok(path === "/api/users" ? [] : [record]) as any,
    );
  render(
    <Modules
      kind="task"
      dataset={{ id: "D" } as any}
      user={{ id: "U", email: "u@x.test", role: "analyst" }}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Claim" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(true),
  );
});
it("previews upload, warns about missing coordinates and submits provenance", async () => {
  const fetcher = vi
    .spyOn(window, "fetch")
    .mockImplementation(async (path: any, options: any) => {
      if (path === "/api/auth/me")
        return ok({
          id: "U",
          email: "analyst@example.test",
          role: "analyst",
        }) as any;
      if (path === "/api/datasets/preview")
        return ok({
          quality: {
            total_rows: 1,
            accepted_rows: 1,
            rejected_rows: 0,
            duplicate_rows: 0,
            map_ready_rows: 0,
            quality_score: 50,
            column_mappings: { date: "occurred_at" },
          },
        }) as any;
      if (path === "/api/datasets" && options?.method === "POST")
        return ok({ id: "D" }) as any;
      return ok([]) as any;
    });
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Import data", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Incident CSV"), {
    target: {
      files: [
        new File(["date,category\n2026-01-01,Theft"], "sample.csv", {
          type: "text/csv",
        }),
      ],
    },
  });
  expect(await screen.findByText(/No usable coordinates/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Publisher / source label"), {
    target: { value: "Fictional fixture" },
  });
  fireEvent.change(screen.getByLabelText("Provenance", { exact: true }), {
    target: { value: "synthetic_demo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        (c) => c[0] === "/api/datasets" && c[1]?.method === "POST",
      ),
    ).toBe(true),
  );
  const request = fetcher.mock.calls.find(
    (c) => c[0] === "/api/datasets" && c[1]?.method === "POST",
  );
  expect((request![1]!.body as FormData).get("provenance")).toBe(
    "synthetic_demo",
  );
});
