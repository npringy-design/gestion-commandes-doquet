import { useState } from "react";

const monthlyData = [
  { month: "Janvier", ca: "125 400 €", cm: "29.4 %", covers: "4820", inventory: "Importé" },
  { month: "Février", ca: "118 900 €", cm: "30.1 %", covers: "4560", inventory: "Importé" },
  { month: "Mars", ca: "132 700 €", cm: "28.7 %", covers: "5040", inventory: "En attente" },
  { month: "Avril", ca: "127 300 €", cm: "29.0 %", covers: "4910", inventory: "Importé" },
  { month: "Mai", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Juin", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Juillet", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Août", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Septembre", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Octobre", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Novembre", ca: "-", cm: "-", covers: "-", inventory: "-" },
  { month: "Décembre", ca: "-", cm: "-", covers: "-", inventory: "-" },
];

export default function ParametresPage() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#24130F_0%,#2C1712_45%,#1D100D_100%)] text-[#F5EBDD]">
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

        {/* KPI */}
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
                    <th className="px-5 py-4 text-left text-sm font-bold">Import inventaire</th>
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
                      <td className="border-t border-[#C4AA91] px-5 py-4 text-[#2B2623]">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
                            row.inventory === "Importé"
                              ? "border-[#9B6A39] bg-[#F3E6D7] text-[#6E4522]"
                              : row.inventory === "En attente"
                              ? "border-[#A14E3B] bg-[#F4DDD7] text-[#8A3526]"
                              : "border-[#B89E85] bg-[#EADBCB] text-[#7A685A]"
                          }`}
                        >
                          {row.inventory}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DROITE */}
          <aside className="space-y-6">
            {/* IMPORT DROPZONE */}
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
                    ou cliquer pour sélectionner un fichier
                  </p>

                  <button className="mt-5 rounded-2xl border border-[#A14E3B] bg-[#6E2F3A] px-4 py-3 text-sm font-bold text-[#FFF3E7] transition hover:bg-[#5D2530]">
                    Choisir un fichier
                  </button>
                </div>
              </div>
            </section>

            {/* REGLAGES RAPIDES = SAISIE */}
            <section className="overflow-hidden rounded-[28px] border border-[#6A4536] bg-[#2A1A15] shadow-[0_14px_32px_rgba(0,0,0,0.24)]">
              <div className="border-b border-[#50362C] bg-[#1B120F] px-6 py-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF3E7]">
                  Réglages rapides
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <input
                  defaultValue="25.5"
                  className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                />
                <input
                  placeholder="Objectif CA"
                  className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                />
                <input
                  placeholder="Prévision couverts"
                  className="w-full rounded-2xl border border-[#8D6954] bg-[#E7D6C3] px-4 py-3 text-sm text-[#2B2623] outline-none placeholder:text-[#7C6A5F] focus:border-[#A14E3B]"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
