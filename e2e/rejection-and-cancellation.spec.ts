import { expect, test } from "@playwright/test";
import {
  ADMIN,
  APPROVER,
  REQUESTER,
  approveOrder,
  approveRequest,
  assignVendorAndCreateOrder,
  createPayment,
  createRequest,
  documentNumber,
  rejectOrder,
  rejectPayment,
  rejectRequest,
  signIn,
} from "./helpers";

/**
 * Cancellation and rejection paths, including re-ordering after a purchase
 * order is rejected. Leaves demo records behind; run `npm run db:seed` to
 * restore the clean demo state.
 */
test("cancellation, rejection, and re-ordering behave consistently", async ({
  browser,
}) => {
  const run = Date.now().toString().slice(-6);
  const staff = await signIn(browser, REQUESTER);
  const manager = await signIn(browser, APPROVER);
  const admin = await signIn(browser, ADMIN);

  await test.step("requester cancels a submitted request", async () => {
    const purpose = `Cancel check ${run}`;
    await createRequest(staff, purpose);
    await staff.getByRole("button", { name: "Cancel request" }).click();

    await expect(staff.getByText("Purchase request cancelled")).toBeVisible();
    await expect(staff.getByText("This request was cancelled.")).toBeVisible();
    await expect(staff.getByText("Cancelled", { exact: true }).first()).toBeVisible();

    await manager.goto("/approvals");
    await expect(manager.getByText(purpose)).toHaveCount(0);
  });

  await test.step("approver rejects a request and the requester sees why", async () => {
    const purpose = `Reject request check ${run}`;
    const reason = "Not part of this quarter's budget";
    const requestUrl = await createRequest(staff, purpose);
    await rejectRequest(manager, requestUrl, reason);

    await staff.goto(requestUrl);
    await expect(staff.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await expect(staff.getByText(reason)).toBeVisible();
    await expect(
      staff.getByRole("button", { name: "Approve request" }),
    ).toHaveCount(0);
  });

  await test.step("rejecting an order returns the request for re-ordering", async () => {
    const purpose = `Reject order check ${run}`;
    const requestUrl = await createRequest(staff, purpose);
    await approveRequest(manager, requestUrl);

    const rejectedOrderUrl = await assignVendorAndCreateOrder(admin, requestUrl);
    const rejectedNumber = await documentNumber(admin);
    await rejectOrder(manager, rejectedOrderUrl, "Vendor price too high");

    await admin.goto(rejectedOrderUrl);
    await expect(admin.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await expect(admin.getByText("Vendor price too high")).toBeVisible();
    for (const unavailable of [
      "Approve order",
      "Payment for",
      "Receive goods for",
    ]) {
      await expect(admin.getByText(unavailable)).toHaveCount(0);
    }

    await admin.goto("/dashboard");
    await expect(admin.getByText("Needs a replacement")).toBeVisible();
    await expect(admin.getByText(rejectedNumber).first()).toBeVisible();
    await expect(admin.getByText(/Rejected order for/).first()).toBeVisible();

    await admin.goto(requestUrl);
    await expect(
      admin.getByText("Vendor assigned", { exact: true }).first(),
    ).toBeVisible();
    await expect(admin.getByText(/was rejected/)).toBeVisible();

    await admin.getByRole("link", { name: "Create replacement order" }).click();
    await admin.waitForURL("**/purchase-orders/new?requestId=*");
    await expect(
      admin.getByText(`Replacement for ${rejectedNumber}`),
    ).toBeVisible();

    await admin.getByRole("button", { name: "Create purchase order" }).click();
    await admin.waitForURL("**/purchase-orders/*?notice=*");
    const replacementUrl = admin.url().split("?")[0];
    const replacementNumber = await documentNumber(admin);
    expect(replacementNumber).not.toBe(rejectedNumber);

    await admin.goto("/dashboard");
    await expect(admin.getByText("Needs a replacement")).toHaveCount(0);

    await approveOrder(manager, replacementUrl);

    await admin.goto(requestUrl);
    await expect(admin.getByText("Ordered", { exact: true }).first()).toBeVisible();
    await expect(admin.getByText(rejectedNumber).first()).toBeVisible();
    await expect(admin.getByText(replacementNumber).first()).toBeVisible();
    await expect(admin.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await expect(admin.getByText("Approved", { exact: true }).first()).toBeVisible();

    // The rejected order remains readable for the audit trail.
    await admin.goto(rejectedOrderUrl);
    await expect(admin.getByText(rejectedNumber).first()).toBeVisible();
    await expect(admin.getByText("Vendor price too high")).toBeVisible();
  });

  await test.step("rejecting a payment blocks it and allows a replacement", async () => {
    const purpose = `Reject payment check ${run}`;
    const requestUrl = await createRequest(staff, purpose);
    await approveRequest(manager, requestUrl);
    const orderUrl = await assignVendorAndCreateOrder(admin, requestUrl);
    await approveOrder(manager, orderUrl);

    const rejectedPaymentUrl = await createPayment(admin, orderUrl);
    const rejectedPaymentNumber = await documentNumber(admin);
    await rejectPayment(
      manager,
      rejectedPaymentUrl,
      "Invoice does not match the order",
    );

    await admin.goto(rejectedPaymentUrl);
    await expect(admin.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await expect(
      admin.getByText("Invoice does not match the order"),
    ).toBeVisible();
    await expect(admin.getByRole("button", { name: "Mark as paid" })).toHaveCount(0);

    await admin.goto("/dashboard");
    await expect(admin.getByText("Needs a replacement")).toBeVisible();
    await expect(admin.getByText(rejectedPaymentNumber).first()).toBeVisible();
    await expect(admin.getByText(/Rejected payment for/).first()).toBeVisible();

    await admin.goto(orderUrl);
    await expect(
      admin.getByText("Raise a replacement payment request below."),
    ).toBeVisible();

    await admin.getByRole("button", { name: "Submit payment request" }).click();
    await admin.waitForURL("**/payments/*?notice=*");
    const replacementPaymentUrl = admin.url().split("?")[0];
    const replacementPaymentNumber = await documentNumber(admin);
    expect(replacementPaymentNumber).not.toBe(rejectedPaymentNumber);

    await admin.goto("/dashboard");
    await expect(admin.getByText("Needs a replacement")).toHaveCount(0);

    await manager.goto(replacementPaymentUrl);
    await manager.getByRole("button", { name: "Approve payment" }).click();
    await manager.waitForURL("**/payments/*?notice=*");
    await expect(manager.getByText("Payment approved").first()).toBeVisible();

    await admin.goto(replacementPaymentUrl);
    await admin.getByRole("button", { name: "Mark as paid" }).click();
    await admin.waitForURL("**/payments/*?notice=*");
    await expect(admin.getByText("Payment recorded as paid")).toBeVisible();

    await admin.goto(orderUrl);
    await expect(
      admin.getByText(replacementPaymentNumber).first(),
    ).toBeVisible();
    await expect(admin.getByText("Earlier payment requests")).toBeVisible();
    await expect(admin.getByText(rejectedPaymentNumber).first()).toBeVisible();
    await expect(admin.getByText("Rejected", { exact: true }).first()).toBeVisible();
    await expect(admin.getByText("Paid", { exact: true }).first()).toBeVisible();
  });
});
