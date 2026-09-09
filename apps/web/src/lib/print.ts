/** Print only the requested evidence section, preserving Kannada browser fonts. */
export function printSection(section: HTMLElement | null, title: string) {
  if (!section) throw Error("Report section is unavailable");
  document.getElementById("crimestack-print-root")?.remove();
  const root = document.createElement("div");
  root.id = "crimestack-print-root";
  const heading = document.createElement("h1");
  heading.textContent = title;
  root.append(heading);
  const clone = section.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("button,form,input,select,.no-print")
    .forEach((node) => node.remove());
  clone
    .querySelectorAll("details")
    .forEach((node) => node.setAttribute("open", ""));
  root.append(clone);
  document.body.append(root);
  const cleanup = () => {
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
