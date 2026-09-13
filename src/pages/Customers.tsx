import { ChevronRight, Search } from "lucide-react";
import Empty from "../components/Empty";
import {
  balance,
  money,
  openingOutstanding,
  type Customer,
  type Data,
  type Invoice,
  type Payment,
} from "../domain";

export default function Customers({
  customers,
  valid,
  payments,
  data,
  search,
  setSearch,
  onOpen,
}: {
  customers: Customer[];
  valid: Invoice[];
  payments: Payment[];
  data: Data;
  search: string;
  setSearch: (s: string) => void;
  onOpen: (c: Customer) => void;
}) {
  return (
    <>
      <div className="search-box standalone">
        <Search size={17} />
        <input
          aria-label="Search customers"
          placeholder="Find a customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="customer-grid">
        {customers
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => (
            <button
              type="button"
              className="customer-card"
              key={c.id}
              onClick={() => onOpen(c)}
            >
              <div className="customer-top">
                <span className="customer-avatar">
                  {c.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </span>
                <ChevronRight size={18} />
              </div>
              <h3>{c.name}</h3>
              <p>{c.address || "No address added"}</p>
              <div>
                <span>Outstanding</span>
                <b>
                  {money(
                    valid
                      .filter((i) => i.customer_id === c.id)
                      .reduce((s, i) => s + balance(i, payments), 0) +
                      openingOutstanding(c.id, data),
                  )}
                </b>
              </div>
              {openingOutstanding(c.id, data) > 0 && (
                <small className="card-note">
                  Includes {money(openingOutstanding(c.id, data))} owed from
                  before Opervia
                </small>
              )}
            </button>
          ))}
      </div>
      {!customers.length && (
        <Empty
          title="Meet your first customer"
          detail="Save their details once. Use them on every invoice."
        />
      )}
    </>
  );
}
