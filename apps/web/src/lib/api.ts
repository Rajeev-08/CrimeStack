let accessToken = sessionStorage.getItem("crimestack-token") || "";
export function setToken(value: string) {
  accessToken = value;
  value
    ? sessionStorage.setItem("crimestack-token", value)
    : sessionStorage.removeItem("crimestack-token");
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      detail = response.statusText;
    }
    if (response.status === 401) {
      setToken("");
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
  }
  return response.json();
}
export const post = (path: string, data: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type Dataset = {
  id: string;
  name: string;
  publisher: string;
  provenance: string;
  quality: any;
  checksum: string;
};
export type User = { id: string; email: string; role: string };
export type ModuleRecord = {
  id: string;
  kind: string;
  dataset_id: string;
  owner: string;
  status: string;
  version: number;
  data: any;
  created_at: string;
};
