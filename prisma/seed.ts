import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays, subMonths, startOfMonth } from "date-fns";

const prisma = new PrismaClient();

const DEMO_EXPENSE_CATEGORIES = [
  "Software & SaaS",
  "Professional services",
  "Advertising & marketing",
  "Travel",
  "Meals",
  "Office",
  "Equipment",
  "Insurance",
  "Bank fees",
  "Contract labor",
  "Education",
  "Utilities",
  "Vehicle",
  "Taxes & licenses",
  "Other",
];

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding demo data…");
  const email = "demo@ledgerflow.dev";
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Owner",
      passwordHash,
    },
  });
  console.log(`User: ${email} / demo1234`);

  const slug = "acme-consulting";
  let org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Acme Consulting",
        slug,
        legalName: "Acme Consulting Group LLC",
        businessType: "MULTI_MEMBER_LLC",
        country: "US",
        state: "CA",
        currency: "USD",
        timezone: "America/Los_Angeles",
        invoicePrefix: "ACG",
        invoiceNextNumber: 1,
        defaultPaymentTermsDays: 14,
        defaultTaxReserveRate: "27.0",
        minimumOperatingReserve: "5000",
        openingBalance: "8000",
        openingBalanceDate: subMonths(new Date(), 12),
      },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });
    await prisma.taxProfile.create({
      data: { organizationId: org.id, reserveRate: "27.0" },
    });
    await prisma.expenseCategory.createMany({
      data: DEMO_EXPENSE_CATEGORIES.map((n) => ({ organizationId: org!.id, name: n, isSystem: true })),
    });
    await prisma.owner.createMany({
      data: [
        {
          organizationId: org.id,
          name: "Alex Rivera",
          email: "alex@acme.example",
          ownershipPercentage: "60",
          distributionPercentage: "60",
        },
        {
          organizationId: org.id,
          name: "Jordan Kim",
          email: "jordan@acme.example",
          ownershipPercentage: "40",
          distributionPercentage: "40",
        },
      ],
    });
  }

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { id: `${org.id}-c1` },
      update: {},
      create: { id: `${org.id}-c1`, organizationId: org.id, companyName: "Northwind Retail", contactName: "Priya Shah", email: "priya@northwind.example" },
    }),
    prisma.client.upsert({
      where: { id: `${org.id}-c2` },
      update: {},
      create: { id: `${org.id}-c2`, organizationId: org.id, companyName: "Riverstone Studios", contactName: "Sam Chen", email: "sam@riverstone.example" },
    }),
    prisma.client.upsert({
      where: { id: `${org.id}-c3` },
      update: {},
      create: { id: `${org.id}-c3`, organizationId: org.id, companyName: "Beacon Labs", contactName: "Morgan Diaz", email: "morgan@beacon.example" },
    }),
  ]);

  const projects = await Promise.all(
    clients.map((c, i) =>
      prisma.project.upsert({
        where: { id: `${c.id}-p` },
        update: {},
        create: {
          id: `${c.id}-p`,
          organizationId: org.id,
          clientId: c.id,
          name: ["Website revamp", "Data migration", "Product analytics", "Team training"][i % 4],
          status: "ACTIVE",
          billingMethod: "HOURLY",
          hourlyRate: (150 + i * 10).toString(),
        },
      }),
    ),
  );

  // Wipe demo transactional data to keep seed idempotent-ish
  await prisma.payment.deleteMany({ where: { organizationId: org.id } });
  await prisma.timeEntry.deleteMany({ where: { organizationId: org.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: org.id } } });
  await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
  await prisma.expense.deleteMany({ where: { organizationId: org.id } });
  await prisma.distribution.deleteMany({ where: { organizationId: org.id } });
  await prisma.taxPayment.deleteMany({ where: { organizationId: org.id } });

  // Reset invoice numbering
  await prisma.organization.update({
    where: { id: org.id },
    data: { invoiceNextNumber: 1 },
  });

  const year = new Date().getFullYear();
  // Create 12 months of invoices + payments + expenses.
  for (let m = 11; m >= 0; m--) {
    const monthStart = startOfMonth(subMonths(new Date(), m));
    for (const client of clients) {
      const issueDate = new Date(monthStart);
      issueDate.setDate(rand(1, 27));
      const rateBase = 150 + Math.floor(Math.random() * 60);
      const hours = rand(6, 24);
      const amount = Math.round(rateBase * hours * 100) / 100;
      const subtotal = amount;
      const taxRate = 0;
      const total = subtotal;
      const number = await reserveNumber(org.id);
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: org.id,
          clientId: client.id,
          invoiceNumber: number,
          issueDate,
          dueDate: addDays(issueDate, 14),
          status: "SENT",
          currency: "USD",
          subtotal: subtotal.toString(),
          discount: "0",
          taxRate: taxRate.toString(),
          taxAmount: "0",
          total: total.toString(),
          amountPaid: "0",
          balanceDue: total.toString(),
        },
      });
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: `Consulting services (${monthStart.toLocaleString("en-US", { month: "long" })})`,
          quantity: hours.toString(),
          unit: "HOURS",
          rate: rateBase.toString(),
          amount: amount.toString(),
        },
      });
      // 80% of past invoices get paid.
      if (m > 0 && Math.random() < 0.85) {
        const paidDate = addDays(issueDate, rand(3, 20));
        await prisma.payment.create({
          data: {
            organizationId: org.id,
            invoiceId: invoice.id,
            clientId: client.id,
            amount: total.toString(),
            date: paidDate,
            method: pick(["ACH", "WIRE", "CHECK"] as const),
            reference: `REF-${Math.floor(Math.random() * 90000 + 10000)}`,
          },
        });
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: total.toString(),
            balanceDue: "0",
            status: "PAID",
            paidAt: paidDate,
          },
        });
      } else if (m === 0 && Math.random() < 0.4) {
        // Some current month partials
        const partial = Math.round(total * 0.4 * 100) / 100;
        await prisma.payment.create({
          data: {
            organizationId: org.id,
            invoiceId: invoice.id,
            clientId: client.id,
            amount: partial.toString(),
            date: addDays(issueDate, 5),
            method: "ACH",
          },
        });
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: partial.toString(),
            balanceDue: (total - partial).toString(),
            status: "PARTIALLY_PAID",
          },
        });
      }
    }
    // A handful of expenses per month
    const categories = await prisma.expenseCategory.findMany({ where: { organizationId: org.id } });
    for (let i = 0; i < 6; i++) {
      const cat = pick(categories);
      const date = new Date(monthStart);
      date.setDate(rand(1, 27));
      const amount = rand(30, 900);
      await prisma.expense.create({
        data: {
          organizationId: org.id,
          categoryId: cat.id,
          description: `${cat.name} — ${date.toLocaleString("en-US", { month: "short" })}`,
          amount: amount.toString(),
          date,
          paymentMethod: pick(["CREDIT_CARD", "BANK_TRANSFER", "CASH"] as const),
        },
      });
    }
    // Some time entries
    for (const project of projects.slice(0, 2)) {
      for (let d = 0; d < 3; d++) {
        const date = addDays(monthStart, rand(1, 25));
        await prisma.timeEntry.create({
          data: {
            organizationId: org.id,
            projectId: project.id,
            userId: user.id,
            date,
            description: pick([
              "Discovery workshop",
              "Implementation session",
              "Code review",
              "Analytics setup",
              "Client sync",
            ]),
            hours: rand(1, 4).toString(),
            billable: true,
            hourlyRate: project.hourlyRate?.toString() ?? "150",
          },
        });
      }
    }
  }

  // Distributions
  const owners = await prisma.owner.findMany({ where: { organizationId: org.id } });
  for (const o of owners) {
    for (let m = 8; m >= 1; m -= 2) {
      const date = subMonths(new Date(), m);
      const amount = Number(o.distributionPercentage) * 40;
      await prisma.distribution.create({
        data: {
          organizationId: org.id,
          ownerId: o.id,
          date,
          amount: amount.toString(),
          memo: `Q${Math.ceil((12 - m) / 3)} distribution`,
        },
      });
    }
  }

  // Tax payments (quarterly)
  const quarters = [
    { d: new Date(year, 3, 15), paid: true },
    { d: new Date(year, 5, 15), paid: true },
    { d: new Date(year, 8, 15), paid: false },
    { d: new Date(year + 1, 0, 15), paid: false },
  ];
  for (const q of quarters) {
    await prisma.taxPayment.create({
      data: {
        organizationId: org.id,
        authority: "IRS",
        jurisdiction: "Federal",
        description: `Q${quarters.indexOf(q) + 1} estimated payment`,
        estimatedAmount: "3500",
        amountPaid: q.paid ? "3500" : "0",
        paidDate: q.paid ? subDays(q.d, 3) : null,
        dueDate: q.d,
        status: q.paid ? "PAID" : q.d < new Date() ? "OVERDUE" : "UPCOMING",
      },
    });
  }

  console.log(`Seed complete. Sign in at http://localhost:3000/login with ${email} / demo1234`);
}

async function reserveNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { invoiceNextNumber: { increment: 1 } },
    select: { invoicePrefix: true, invoiceNextNumber: true },
  });
  const n = org.invoiceNextNumber - 1;
  return `${org.invoicePrefix}-${year}-${String(n).padStart(3, "0")}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
