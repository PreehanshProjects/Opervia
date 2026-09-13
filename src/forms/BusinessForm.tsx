import { useState, type FormEvent } from "react";
import { Check, Image as ImageIcon, ShieldCheck, Trash2, Upload } from "lucide-react";
import { LOGO_HINT, readLogo } from "../lib/image";
import ThemeSwitch from "../components/ThemeSwitch";
import type { Theme } from "../lib/theme";
import type { Business } from "../domain";

export default function BusinessForm({
  business,
  busy,
  demo,
  email,
  theme,
  onTheme,
  onSave,
}: {
  business: Business;
  busy: boolean;
  demo: boolean;
  email?: string;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onSave: (b: Business) => Promise<void>;
}) {
  const [form, setForm] = useState(business);
  const [logoError, setLogoError] = useState("");
  return (
    <div className="settings-grid">
      <form
        className="panel form-body"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(form);
        }}
      >
        <h2>Your business details</h2>
        <p className="form-intro">
          For an individually registered business or a company. Enter your
          trading name and BRN as registered; a company registration number is
          not required. These details appear on new invoices and blank invoice
          sheets.
        </p>
        {/* The logo prints at the top of every invoice, beside the business name. */}
        <div className="logo-field">
          <div className="logo-preview" aria-hidden={!form.logo}>
            {form.logo ? (
              <img src={form.logo} alt="" />
            ) : (
              <ImageIcon size={22} />
            )}
          </div>
          <div className="logo-actions">
            <b>Business logo</b>
            <p>{LOGO_HINT}</p>
            {logoError && (
              <p className="logo-error" role="alert">
                {logoError}
              </p>
            )}
            <div className="button-row">
              <label className="btn secondary logo-choose">
                <Upload size={15} />
                {form.logo ? "Replace logo" : "Add a logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setLogoError("");
                    try {
                      const logo = await readLogo(file);
                      setForm((f) => ({ ...f, logo }));
                    } catch (err) {
                      setLogoError(
                        err instanceof Error
                          ? err.message
                          : "That image could not be used.",
                      );
                    }
                  }}
                />
              </label>
              {form.logo && (
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => {
                    setLogoError("");
                    setForm((f) => ({ ...f, logo: "" }));
                  }}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="form-grid">
          {(
            [
              "name",
              "proprietor",
              "subtitle",
              "address",
              "phone",
              "email",
              "brn",
            ] as const
          ).map((k) => (
            <label key={k} className={k === "address" ? "full" : ""}>
              {
                {
                  name: "Business name",
                  proprietor:
                    "Proprietor / registered person's name (optional)",
                  subtitle: "Business description",
                  address: "Business address",
                  phone: "Telephone",
                  email: "Email address",
                  brn: "Business registration number (BRN)",
                }[k]
              }
              <input
                required={k === "name"}
                maxLength={500}
                type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <h3>Bank details for invoices</h3>
        <p className="form-intro">
          Optional. Saved bank details are printed on new invoices and blank
          sheets so customers know where to pay.
        </p>
        <div className="form-grid">
          {(["bankName", "accountName", "accountNumber"] as const).map((k) => (
            <label key={k}>
              {
                {
                  bankName: "Bank name",
                  accountName: "Account holder name",
                  accountNumber: "Bank account number",
                }[k]
              }
              <input
                type="text"
                maxLength={k === "accountNumber" ? 100 : 200}
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <label className="full">
            Payment terms
            <textarea
              rows={4}
              maxLength={2000}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
            />
          </label>
        </div>
        <button disabled={busy || !form.name.trim()} className="btn primary">
          {busy ? "Saving…" : "Save details"}
          <Check size={16} />
        </button>
      </form>
      <div className="panel form-body appearance-card">
        <h3>Appearance</h3>
        <p>
          Choose how Opervia looks on this device. The printed invoice always
          stays on white paper.
        </p>
        <ThemeSwitch theme={theme} onChange={onTheme} />
      </div>
      <div className="panel form-body security-card">
        <ShieldCheck size={27} />
        <h3>A private place for your books</h3>
        <p>
          {demo ? "You are using an in-memory demo." : `Signed in as ${email}`}
        </p>
        <ul>
          <li>One private workspace per account</li>
          <li>Database rules isolate your records</li>
          <li>Issued invoices keep their original details</li>
          <li>Payments cannot exceed the balance</li>
        </ul>
        <div className="settings-currency">
          <b>MUR</b>
          <span>
            Mauritian rupee
            <br />
            <small>Workspace currency</small>
          </span>
        </div>
        <p className="micro">
          Staff sharing and full double-entry accounting are outside this first
          version. Keep your own exported records and configure database backups
          before live use.
        </p>
      </div>
    </div>
  );
}
