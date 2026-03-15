import { useState } from "react";

const monthlyData = [
  { month: "Janvier", ca: "125 400 €", cm: "29.4 %", covers: "4820" },
  { month: "Février", ca: "118 900 €", cm: "30.1 %", covers: "4560" },
  { month: "Mars", ca: "132 700 €", cm: "28.7 %", covers: "5040" },
  { month: "Avril", ca: "127 300 €", cm: "29.0 %", covers: "4910" },
  { month: "Mai", ca: "-", cm: "-", covers: "-" },
  { month: "Juin", ca: "-", cm: "-", covers: "-" },
  { month: "Juillet", ca: "-", cm: "-", covers: "-" },
  { month: "Août", ca: "-", cm: "-", covers: "-" },
  { month: "Septembre", ca: "-", cm: "-", covers: "-" },
  { month: "Octobre", ca: "-", cm: "-", covers: "-" },
  { month: "Novembre", ca: "-", cm: "-", covers: "-" },
  { month: "Décembre", ca: "-", cm: "-", covers: "-" },
];

export default function ParametresPage() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#24130F_0%,#2B1712_45%,#1E100D_100%)] text-[#F5EBDD]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* HEADER */}
        <section className="mb-6 overflow-hidden rounded-[28px] border border-[#694334] bg-[linear-gradient(135deg,#1A120F_0%,#2A1914_55%,#3A211A_100%)] shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
          <div className="h-1.5 bg-gradient-to-r from-[#7A4B2D] via-[#A14E3B] to-[#6E2F3A]" />
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#CCB39B]">
                Hippopotamus Thillois
              </p>
              <h1 className="mt-2 text-3xl font-black text-[#FFF3E7]">
                Paramètres
              </h1>
              <p className="mt-2 text-sm text-[#D7C0AA]">
                Gestion mensuelle du CA, CM, couverts et imports inventaires
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <select className="rounded-2xl border border-[#7E5A48] bg-[#E7D6C3] px-4 py-3 text-sm font-semibold text-[#2C231E] outline-none">
                <option>Avril</option>
                <option>Mai</option>
                <option>Juin</option>
              </select>

              <button className="rounded-2xl border border-[#8A3942] bg-[#6E2F3A] px-5 py-3 text-sm font-bold text-[#FFF3E7] transition hover:bg-[#5D2530]">
                Enregistrer
              </button>
            </div>
          </div>
        </section>

        {/* KPIS */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["CA mensuel", "127 300 €"],
            ["CM mensuel", "29.0 %"],
            ["Couverts", "4910"],
            ["Inventaire", "Avril"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[24px] border border-[#6A4536] bg-[linear-gradient(180deg,#2B1B16_0%,#241612_100%)] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-[#C7AE95]">
                {label}
              </p>
              <p className="mt-3 text-3xl font-black text-[#FFF3E7]">
                {value}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.85fr]">
          {/* TABLEAU */}
          <section className="overflow-hidden rounded-[28px] border border-[#6A4536] bg-[#2A1A15] shadow-[0_14px_32px_rgba(0,0,0,0.24)]">
            <div className="border-b border-[#50362C] bg-[#1B120F] px-6 py-4">
              <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF3E7]">
                Suivi mensuel
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#3A2923] text-[#F6EBDD]">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-bold">Mois</th>
                    <th className="px-5 py-4 text-left text-sm font-bold">CA</th>
                    <th className="px-5 py-4 text-left text-sm font-bold">CM</th>
                    <th className="px-5 py-4 text-left text-sm font-bold">Couverts</th>
                  </tr>
                </thead>

                <tbody>
                  {monthlyData.map((row, index) => (
                    <tr
                      key={row.month}
                      className={index % 2 === 0 ? "bg-[#E6D5C2]" : "bg-[#DDCAB6]"}
                    >
                      <td className="border-t border-[#C4AA91] px-5 py-4 font-bold text-[#2B2623]">
                        {row.month}
                      </td>
                      <td className="border-t border-[#C4AA91] px-5 py-4 text-[#2B2623]">
                        {row.ca}
                      </td>
                      <td className="border-t border-[#C4AA91] px-5 py-4 text-[#2B2623]">
                        {row.cm}
                      </td>
                      <td className="border-t border-[#C4AA91] px-5 py-4 text-[#2B2623]">
                        {row.covers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* COLONNE DROITE */}
          <aside className="space-y-6">
            {/* IMPORT DRAG DROP */}
            <section className="overflow-hidden rounded-[28px] border border-[#6A4536] bg-[#2A1A15] shadow-[0_14px_32px_rgba(0,0,0,0.24)]">
              <div className="border-b border-[#50362C] bg-[#1B120F] px-6 py-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF3E7]">
                  Import inventaire
                </h2>
              </div>

              <div className="p-6">
                <div
                  onDragEnter={() => setDragActive(true)}
                  onDragLeave={() => setDragActive(false)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                  }}
                  className={`rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition ${
                    dragActive
                      ? "border-[#A14E3B] bg-[#3A211A]"
                      : "border-[#9C6B4E] bg-[#33211B]"
                  }`}
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6E2F3A] text-2xl text-[#FFF3E7]">
                    ⤴
                  </div>

                  <p className="text-base font-bold text-[#FFF3E7]">
                    Déposer le fichier ici
                  </p>
                  <p className="mt-2 text-sm text-[#D6BFA9]">
                    ou cliquer pour sélectionner un fichier inventaire
                  </p>

                  <button className="mt-5 rounded-2xl border border-[#A14E3B] bg-[#6E2F3A] px-4 py-3 text-sm font-bold text-[#FFF3E7] transition hover:bg-[#5D2530]">
                    Choisir un fichier
                  </button>
                </div>
              </div>
            </section>

            {/* SAISIE */}
            <section className="overflow-hidden rounded-[28px] border border-[#6A4536] bg-[#2A1A15] shadow-[0_14px_32px_rgba(0,0,0,0.24)]">
              <div className="border-b border-[#50362C] bg-[#1B120F] px-6 py-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF3E7]">
                  Saisie mensuelle
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#E8D9C7]">
                    CM (%)
                  </label>
                  <input
                    defaultValue="25.5"
                    className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#E8D9C7]">
                    Objectif CA
                  </label>
                  <input
                    placeholder="Objectif CA"
                    className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#E8D9C7]">
                    Prévision couverts
                  </label>
                  <input
                    placeholder="Prévision couverts"
                    className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                  />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
