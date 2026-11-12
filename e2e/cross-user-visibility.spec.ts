import { expect, test } from "@playwright/test";
import {
  ADMIN,
  APPROVER,
  REQUESTER,
  SECOND_REQUESTER,
  approveOrder,
  approveRequest,
  assignVendorAndCreateOrder,
  createPayment,
  createRequest,
  documentNumber,
  signIn,
} from "./helpers";

/**
 * Cross-user visibility: two requesters must never see or open each other's
 * requests, purchase orders, or payments. Approvers and admins can see both.
 *
 * Uses the seeded second requester (`staff2@procura.app`) and leaves demo
 * records behind; run `npm run db:seed` to restore the clean demo state.
 */
test("requesters cannot see each other's requests, orders, or payments", async ({
  browser,
}) => {
  const run = Date.now().toString().slice(-6);
  const purpose = `Cross-user visibility ${run}`;

  let requestUrl = "";
  let requestNumber = "";
  let orderUrl = "";
  let orderNumber = "";
  let paymentUrl = "";
  let paymentNumber = "";

  const sara = await signIn(browser, REQUESTER);
  const leo = await signIn(browser, SECOND_REQUESTER);
  const manager = await signIn(browser, APPROVER);
  const admin = await signIn(browser, ADMIN);

  await test.step("second requester creates a request", async () => {
    requestUrl = await createRequest(leo, purpose);
    requestNumber = await documentNumber(leo);
    await expect(leo.getByText("Request submitted for approval")).toBeVisible();
  });

  await test.step("first requester's list and dashboard omit the request", async () => {
    await sara.goto("/purchase-requests");
    await expect(sara.getByText(purpose)).toHaveCount(0);

    await sara.goto("/dashboard");
    await expect(sara.getByText(purpose)).toHaveCount(0);

    await sara.goto(`/purchase-requests?q=${requestNumber}`);
    await expect(sara.locator("tbody tr")).toHaveCount(0);
  });

  await test.step("first requester cannot open the request by URL", async () => {
    await sara.goto(requestUrl);
    await expect(sara).toHaveURL(/\/purchase-requests\?error=/);
    await expect(
      sara.getByText("You can only view your own requests."),
    ).toBeVisible();
    await expect(sara.getByText(purpose)).toHaveCount(0);
  });

  await test.step("approver and admin move the request through to a payment", async () => {
    await manager.goto("/approvals");
    await expect(manager.getByText(purpose)).toBeVisible();

    await approveRequest(manager, requestUrl);
    orderUrl = await assignVendorAndCreateOrder(admin, requestUrl);
    orderNumber = await documentNumber(admin);

    await approveOrder(manager, orderUrl);
    paymentUrl = await createPayment(admin, orderUrl);
    paymentNumber = await documentNumber(admin);
  });

  await test.step("first requester's order and payment lists omit the documents", async () => {
    await sara.goto(`/purchase-orders?q=${orderNumber}`);
    await expect(sara.locator("tbody tr")).toHaveCount(0);

    await sara.goto(`/payments?q=${paymentNumber}`);
    await expect(sara.locator("tbody tr")).toHaveCount(0);
  });

  await test.step("first requester cannot open the order or payment by URL", async () => {
    await sara.goto(orderUrl);
    await expect(sara).toHaveURL(/\/purchase-orders\?error=/);
    await expect(
      sara.getByText("You can only view orders from your own requests."),
    ).toBeVisible();

    await sara.goto(paymentUrl);
    await expect(sara).toHaveURL(/\/payments\?error=/);
    await expect(
      sara.getByText("You can only view payments for your own requests."),
    ).toBeVisible();
  });

  await test.step("second requester can open their own documents", async () => {
    await leo.goto(requestUrl);
    await expect(leo.getByText(requestNumber).first()).toBeVisible();
    await expect(leo.getByText("Ordered", { exact: true }).first()).toBeVisible();

    await leo.goto(orderUrl);
    await expect(leo.getByText(orderNumber).first()).toBeVisible();

    await leo.goto(paymentUrl);
    await expect(leo.getByText(paymentNumber).first()).toBeVisible();
  });

  await test.step("approver can open all documents", async () => {
    for (const [url, number] of [
      [requestUrl, requestNumber],
      [orderUrl, orderNumber],
      [paymentUrl, paymentNumber],
    ]) {
      await manager.goto(url);
      await expect(manager.getByText(number).first()).toBeVisible();
    }
  });

  await test.step("first requester still sees their own request", async () => {
    await sara.goto("/purchase-requests");
    await expect(
      sara.getByText("Replacement laptops and mice for two new joiners"),
    ).toBeVisible();
  });
});
