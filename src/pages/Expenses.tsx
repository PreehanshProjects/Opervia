import { Download } from "lucide-react";
import Empty from "../components/Empty";
import { CSV_MIME, dateLabel, money, toCsv, type Data } from "../domain";
import { saveTextFile } from "../lib/platform";

export default function Expenses({
  expenses,
  total,
}: {
  expenses: Data["expenses"];
  total: number;
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
            void saveTextFile(
              "opervia-expenses.csv",
              toCsv([
                ["Date", "Description", "Category", "Amount MUR"],
                ...expenses.map((e) => [
                  e.date,
                  e.description,
                  e.category,
                  e.amount,
                ]),
              ]),
              CSV_MIME,
            )
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
              </tr>
            </thead>
            <tbody>
              {[...expenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.date)}</td>
                    <td>
                      <b>{e.description}</b>
                    </td>
                    <td>
                      <span className="badge neutral">{e.category}</span>
                    </td>
                    <td className="number">{money(e.amount)}</td>
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
