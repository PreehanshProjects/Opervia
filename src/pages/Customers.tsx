import { ChevronRight, Search } from "lucide-react";
import Empty from "../components/Empty";
import { money, type Customer } from "../domain";

export default function Customers({
  customers,
  balances,
  openings,
  search,
  setSearch,
  onOpen,
}: {
  customers: Customer[];
  /** Outstanding per customer, summed in SQL rather than from every invoice. */
  balances: Record<string, number>;
  /** Which customers carry a pre-Opervia balance, for the card note. */
  openings: Record<string, number>;
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
                <b>{money(balances[c.id] ?? 0)}</b>
              </div>
              {(openings[c.id] ?? 0) > 0 && (
                <small className="card-note">
                  Includes {money(openings[c.id])} owed from before Opervia
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
