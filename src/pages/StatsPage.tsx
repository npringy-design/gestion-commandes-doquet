const months = [
  { name: "Janvier", value: "3956", active: false, imported: false },
  { name: "Février", value: "4863", active: false, imported: false },
  { name: "Mars", value: "4440", active: false, imported: false },
  { name: "Avril", value: "4239", active: true, imported: true },
  { name: "Mai", value: "4506", active: false, imported: false },
  { name: "Juin", value: "4002", active: false, imported: false },
  { name: "Juillet", value: "4493", active: false, imported: false },
  { name: "Août", value: "4604", active: false, imported: false },
  { name: "Septembre", value: "3470", active: false, imported: false },
  { name: "Octobre", value: "5082", active: false, imported: false },
  { name: "Novembre", value: "4694", active: false, imported: false },
  { name: "Décembre", value: "5989", active: false, imported: false },
];

function PanelColumn({
  title,
  headerClass,
  bodyClass,
  rowClass,
  monthTextClass,
  valueClass,
  iconMode = false,
}: {
  title: string;
  headerClass: string;
  bodyClass: string;
  rowClass: string;
  monthTextClass: string;
  valueClass?: string;
  iconMode?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-[26px] border border-[#6B4A3A] shadow-[0_12px_28px_rgba(0,0,0,0.22)] ${bodyClass}`}>
      <div className={`px-6 py-5 text-center border-b border-black/10 ${headerClass}`}>
        <h2 className="text-[22px] font-black uppercase tracking-[0.08em]">
          {title}
        </h2>
      </div>

      <div>
        {months.map((month) => (
          <div
            key={month.name}
            className={`flex items-center justify-between px-5 py-3 border-b border-black/10 transition ${rowClass} ${
              month.active ? "relative z-10 ring-1 ring-inset ring-[#A14E3B]/40" : ""
            }`}
          >
            <span className={`text-[17px] font-extrabold uppercase ${monthTextClass}`}>
              {month.name}
            </span>

            {iconMode ? (
              <button
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-[26px] leading-none font-medium transition ${
                  month.active
                    ? "border-[#7A3A1E] bg-[#D8891C] text-[#4A230E] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                    : "border-[#C49A72] bg-[#EBC9A5] text-[#B27A48]"
                }`}
              >
                +
              </button>
            ) : (
              <div className={valueClass}>
                {month.value}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ParametresColumnsOnly() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#2A120C_0%,#34160F_45%,#24110D_100%)] px-5 py-6">
      <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        <PanelColumn
          title="Inventaire détaillé"
          headerClass="bg-[linear-gradient(180deg,#C88B4D_0%,#B87437_100%)] text-[#4E250D]"
          bodyClass="bg-[#E7BE94]"
          rowClass="bg-[#EBC69F] hover:bg-[#E4BA8D]"
          monthTextClass="text-[#6A3200]"
          iconMode
        />

        <PanelColumn
          title="Couverts réalisés"
          headerClass="bg-[linear-gradient(180deg,#D9B34C_0%,#C89927_100%)] text-[#5B4300]"
          bodyClass="bg-[#ECDDAB]"
          rowClass="bg-[#EFE3BA] hover:bg-[#E6D7A4]"
          monthTextClass="text-[#6E5200]"
          valueClass="min-w-[116px] rounded-[15px] border-2 border-[#B88A14] bg-[#F5F0E3] px-4 py-1.5 text-center text-[19px] font-black text-[#6E5200] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        />

        <PanelColumn
          title="CM (%)"
          headerClass="bg-[linear-gradient(180deg,#B56567_0%,#934648_100%)] text-[#FFF1F1]"
          bodyClass="bg-[#E7D0D0]"
          rowClass="bg-[#EEDDDD] hover:bg-[#E7D2D2]"
          monthTextClass="text-[#7E2327]"
          valueClass="min-w-[116px] rounded-[15px] border-2 border-[#C85B62] bg-[#F7F1F1] px-4 py-1.5 text-center text-[19px] font-black text-[#8A1F23] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        />

        <PanelColumn
          title="CA HT (€)"
          headerClass="bg-[linear-gradient(180deg,#879BB5_0%,#6D829D_100%)] text-[#F5F8FC]"
          bodyClass="bg-[#C9D4E3]"
          rowClass="bg-[#D8E1ED] hover:bg-[#CDD8E7]"
          monthTextClass="text-[#163E66]"
          valueClass="min-w-[116px] rounded-[15px] border-2 border-[#6F99C7] bg-[#EEF4FA] px-4 py-1.5 text-center text-[19px] font-black text-[#0E487E] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        />
      </div>
    </div>
  );
}
