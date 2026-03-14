export default function ParametresPage() {
  return (
    <div className="min-h-screen bg-[#F4EEE6] text-[#2B2623]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#4A3F39] bg-[#1F1A17] shadow-[0_10px_30px_rgba(31,26,23,0.18)]">
          <div className="h-1 w-full bg-gradient-to-r from-[#8C4334] via-[#B88A52] to-[#6E2F3A]" />
          <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#CFC1B2]">
                Hippopotamus Thillois
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#F7F1E8]">
                Paramètres
              </h1>
              <p className="mt-1 text-sm text-[#CFC1B2]">
                Configuration générale et repères de pilotage
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-xl border border-[#7A332B] bg-[#6E2F3A] px-4 py-2 text-sm font-semibold text-[#F7F1E8] transition hover:bg-[#5C2630]">
                Enregistrer
              </button>
              <button className="rounded-xl border border-[#8D8178] bg-[#EFE5D8] px-4 py-2 text-sm font-semibold text-[#2B2623] transition hover:bg-[#E5D7C6]">
                Annuler
              </button>
            </div>
          </div>
        </div>

        {/* CARTES RAPIDES */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Paramètres globaux", "Réglages principaux"],
            ["Imports liés", "Sources et dépendances"],
            ["Pilotage", "Valeurs et repères"],
            ["Contrôle", "Vérifications rapides"],
          ].map(([title, subtitle]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] p-4 shadow-[0_6px_18px_rgba(60,40,20,0.06)]"
            >
              <div className="mb-3 h-1 w-14 rounded-full bg-[#8C4334]" />
              <h2 className="text-sm font-bold text-[#2B2623]">{title}</h2>
              <p className="mt-1 text-sm text-[#6F625A]">{subtitle}</p>
            </div>
          ))}
        </div>

        {/* LAYOUT PRINCIPAL */}
        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          {/* COLONNE GAUCHE */}
          <div className="space-y-6">
            {/* SECTION 1 */}
            <section className="overflow-hidden rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] shadow-[0_6px_18px_rgba(60,40,20,0.06)]">
              <div className="border-b border-[#4A3F39] bg-[#2B2623] px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F7F1E8]">
                  Paramètres principaux
                </h3>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Nom du site
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="Ex : Hippo Thillois"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Mois actif
                  </label>
                  <select className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20">
                    <option>Janvier</option>
                    <option>Février</option>
                    <option>Mars</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Objectif CM
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="Ex : 28.50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Couvert moyen
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="Ex : 145"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 2 */}
            <section className="overflow-hidden rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] shadow-[0_6px_18px_rgba(60,40,20,0.06)]">
              <div className="border-b border-[#4A3F39] bg-[#2B2623] px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F7F1E8]">
                  Réglages secondaires
                </h3>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Valeur 1
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Valeur 2
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#3A312D]">
                    Commentaire / note
                  </label>
                  <textarea
                    rows={4}
                    className="w-full rounded-xl border border-[#BDAA96] bg-[#FFFBF6] px-4 py-3 text-sm outline-none transition focus:border-[#8C4334] focus:ring-2 focus:ring-[#8C4334]/20"
                    placeholder="..."
                  />
                </div>
              </div>
            </section>

            {/* SECTION TABLEAU / LISTE */}
            <section className="overflow-hidden rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] shadow-[0_6px_18px_rgba(60,40,20,0.06)]">
              <div className="border-b border-[#4A3F39] bg-[#2B2623] px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F7F1E8]">
                  Tableau de paramètres
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#3A312D] text-[#F7F1E8]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Nom</th>
                      <th className="px-4 py-3 text-left font-semibold">Valeur</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((row, index) => (
                      <tr
                        key={row}
                        className={index % 2 === 0 ? "bg-[#FFFBF6]" : "bg-[#F6EFE7]"}
                      >
                        <td className="px-4 py-3 border-t border-[#E2D4C6]">Paramètre {row}</td>
                        <td className="px-4 py-3 border-t border-[#E2D4C6]">Valeur</td>
                        <td className="px-4 py-3 border-t border-[#E2D4C6] text-[#6F625A]">
                          Texte
                        </td>
                        <td className="px-4 py-3 border-t border-[#E2D4C6]">
                          <button className="rounded-lg border border-[#BDAA96] bg-[#EFE5D8] px-3 py-1.5 text-xs font-semibold text-[#2B2623] hover:bg-[#E5D7C6]">
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* COLONNE DROITE */}
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] shadow-[0_6px_18px_rgba(60,40,20,0.06)]">
              <div className="border-b border-[#4A3F39] bg-[#2B2623] px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F7F1E8]">
                  Résumé
                </h3>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-[#D8C7B6] bg-[#FFFBF6] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8D8178]">
                    Statut
                  </p>
                  <p className="mt-2 text-lg font-bold text-[#2B2623]">Configuration stable</p>
                </div>

                <div className="rounded-xl border border-[#D8C7B6] bg-[#FFFBF6] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8D8178]">
                    Dernière mise à jour
                  </p>
                  <p className="mt-2 text-lg font-bold text-[#2B2623]">Aujourd’hui</p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#C9B8A6] bg-[#FBF7F2] shadow-[0_6px_18px_rgba(60,40,20,0.06)]">
              <div className="border-b border-[#4A3F39] bg-[#2B2623] px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#F7F1E8]">
                  Aide
                </h3>
              </div>

              <div className="p-5">
                <div className="rounded-xl border border-[#D8C7B6] bg-[#FFFBF6] p-4 text-sm text-[#5E534C]">
                  Garde ici tes textes d’aide, rappels métier ou infos utiles.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
