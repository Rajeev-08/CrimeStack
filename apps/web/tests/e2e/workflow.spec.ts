import { test, expect } from "@playwright/test";
import path from "node:path";
test("complete analyst workflow with external tiles blocked", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("E2e-test-password-2026");
  await page.getByLabel("Bootstrap secret").fill("e2e-bootstrap-secret");
  await page
    .getByRole("button", { name: "Create administrator", exact: true })
    .click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page
    .getByLabel("Incident CSV")
    .setInputFiles(path.resolve("../../data/examples/synthetic-karnataka.csv"));
  await expect(page.getByText("map ready rows", { exact: true })).toBeVisible();
  await page
    .getByLabel("Dataset name", { exact: true })
    .fill("E2E fictional incidents");
  await page
    .getByLabel("Publisher / source label")
    .fill("Fictional test generator");
  await page
    .getByLabel("Provenance", { exact: true })
    .selectOption("synthetic_demo");
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByText("SYNTHETIC DEMO", { exact: true })).toBeVisible();
  await expect(page.getByTestId("incident-map")).toBeVisible();
  const count = Number(
    await page.getByTestId("incident-map").getAttribute("data-point-count"),
  );
  expect(count).toBeGreaterThan(0);
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.getByLabel("Map mode").selectOption("clusters");
  await page.getByLabel("Map mode").selectOption("heatmap");
  await page.getByLabel("Map mode").selectOption("points");
  await page.getByLabel("View name").fill("E2E saved view");
  await page.getByRole("button", { name: "Save current view" }).click();
  await expect(
    page.getByRole("button", { name: "E2E saved view" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Intelligence Copilot", exact: true })
    .click();
  await page
    .getByLabel("Question", { exact: true })
    .fill("Show total incidents");
  await page.getByRole("button", { name: "Ask Copilot", exact: true }).click();
  await expect(page.getByText(/Evidence \[1\]/)).toBeVisible();
  await expect(
    page.getByText("Rules-based evidence mode", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Early Warnings", exact: true })
    .click();
  await page.getByLabel("Warning threshold").selectOption("sensitive");
  const review = page.locator("article.record").first();
  await review
    .getByPlaceholder("Review note")
    .fill("Reviewed fictional weekly increase");
  await review.getByRole("button", { name: "Save review" }).click();
  await expect(review.getByText("Status: investigating")).toBeVisible();
  await page
    .getByRole("button", { name: "Briefing Centre", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate brief", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verify integrity", exact: true })
    .first()
    .click();
  await expect(page.locator(".notice")).toContainText("Yes");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("E2e-test-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
