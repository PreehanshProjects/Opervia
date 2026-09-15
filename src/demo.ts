import {
  type Data,
  type Invoice,
  defaultBusiness,
  today,
  plusDays,
  totals,
} from "./domain";
export function makeDemo(): Data {
  const business = {
    ...defaultBusiness,
    name: "Demo business",
  };
  const customers = [
    {
      id: "demo-1",
      name: "Sample Restaurant",
      address: "Tamarin",
      phone: "",
      email: "",
      brn: "",
    },
    {
      id: "demo-2",
      name: "The Garden Café",
      address: "Quatre Bornes",
      phone: "",
      email: "",
      brn: "",
    },
    {
      id: "demo-3",
      name: "Coastal Kitchen",
      address: "Flic en Flac",
      phone: "",
      email: "",
      brn: "",
    },
  ];
  const examples = [
    {
      customer: 0,
      days: -8,
      items: [
        {
          description: "Lettuce",
          quantity: 25,
          unit: "pc",
          price: 35,
          section: "Kitchen",
        },
        {
          description: "Roma tomatoes",
          quantity: 2,
          unit: "kg",
          price: 120,
          section: "Kitchen",
        },
        {
          description: "Fresh basil",
          quantity: 0.5,
          unit: "kg",
          price: 500,
          section: "Kitchen",
        },
      ],
    },
    {
      customer: 1,
      days: -4,
      items: [
        {
          description: "Seasonal vegetables",
          quantity: 15,
          unit: "kg",
          price: 80,
          section: "",
        },
      ],
    },
    {
      customer: 2,
      days: -35,
      items: [
        {
          description: "Fresh fruit selection",
          quantity: 12,
          unit: "kg",
          price: 145,
          section: "",
        },
      ],
    },
  ];
  const invoices: Invoice[] = examples.map((e, i) => ({
    id: `demo-inv-${i}`,
    number: `OP-${String(1001 + i)}`,
    customer_id: customers[e.customer].id,
    customer: customers[e.customer],
    business,
    date: plusDays(today(), e.days),
    due_date: plusDays(today(), e.days + 30),
    items: e.items,
    notes: "",
    tax_rate: 0,
    ...totals(e.items),
    voided: false,
  }));
  return {
    business,
    customers,
    invoices,
    payments: [
      {
        id: "demo-pay-1",
        invoice_id: invoices[0].id,
        date: plusDays(today(), -6),
        amount: 500,
        method: "Bank transfer",
        reference: "Sample deposit",
      },
      {
        id: "demo-pay-2",
        invoice_id: invoices[1].id,
        date: plusDays(today(), -2),
        amount: 1200,
        method: "Cash",
        reference: "",
      },
    ],
    expenses: [
      {
        id: "demo-exp-1",
        date: plusDays(today(), -3),
        description: "Delivery fuel",
        note: "Morning run to Tamarin and Flic en Flac. Receipt in the folder.",
        category: "Transport",
        amount: 650,
      },
    ],
    // What this customer already owed when the paper book was closed.
    openings: [
      {
        customer_id: customers[2].id,
        date: plusDays(today(), -45),
        amount: 3200,
        note: "Carried over from the invoice book",
      },
    ],
  };
}
