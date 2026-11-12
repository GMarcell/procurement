import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const YEAR = new Date().getFullYear();
const PASSWORD = "password123";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function reset() {
  // Delete in dependency order so the seed can be re-run safely.
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequestItem.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  const password = await bcrypt.hash(PASSWORD, 10);

  const [admin, manager, staff, secondRequester] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Amina Yusuf",
        email: "admin@procura.app",
        password,
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        name: "Daniel Tan",
        email: "manager@procura.app",
        password,
        role: "APPROVER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Sara Kim",
        email: "staff@procura.app",
        password,
        role: "REQUESTER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Leo Martins",
        email: "staff2@procura.app",
        password,
        role: "REQUESTER",
      },
    }),
  ]);

  const productData = [
    ["IT-1001", "Laptop 14\" Business", "IT Equipment", "unit", 1150, 8, 3],
    ["IT-1002", "Wireless Mouse", "IT Equipment", "pcs", 24.5, 40, 10],
    ["IT-1003", "27\" Monitor", "IT Equipment", "unit", 289, 5, 4],
    ["OFF-2001", "A4 Copy Paper (Ream)", "Office Supplies", "pack", 4.75, 120, 30],
    ["OFF-2002", "Ballpoint Pens (Box of 50)", "Office Supplies", "box", 12.9, 18, 20],
    ["OFF-2003", "Whiteboard Marker Set", "Office Supplies", "set", 8.4, 25, 10],
    ["FUR-3001", "Ergonomic Office Chair", "Furniture", "unit", 189, 6, 2],
    ["SAF-4001", "Safety Helmet", "Safety Equipment", "pcs", 22, 30, 10],
    ["SAF-4002", "Industrial Gloves (Pair)", "Safety Equipment", "pcs", 6.5, 60, 25],
    ["PKG-5001", "Shipping Carton (Large)", "Packaging", "pcs", 1.85, 120, 100],
    ["CLN-6001", "Floor Cleaner 5L", "Cleaning", "litre", 14.2, 12, 5],
  ] as const;

  const products: Record<string, { id: string }> = {};
  for (const [sku, name, category, unit, unitPrice, stockQty, minStock] of productData) {
    products[sku] = await prisma.product.create({
      data: { sku, name, category, unit, unitPrice, stockQty, minStock },
    });
  }

  const vendorData = [
    ["V-001", "Northwind Office Supply", "Grace Lim", "grace@northwind.example", "NET 30"],
    ["V-002", "TechSource Distribution", "Ravi Menon", "ravi@techsource.example", "NET 15"],
    ["V-003", "SafeGuard Industrial", "Nora Haddad", "nora@safeguard.example", "NET 45"],
    ["V-004", "PackRight Packaging", "Tom Becker", "tom@packright.example", "NET 30"],
    ["V-005", "CleanPro Supplies", "Ivy Chen", "ivy@cleanpro.example", "NET 7"],
    ["V-006", "Comfortline Furniture", "Omar Farouk", "omar@comfortline.example", "NET 30"],
  ] as const;

  const vendors: Record<string, { id: string; name: string }> = {};
  for (const [code, name, contactName, email, paymentTerms] of vendorData) {
    vendors[code] = await prisma.vendor.create({
      data: { code, name, contactName, email, paymentTerms },
    });
  }

  // Opening balances become the first entries in the movement ledger. Products
  // that are received again below start lower so stock and ledger agree.
  const receivedDuringSeed: Record<string, number> = {
    "OFF-2001": 40,
    "OFF-2002": 10,
  };
  for (const [sku, , , , , stockQty] of productData) {
    const opening = stockQty - (receivedDuringSeed[sku] ?? 0);
    if (opening > 0) {
      await prisma.inventoryMovement.create({
        data: {
          productId: products[sku].id,
          type: "ADJUSTMENT",
          quantity: opening,
          reference: "Opening balance",
          note: "Stock carried over when Procura was introduced",
          createdById: admin.id,
          createdAt: daysAgo(90),
        },
      });
    }
  }

  // ── Purchase requests across every stage ──────────────────────────────────
  const submitted = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0001`,
      requesterId: staff.id,
      department: "Operations",
      purpose: "Replacement laptops and mice for two new joiners",
      neededBy: daysAgo(-10),
      status: "SUBMITTED",
      notes: "Please order the same model as the current fleet.",
      createdAt: daysAgo(2),
      items: {
        create: [
          {
            productId: products["IT-1001"].id,
            quantity: 3,
            estimatedUnitPrice: 1150,
          },
          {
            productId: products["IT-1002"].id,
            quantity: 5,
            estimatedUnitPrice: 24.5,
          },
        ],
      },
    },
  });

  const approved = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0002`,
      requesterId: staff.id,
      department: "IT",
      purpose: "Second monitor and markers for the meeting room",
      neededBy: daysAgo(-14),
      status: "APPROVED",
      approvedById: manager.id,
      approvedAt: daysAgo(3),
      createdAt: daysAgo(5),
      items: {
        create: [
          {
            productId: products["IT-1003"].id,
            quantity: 2,
            estimatedUnitPrice: 289,
          },
          {
            productId: products["OFF-2003"].id,
            quantity: 4,
            estimatedUnitPrice: 8.4,
          },
        ],
      },
    },
  });

  const assigned = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0003`,
      requesterId: staff.id,
      department: "Warehouse",
      purpose: "Safety gear for the new night shift team",
      neededBy: daysAgo(-7),
      status: "ASSIGNED",
      approvedById: manager.id,
      approvedAt: daysAgo(4),
      vendorId: vendors["V-003"].id,
      vendorNote: "Best lead time for certified helmets.",
      assignedById: admin.id,
      assignedAt: daysAgo(3),
      createdAt: daysAgo(6),
      items: {
        create: [
          {
            productId: products["SAF-4001"].id,
            quantity: 15,
            estimatedUnitPrice: 22,
          },
          {
            productId: products["SAF-4002"].id,
            quantity: 20,
            estimatedUnitPrice: 6.5,
          },
        ],
      },
    },
  });

  const restock = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0004`,
      requesterId: staff.id,
      department: "Operations",
      purpose: "Quarterly office restock",
      neededBy: daysAgo(5),
      status: "ORDERED",
      approvedById: manager.id,
      approvedAt: daysAgo(24),
      vendorId: vendors["V-001"].id,
      assignedById: admin.id,
      assignedAt: daysAgo(23),
      createdAt: daysAgo(26),
      items: {
        create: [
          {
            productId: products["OFF-2001"].id,
            quantity: 40,
            estimatedUnitPrice: 4.75,
          },
          {
            productId: products["OFF-2002"].id,
            quantity: 10,
            estimatedUnitPrice: 12.9,
          },
        ],
      },
    },
  });

  await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0005`,
      requesterId: staff.id,
      department: "Marketing",
      purpose: "Branded giveaways for the trade show",
      status: "REJECTED",
      approvedById: manager.id,
      approvedAt: daysAgo(8),
      rejectionReason: "Not part of this quarter's approved budget.",
      createdAt: daysAgo(9),
      items: {
        create: [
          {
            productId: products["OFF-2002"].id,
            quantity: 50,
            estimatedUnitPrice: 12.9,
          },
        ],
      },
    },
  });

  const chairs = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0006`,
      requesterId: staff.id,
      department: "Human Resources",
      purpose: "Four ergonomic chairs for the support desk",
      neededBy: daysAgo(-21),
      status: "ORDERED",
      approvedById: manager.id,
      approvedAt: daysAgo(2),
      vendorId: vendors["V-006"].id,
      assignedById: admin.id,
      assignedAt: daysAgo(1),
      createdAt: daysAgo(3),
      items: {
        create: [
          {
            productId: products["FUR-3001"].id,
            quantity: 4,
            estimatedUnitPrice: 189,
          },
        ],
      },
    },
  });

  const cleaningRequest = await prisma.purchaseRequest.create({
    data: {
      number: `PR-${YEAR}-0007`,
      requesterId: staff.id,
      department: "Warehouse",
      purpose: "Monthly cleaning supplies",
      status: "ORDERED",
      approvedById: manager.id,
      approvedAt: daysAgo(6),
      vendorId: vendors["V-005"].id,
      assignedById: admin.id,
      assignedAt: daysAgo(5),
      createdAt: daysAgo(7),
      items: {
        create: [
          {
            productId: products["CLN-6001"].id,
            quantity: 10,
            estimatedUnitPrice: 14.2,
          },
        ],
      },
    },
  });

  // ── Completed order: deliveries, stock, and a paid invoice ────────────────
  const completedOrder = await prisma.purchaseOrder.create({
    data: {
      number: `PO-${YEAR}-0001`,
      purchaseRequestId: restock.id,
      vendorId: vendors["V-001"].id,
      createdById: admin.id,
      status: "COMPLETED",
      orderDate: daysAgo(22),
      expectedDate: daysAgo(10),
      subtotal: 319,
      total: 319,
      approvedById: manager.id,
      approvedAt: daysAgo(21),
      items: {
        create: [
          {
            productId: products["OFF-2001"].id,
            quantity: 40,
            unitPrice: 4.75,
            receivedQty: 40,
          },
          {
            productId: products["OFF-2002"].id,
            quantity: 10,
            unitPrice: 12.9,
            receivedQty: 10,
          },
        ],
      },
    },
    include: { items: true },
  });

  const paperItem = completedOrder.items.find(
    (item) => item.productId === products["OFF-2001"].id,
  )!;
  const pensItem = completedOrder.items.find(
    (item) => item.productId === products["OFF-2002"].id,
  )!;

  const firstDelivery = await prisma.goodsReceipt.create({
    data: {
      purchaseOrderId: completedOrder.id,
      receivedDate: daysAgo(12),
      receivedBy: "Amina Yusuf",
      deliveryNoteNo: "DN-4412",
      condition: "PARTIAL",
      notes: "Pens arrived short; balance to follow.",
      recordedById: admin.id,
      createdAt: daysAgo(12),
      items: {
        create: [
          { purchaseOrderItemId: paperItem.id, quantity: 25 },
          { purchaseOrderItemId: pensItem.id, quantity: 6 },
        ],
      },
    },
  });

  const secondDelivery = await prisma.goodsReceipt.create({
    data: {
      purchaseOrderId: completedOrder.id,
      receivedDate: daysAgo(9),
      receivedBy: "Amina Yusuf",
      deliveryNoteNo: "DN-4468",
      condition: "GOOD",
      recordedById: admin.id,
      createdAt: daysAgo(9),
      items: {
        create: [
          { purchaseOrderItemId: paperItem.id, quantity: 15 },
          { purchaseOrderItemId: pensItem.id, quantity: 4 },
        ],
      },
    },
  });

  for (const receipt of [firstDelivery, secondDelivery]) {
    const lines = await prisma.goodsReceiptItem.findMany({
      where: { goodsReceiptId: receipt.id },
    });
    for (const line of lines) {
      const orderItem = completedOrder.items.find(
        (item) => item.id === line.purchaseOrderItemId,
      )!;
      await prisma.inventoryMovement.create({
        data: {
          productId: orderItem.productId,
          type: "IN",
          quantity: line.quantity,
          reference: `${completedOrder.number} delivery`,
          note: `Delivery note ${receipt.deliveryNoteNo}`,
          createdById: admin.id,
          createdAt: receipt.receivedDate,
        },
      });
    }
  }

  await prisma.paymentRequest.create({
    data: {
      number: `PAY-${YEAR}-0001`,
      purchaseOrderId: completedOrder.id,
      amount: 319,
      dueDate: daysAgo(-8),
      method: "BANK_TRANSFER",
      status: "PAID",
      notes: "Paid from the operating account.",
      requestedById: admin.id,
      approvedById: manager.id,
      approvedAt: daysAgo(10),
      paidAt: daysAgo(8),
      createdAt: daysAgo(11),
    },
  });

  // ── Order waiting for approval ────────────────────────────────────────────
  await prisma.purchaseOrder.create({
    data: {
      number: `PO-${YEAR}-0002`,
      purchaseRequestId: chairs.id,
      vendorId: vendors["V-006"].id,
      createdById: admin.id,
      status: "PENDING",
      orderDate: daysAgo(1),
      expectedDate: daysAgo(-14),
      subtotal: 756,
      total: 756,
      notes: "Vendor offers free assembly on four units.",
      items: {
        create: [
          {
            productId: products["FUR-3001"].id,
            quantity: 4,
            unitPrice: 189,
          },
        ],
      },
    },
  });

  // ── Approved order with a payment waiting for approval ────────────────────
  const cleaningOrder = await prisma.purchaseOrder.create({
    data: {
      number: `PO-${YEAR}-0003`,
      purchaseRequestId: cleaningRequest.id,
      vendorId: vendors["V-005"].id,
      createdById: admin.id,
      status: "APPROVED",
      orderDate: daysAgo(4),
      expectedDate: daysAgo(-3),
      subtotal: 142,
      total: 142,
      approvedById: manager.id,
      approvedAt: daysAgo(2),
      items: {
        create: [
          {
            productId: products["CLN-6001"].id,
            quantity: 10,
            unitPrice: 14.2,
          },
        ],
      },
    },
  });

  await prisma.paymentRequest.create({
    data: {
      number: `PAY-${YEAR}-0002`,
      purchaseOrderId: cleaningOrder.id,
      amount: 142,
      dueDate: daysAgo(-20),
      method: "BANK_TRANSFER",
      status: "PENDING",
      requestedById: admin.id,
      createdAt: daysAgo(1),
    },
  });

  // ── A low-stock correction so the ledger has an OUT movement ──────────────
  await prisma.product.update({
    where: { id: products["PKG-5001"].id },
    data: { stockQty: 0 },
  });
  await prisma.inventoryMovement.create({
    data: {
      productId: products["PKG-5001"].id,
      type: "OUT",
      quantity: 120,
      reference: "Manual adjustment",
      note: "Damaged cartons written off after water damage",
      createdById: admin.id,
      createdAt: daysAgo(15),
    },
  });

  await prisma.sequence.createMany({
    data: [
      { key: `PR-${YEAR}`, value: 7 },
      { key: `PO-${YEAR}`, value: 3 },
      { key: `PAY-${YEAR}`, value: 2 },
    ],
  });

  console.log("Seed complete");
  console.log(
    `  Users:    4 (admin@ / manager@ / staff@ / ${secondRequester.email}, password ${PASSWORD})`,
  );
  console.log(`  Products: ${productData.length}`);
  console.log(`  Vendors:  ${vendorData.length}`);
  console.log("  Requests: 7 across submitted, approved, assigned, ordered, rejected");
  console.log("  Orders:   3 (completed, pending approval, approved)");
  console.log("  Payments: 2 (paid, pending approval)");
  console.log(`  Request ${submitted.number} awaits approval; ${approved.number} needs a vendor; ${assigned.number} is ready for a PO.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
