export default function ParametresPage() {
  const months = [
    {
      month: "Janvier",
      ca: "125 400 €",
      cm: "29,4 %",
      covers: "4 820",
      inventory: "Importé",
      status: "ok",
    },
    {
      month: "Février",
      ca: "118 900 €",
      cm: "30,1 %",
      covers: "4 560",
      inventory: "Importé",
      status: "ok",
    },
    {
      month: "Mars",
      ca: "132 700 €",
      cm: "28,7 %",
      covers: "5 040",
      inventory: "En attente",
      status: "pending",
    },
    {
      month: "Avril",
      ca: "127 300 €",
      cm: "29,0 %",
      covers: "4 910",
      inventory: "Importé",
      status: "ok",
    },
  ];

  return (
    <div className="min-h-screen bg-[#241D1A] text-[#F2E7DA]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-[#5A3A2A] bg-[linear-gradient(135deg,#1F1815_0%,#2B211D_55%,#3A241E_100%)] shadow-[0_20px_50px_rgba(0,0,0,0.30)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#7A5330] via-[#A14E3B] to-[#7B2332]" />
          <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C8B29D]">
                Hippopotamus Thillois
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#F7EFE5]">
                Paramètres mensuels
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#D7C3B0]">
                Pilotage mensuel des indicateurs clés et suivi des imports inventaires.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl border border-[#8E2E3C] bg-[#7B2332] px-5 py-3 text-sm font-semibold text-[#FFF7EF] transition hover:bg-[#681D2A]">
                Enregistrer
              </button>
              <button className="rounded-2xl border border-[#7A5330] bg-[#3A302B] px-5 py-3 text-sm font-semibold text-[#F2E7DA] transition hover:bg-[#4A3B34]">
                Annuler
              </button>
            </div>
          </div>
        </section>

        {/* KPI TOP */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["CA annuel cumulé", "504 300 €", "#A14E3B"],
            ["CM moyen", "29,3 %", "#7B2332"],
            ["Couverts cumulés", "19 330", "#7A5330"],
            ["Imports inventaires", "3 / 4 validés", "#8E6A45"],
          ].map(([label, value, accent]) => (
            <div
              key={label}
              className="overflow-hidden rounded-2xl border border-[#5B463B] bg-[#2E2622] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
            >
              <div className="h-1.5" style={{ backgroundColor: accent }} />
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-[#BFA895]">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-bold text-[#F7EFE5]">{value}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
          {/* GAUCHE */}
          <div className="space-y-6">
            {/* BLOC TABLEAU MENSUEL */}
            <section className="overflow-hidden rounded-3xl border border-[#5B463B] bg-[#2E2622] shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <div className="flex items-center justify-between border-b border-[#4A3A32] bg-[#1F1815] px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-[#F7EFE5]">
                    Pilotage mensuel
                  </h2>
                  <p className="mt-1 text-sm text-[#BFA895]">
                    CA, CM, couverts et statut d’import par mois
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#3A302B] text-[#F2E7DA]">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-semibold">Mois</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">CA</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">CM</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">Couverts</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold">Import inventaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((item, index) => (
                      <tr
                        key={item.month}
                        className={
                          index % 2 === 0
                            ? "bg-[#E7D8C7] text-[#2B2623]"
                            : "bg-[#DDCBB8] text-[#2B2623]"
                        }
                      >
                        <td className="border-t border-[#C7AE98] px-5 py-4 font-semibold">
                          {item.month}
                        </td>
                        <td className="border-t border-[#C7AE98] px-5 py-4">{item.ca}</td>
                        <td className="border-t border-[#C7AE98] px-5 py-4">{item.cm}</td>
                        <td className="border-t border-[#C7AE98] px-5 py-4">{item.covers}</td>
                        <td className="border-t border-[#C7AE98] px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              item.status === "ok"
                                ? "bg-[#6E8B5B]/20 text-[#3F5C30] ring-1 ring-[#6E8B5B]/40"
                                : "bg-[#A14E3B]/15 text-[#7A2F20] ring-1 ring-[#A14E3B]/30"
                            }`}
                          >
                            {item.inventory}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* BLOC PARAMETRES DE SAISIE */}
            <section className="overflow-hidden rounded-3xl border border-[#5B463B] bg-[#2E2622] shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <div className="border-b border-[#4A3A32] bg-[#1F1815] px-6 py-4">
                <h2 className="text-lg font-bold text-[#F7EFE5]">
                  Réglages du mois
                </h2>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#E6D6C6]">
                    Mois sélectionné
                  </label>
                  <select className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] outline-none transition focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20">
                    <option>Janvier</option>
                    <option>Février</option>
                    <option>Mars</option>
                    <option>Avril</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#E6D6C6]">
                    Objectif CM
                  </label>
                  <input
                    className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] outline-none transition placeholder:text-[#8A786D] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                    placeholder="Ex : 29.00"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#E6D6C6]">
                    Objectif CA
                  </label>
                  <input
                    className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] outline-none transition placeholder:text-[#8A786D] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                    placeholder="Ex : 130000"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#E6D6C6]">
                    Prévision couverts
                  </label>
                  <input
                    className="w-full rounded-2xl border border-[#7A5A47] bg-[#E7D8C7] px-4 py-3 text-sm text-[#2B2623] outline-none transition placeholder:text-[#8A786D] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                    placeholder="Ex : 5000"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* DROITE */}
          <aside className="space-y-6">
            {/* IMPORT INVENTAIRE */}
            <section className="overflow-hidden rounded-3xl border border-[#5B463B] bg-[#2E2622] shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <div className="border-b border-[#4A3A32] bg-[#1F1815] px-6 py-4">
                <h2 className="text-lg font-bold text-[#F7EFE5]">
                  Import inventaire
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-[#6E5446] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7A5E4B]">
                    Mois en cours
                  </p>
                  <p className="mt-2 text-xl font-bold">Mars</p>
                </div>

                <div className="rounded-2xl border border-[#6E5446] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7A5E4B]">
                    Statut
                  </p>
                  <p className="mt-2 text-xl font-bold text-[#7A2F20]">
                    En attente d’import
                  </p>
                </div>

                <button className="w-full rounded-2xl border border-[#8E2E3C] bg-[#7B2332] px-4 py-3 text-sm font-semibold text-[#FFF7EF] transition hover:bg-[#681D2A]">
                  Lancer l’import
                </button>
              </div>
            </section>

            {/* RESUME */}
            <section className="overflow-hidden rounded-3xl border border-[#5B463B] bg-[#2E2622] shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <div className="border-b border-[#4A3A32] bg-[#1F1815] px-6 py-4">
                <h2 className="text-lg font-bold text-[#F7EFE5]">
                  Résumé rapide
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-[#6E5446] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7A5E4B]">
                    Dernière mise à jour
                  </p>
                  <p className="mt-2 text-lg font-bold">Aujourd’hui</p>
                </div>

                <div className="rounded-2xl border border-[#6E5446] bg-[#E7D8C7] p-4 text-[#2B2623]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7A5E4B]">
                    Lecture
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    Vision mensuelle du pilotage
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
