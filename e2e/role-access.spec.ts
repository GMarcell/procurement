import { expect, test, type Page } from "@playwright/test";
import { ADMIN, APPROVER, REQUESTER, signIn } from "./helpers";

/**
 * Role-based access: what each role can open and which actions are offered.
 * Uses the seeded requests, orders, and payments; run `npm run db:seed` first
 * if the database has been modified.
 */
async function expectRedirected(
  page: Page,
  from: string,
  to: string,
) {
  await page.goto(from);
  await expect(page).toHaveURL(new RegExp(`${to.replace(/[/?]/g, "\\$&")}`));
}

async function openFirstRow(page: Page, listPath: string, detailPath: string) {
  await page.goto(listPath);
  const link = page.locator(`tbody tr a[href^="${detailPath}"]`).first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(`**${detailPath}/*`);
}

test("requester has read-only master data and no approvals access", async ({
  browser,
}) => {
  const page = await signIn(browser, REQUESTER);

  await expectRedirected(page, "/approvals", "/dashboard");
  await expect(
    page.getByText("Approvals are only available to approvers and admins."),
  ).toBeVisible();

  await expectRedirected(page, "/products/new", "/products");
  await expectRedirected(page, "/vendors/new", "/vendors");
  await expectRedirected(page, "/purchase-orders/new", "/purchase-orders");

  await page.goto("/purchase-requests/new");
  await expect(page.getByText("New purchase request")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  await page.goto("/vendors");
  await expect(page.getByRole("link", { name: "New vendor" })).toHaveCount(0);

  await page.goto("/inventory");
  await expect(page.getByText("Adjust stock", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Only procurement admins can adjust stock."),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Approvals" })).toHaveCount(0);
});

test("approver can decide but cannot operate or edit master data", async ({
  browser,
}) => {
  const page = await signIn(browser, APPROVER);

  await page.goto("/approvals");
  await expect(page.getByText("Approvals", { exact: true }).first()).toBeVisible();

  await expectRedirected(page, "/purchase-requests/new", "/purchase-requests");
  await expectRedirected(page, "/products/new", "/products");
  await expectRedirected(page, "/vendors/new", "/vendors");

  await page.goto("/products");
  await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
  await page.goto("/vendors");
  await expect(page.getByRole("link", { name: "New vendor" })).toHaveCount(0);
  await page.goto("/inventory");
  await expect(page.getByText("Adjust stock", { exact: true })).toHaveCount(0);

  await openFirstRow(
    page,
    "/purchase-requests?status=ASSIGNED",
    "/purchase-requests",
  );
  await expect(page.getByText("Create purchase order")).toHaveCount(0);
  await expect(page.getByText("Assign a vendor")).toHaveCount(0);

  await openFirstRow(
    page,
    "/purchase-orders?status=PENDING",
    "/purchase-orders",
  );
  await expect(page.getByRole("button", { name: "Approve order" })).toBeVisible();
  await expect(page.getByText("Payment for")).toHaveCount(0);
  await expect(page.getByText("Receive goods for")).toHaveCount(0);

  await openFirstRow(page, "/payments?status=PENDING", "/payments");
  await expect(page.getByRole("button", { name: "Approve payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as paid" })).toHaveCount(0);
});

test("admin can operate across every area", async ({ browser }) => {
  const page = await signIn(browser, ADMIN);

  for (const path of [
    "/approvals",
    "/purchase-requests/new",
    "/products/new",
    "/vendors/new",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
  }

  await page.goto("/inventory");
  await expect(page.getByText("Adjust stock", { exact: true })).toBeVisible();

  await page.goto("/products");
  await expect(page.getByRole("link", { name: "New product" })).toBeVisible();

  await page.goto("/vendors");
  await expect(page.getByRole("link", { name: "New vendor" })).toBeVisible();

  await openFirstRow(
    page,
    "/purchase-requests?status=ASSIGNED",
    "/purchase-requests",
  );
  await expect(
    page.getByRole("link", { name: "Create purchase order" }),
  ).toBeVisible();
});
