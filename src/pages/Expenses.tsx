import { ChevronRight, Download } from "lucide-react";
import Empty from "../components/Empty";
import { dateLabel, money, type Data, type Expense } from "../domain";

export default function Expenses({
  expenses,
  total,
  onOpen,
  onExport,
}: {
  expenses: Data["expenses"];
  total: number;
  onOpen: (e: Expense) => void;
  onExport: (filename: string, rows: unknown[][]) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Everyday expenses</h2>
          <p>Total recorded: {money(total)}</p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            onExport("opervia-expenses.csv", [
              ["Date", "Description", "Category", "Amount MUR"],
              ...expenses.map((e) => [
                e.date,
                e.description,
                e.category,
                e.amount,
              ]),
            ])
          }
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>
      {expenses.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>DESCRIPTION</th>
                <th>CATEGORY</th>
                <th>AMOUNT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...expenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.date)}</td>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() => onOpen(e)}
                      >
                        {e.description}
                      </button>
                    </td>
                    <td>
                      <span className="badge neutral">{e.category}</span>
                    </td>
                    <td className="number">{money(e.amount)}</td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Edit ${e.description}`}
                        className="icon-button"
                        onClick={() => onOpen(e)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Nothing spent, nothing missed"
          detail="Record fuel, supplies, rent, and other business expenses."
        />
      )}
    </section>
  );
}
