import { useRef, useState } from "react";

type MonthRow = {
  month: string;
  ca: string;
  cm: string;
  covers: string;
  inventory: "Importé" | "En attente" | "-";
};

const initialData: MonthRow[] = [
  { month: "Janvier", ca: "125400", cm: "29.4", covers: "4820", inventory: "Importé" },
  { month: "Février", ca: "118900", cm: "30.1", covers: "4560", inventory: "Importé" },
  { month: "Mars", ca: "132700", cm: "28.7", covers: "5040", inventory: "En attente" },
  { month: "Avril", ca: "127300", cm: "29.0", covers: "4910", inventory: "Importé" },
  { month: "Mai", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Juin", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Juillet", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Août", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Septembre", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Octobre", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Novembre", ca: "", cm: "", covers: "", inventory: "-" },
  { month: "Décembre", ca: "", cm: "", covers: "", inventory: "-" },
];

export default function ParametresPage() {
  const [rows, setRows] = useState(initialData);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateField = (
    month: string,
    field: "ca" | "cm" | "covers",
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.month === month ? { ...row, [field]: value } : row
      )
    );
  };

  const openImportModal = (month: string) => {
    setSelectedMonth(month);
    setSelectedFileName("");
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setSelectedMonth(null);
    setDragActive(false);
    setSelectedFileName("");
  };

  const handleSelectedFile = (file?: File | null) => {
    if (!file) return;
    setSelectedFileName(file.name);
  };

  const validateImport = () => {
    if (!selectedMonth || !selectedFileName) return;

    setRows((prev) =>
      prev.map((row) =>
        row.month === selectedMonth ? { ...row, inventory: "Importé" } : row
      )
    );

    closeImportModal();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#24130F_0%,#2B1712_45%,#1D100D_100%)] text-[#F5EBDD]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* HEADER SIMPLIFIÉ */}
        <section className="mb-6 overflow-hidden rounded-[28px] border border-[#694334] bg-[linear-gradient(135deg,#1A120F_0%,#2A1914_55%,#3A211A_100%)] shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
          <div className="h-1.5 bg-gradient-to-r from-[#7A4B2D] via-[#A14E3B] to-[#6E2F3A]" />
          <div className="px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#CCB39B]">
              Hippopotamus Thillois
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#FFF3E7]">
              Paramètres
            </h1>
          </div>
        </section>

        {/* TABLEAU + RIEN D'AUTRE À DROITE */}
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
                {rows.map((row, index) => (
                  <tr
                    key={row.month}
                    className={index % 2 === 0 ? "bg-[#E6D5C2]" : "bg-[#DDCAB6]"}
                  >
                    <td className="border-t border-[#C4AA91] px-5 py-4 font-bold text-[#2B2623]">
                      {row.month}
                    </td>

                    {/* ZONES DE SAISIE */}
                    <td className="border-t border-[#C4AA91] px-5 py-3">
                      <input
                        value={row.ca}
                        onChange={(e) => updateField(row.month, "ca", e.target.value)}
                        placeholder="CA"
                        className="w-full min-w-[120px] rounded-xl border border-[#B79070] bg-[#F3E8DB] px-3 py-2 text-sm font-semibold text-[#2B2623] outline-none transition placeholder:text-[#8A7769] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                      />
                    </td>

                    <td className="border-t border-[#C4AA91] px-5 py-3">
                      <input
                        value={row.cm}
                        onChange={(e) => updateField(row.month, "cm", e.target.value)}
                        placeholder="CM"
                        className="w-full min-w-[90px] rounded-xl border border-[#B79070] bg-[#F3E8DB] px-3 py-2 text-sm font-semibold text-[#2B2623] outline-none transition placeholder:text-[#8A7769] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                      />
                    </td>

                    <td className="border-t border-[#C4AA91] px-5 py-3">
                      <input
                        value={row.covers}
                        onChange={(e) => updateField(row.month, "covers", e.target.value)}
                        placeholder="Couverts"
                        className="w-full min-w-[100px] rounded-xl border border-[#B79070] bg-[#F3E8DB] px-3 py-2 text-sm font-semibold text-[#2B2623] outline-none transition placeholder:text-[#8A7769] focus:border-[#A14E3B] focus:ring-2 focus:ring-[#A14E3B]/20"
                      />
                    </td>

                    {/* IMPORT DANS LE TABLEAU */}
                    <td className="border-t border-[#C4AA91] px-5 py-4">
                      <button
                        onClick={() => openImportModal(row.month)}
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                          row.inventory === "Importé"
                            ? "border-[#9B6A39] bg-[#F3E6D7] text-[#6E4522] hover:bg-[#EEDCC8]"
                            : row.inventory === "En attente"
                            ? "border-[#A14E3B] bg-[#F4DDD7] text-[#8A3526] hover:bg-[#F0D2CA]"
                            : "border-[#B89E85] bg-[#EADBCB] text-[#7A685A] hover:bg-[#E3D2C0]"
                        }`}
                      >
                        {row.inventory === "-" ? "Importer" : row.inventory}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* MODAL IMPORT */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#6A4536] bg-[#2A1A15] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-[#50362C] bg-[#1B120F] px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#FFF3E7]">
                    Import inventaire
                  </h2>
                  <p className="mt-1 text-sm text-[#D6BFA9]">
                    {selectedMonth ? `Mois sélectionné : ${selectedMonth}` : ""}
                  </p>
                </div>

                <button
                  onClick={closeImportModal}
                  className="rounded-xl border border-[#7E5A48] bg-[#3A241D] px-3 py-2 text-sm font-bold text-[#FFF3E7] hover:bg-[#4A2D24]"
                >
                  Fermer
                </button>
              </div>
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
                  handleSelectedFile(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-[24px] border-2 border-dashed px-6 py-12 text-center transition ${
                  dragActive
                    ? "border-[#A14E3B] bg-[#3A211A]"
                    : "border-[#9C6B4E] bg-[#33211B]"
                }`}
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#6E2F3A] text-2xl text-[#FFF3E7]">
                  ⤴
                </div>

                <p className="text-lg font-bold text-[#FFF3E7]">
                  Déposer le fichier ici
                </p>
                <p className="mt-2 text-sm text-[#D6BFA9]">
                  ou cliquer pour sélectionner un fichier
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleSelectedFile(e.target.files?.[0])}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 rounded-2xl border border-[#A14E3B] bg-[#6E2F3A] px-4 py-3 text-sm font-bold text-[#FFF3E7] transition hover:bg-[#5D2530]"
                >
                  Choisir un fichier
                </button>

                {selectedFileName && (
                  <div className="mt-5 rounded-2xl border border-[#7E5A48] bg-[#E7D6C3] px-4 py-3 text-sm font-semibold text-[#2B2623]">
                    Fichier sélectionné : {selectedFileName}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeImportModal}
                  className="rounded-2xl border border-[#7E5A48] bg-[#3A241D] px-4 py-3 text-sm font-bold text-[#FFF3E7] hover:bg-[#4A2D24]"
                >
                  Annuler
                </button>

                <button
                  onClick={validateImport}
                  disabled={!selectedFileName}
                  className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                    selectedFileName
                      ? "border border-[#A14E3B] bg-[#6E2F3A] text-[#FFF3E7] hover:bg-[#5D2530]"
                      : "cursor-not-allowed border border-[#6B5A50] bg-[#5A4A43] text-[#C8B7AA]"
                  }`}
                >
                  Valider l’import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
