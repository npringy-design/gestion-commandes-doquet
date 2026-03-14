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
  return (
    <div className="min-h-screen bg-[#241914] text-[#F4EBDD]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* HEADER */}
        <section className="mb-6 overflow-hidden rounded-[28px] border border-[#5B3A2E] bg-[linear-gradient(135deg,#1C1411_0%,#2B1D18_60%,#3A241D_100%)] shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
          <div className="h-1.5 bg-gradient-to-r from-[#7A5330] via-[#A14E3B] to-[#6E2F3A]" />
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#C9B29D]">
                Hippopotamus Thillois
              </p>
              <h1 className="mt-2 text-3xl font-black text-[#FFF4E8]">
                Paramètres
              </h1>
              <p className="mt-2 text-sm text-[#D2BDAA]">
                Pilotage mensuel des données de référence
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <select className="rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm font-semibold text-[#2B2623] outline-none">
                <option>Avril</option>
                <option>Mai</option>
                <option>Juin</option>
              </select>

              <button className="rounded-2xl border border-[#8B3240] bg-[#6E2F3A] px-5 py-3 text-sm font-bold text-[#FFF4E8]">
                Enregistrer
              </button>
            </div>
          </div>
        </section>

        {/* KPI */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-[#6A4A3A] bg-[#2E211B] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#C9B29D]">CA mensuel</p>
            <p className="mt-3 text-3xl font-black text-[#FFF4E8]">127 300 €</p>
          </div>

          <div className="rounded-[24px] border border-[#6A4A3A] bg-[#2E211B] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#C9B29D]">CM mensuel</p>
            <p className="mt-3 text-3xl font-black text-[#FFF4E8]">29.0 %</p>
          </div>

          <div className="rounded-[24px] border border-[#6A4A3A] bg-[#2E211B] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#C9B29D]">Couverts</p>
            <p className="mt-3 text-3xl font-black text-[#FFF4E8]">4 910</p>
          </div>

          <div className="rounded-[24px] border border-[#6A4A3A] bg-[#2E211B] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#C9B29D]">Import inventaire</p>
            <p className="mt-3 text-2xl font-black text-[#D89B57]">Importé</p>
          </div>
        </section>

        {/* MAIN */}
        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
          {/* TABLEAU */}
          <section className="overflow-hidden rounded-[28px] border border-[#6A4A3A] bg-[#2A1D18] shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
            <div className="border-b border-[#4F392F] bg-[#1E1613] px-6 py-4">
              <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF4E8]">
                Suivi mensuel
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#3B2B24] text-[#F5EBDD]">
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
                      className={index % 2 === 0 ? "bg-[#E7D8C7]" : "bg-[#DDCCBA]"}
                    >
                      <td className="border-t border-[#C6AF98] px-5 py-4 font-bold text-[#2B2623]">
                        {row.month}
                      </td>
                      <td className="border-t border-[#C6AF98] px-5 py-4 text-[#2B2623]">
                        {row.ca}
                      </td>
                      <td className="border-t border-[#C6AF98] px-5 py-4 text-[#2B2623]">
                        {row.cm}
                      </td>
                      <td className="border-t border-[#C6AF98] px-5 py-4 text-[#2B2623]">
                        {row.covers}
                      </td>
                      <td className="border-t border-[#C6AF98] px-5 py-4 text-[#2B2623]">
                        <span className="inline-flex rounded-full border border-[#A87A4C] bg-[#F0E1CF] px-3 py-1 text-xs font-bold">
                          {row.inventory}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* PANNEAU DROIT */}
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-[#6A4A3A] bg-[#2A1D18] shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[#4F392F] bg-[#1E1613] px-6 py-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF4E8]">
                  Import inventaire
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7A6250]">Mois sélectionné</p>
                  <p className="mt-2 text-lg font-black">Avril</p>
                </div>

                <div className="rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7A6250]">Statut</p>
                  <p className="mt-2 text-lg font-black">Importé</p>
                </div>

                <button className="w-full rounded-2xl border border-[#8B3240] bg-[#6E2F3A] px-4 py-3 text-sm font-bold text-[#FFF4E8]">
                  Lancer l’import
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#6A4A3A] bg-[#2A1D18] shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[#4F392F] bg-[#1E1613] px-6 py-4">
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF4E8]">
                  Réglages rapides
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <input
                  placeholder="Objectif CM"
                  className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] placeholder:text-[#7E6B5F]"
                />
                <input
                  placeholder="Objectif CA"
                  className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] placeholder:text-[#7E6B5F]"
                />
                <input
                  placeholder="Prévision couverts"
                  className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] placeholder:text-[#7E6B5F]"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
