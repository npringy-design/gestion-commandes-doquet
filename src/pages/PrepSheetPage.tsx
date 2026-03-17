import React, { useEffect, useMemo, useState } from "react"

type PrepRatioRow = {
  id: string
  name: string
  station: string
  importMapping?: string | null
  averageRatio?: number
  baseProduction?: string | null
  unitWeightGrams?: number | null
}

type PrepLineNeed = {
  id: string
  name: string
  station: string
  baseProduction?: string | null
  unitWeightGrams?: number | null
  averageRatio: number
  dailyCovers: number
  theoreticalNeedUnits: number
  toProduceUnits: number
}

type PrepBaseGroup = {
  baseName: string
  station: string
  children: PrepLineNeed[]
  theoreticalGrams: number
  theoreticalKg: number
  roundedKg: number
}

const STORAGE_KEY = "prep-ratios-v1"

function normalizeStation(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function roundUpToHalfKg(valueKg: number): number {
  if (!Number.isFinite(valueKg) || valueKg <= 0) return 0
  return Math.ceil(valueKg * 2) / 2
}

function buildPrepLineNeeds(rows: PrepRatioRow[], dailyCovers: number): PrepLineNeed[] {
  return rows.map((row) => {
    const ratio = Number(row.averageRatio ?? 0)
    const theoreticalNeedUnits = dailyCovers * ratio
    const toProduceUnits = Math.ceil(theoreticalNeedUnits)

    return {
      id: row.id,
      name: row.name,
      station: row.station,
      baseProduction: row.baseProduction ?? null,
      unitWeightGrams: row.unitWeightGrams ?? null,
      averageRatio: ratio,
      dailyCovers,
      theoreticalNeedUnits,
      toProduceUnits,
    }
  })
}

function buildPrepBaseGroups(lines: PrepLineNeed[]): PrepBaseGroup[] {
  const grouped = new Map<string, PrepBaseGroup>()

  for (const line of lines) {
    if (!line.baseProduction || !line.unitWeightGrams || line.unitWeightGrams <= 0) continue

    const key = `${normalizeStation(line.station)}__${line.baseProduction}`

    if (!grouped.has(key)) {
      grouped.set(key, {
        baseName: line.baseProduction,
        station: line.station,
        children: [],
        theoreticalGrams: 0,
        theoreticalKg: 0,
        roundedKg: 0,
      })
    }

    const group = grouped.get(key)!
    group.children.push(line)
    group.theoreticalGrams += line.toProduceUnits * line.unitWeightGrams
  }

  for (const group of grouped.values()) {
    group.theoreticalKg = group.theoreticalGrams / 1000
    group.roundedKg = roundUpToHalfKg(group.theoreticalKg)
  }

  return Array.from(grouped.values())
}

function buildStandaloneLines(lines: PrepLineNeed[]): PrepLineNeed[] {
  return lines.filter(
    (line) => !line.baseProduction || !line.unitWeightGrams || line.unitWeightGrams <= 0
  )
}

function formatKg(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} kg`
}

export default function PrepSheetPage() {
  const [rows, setRows] = useState<PrepRatioRow[]>([])
  const [dailyCovers, setDailyCovers] = useState<number>(90)
  const [activeStation, setActiveStation] = useState<string>("poste dessert")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setRows(parsed)
      }
    } catch {}
  }, [])

  const prepLineNeeds = useMemo(() => buildPrepLineNeeds(rows, dailyCovers), [rows, dailyCovers])
  const prepBaseGroups = useMemo(() => buildPrepBaseGroups(prepLineNeeds), [prepLineNeeds])
  const prepStandaloneLines = useMemo(() => buildStandaloneLines(prepLineNeeds), [prepLineNeeds])

  const stations = ["poste chaud", "poste entrée", "poste dessert", "décongélation"]

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Feuille de mise en place</h1>
              <p className="mt-1 text-sm text-stone-600">
                V1 test — regroupement par base de production avec arrondi à 0,5 kg supérieur.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-stone-500">Prévi couverts</div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={dailyCovers}
                  onChange={(e) => setDailyCovers(Number(e.target.value || 0))}
                  className="mt-1 w-28 rounded-xl border border-stone-300 bg-white px-3 py-2 text-center text-lg font-semibold text-stone-900"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {stations.map((station) => {
            const active = normalizeStation(activeStation) === normalizeStation(station)
            return (
              <button
                key={station}
                onClick={() => setActiveStation(station)}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
              >
                {station}
              </button>
            )
          })}
        </div>

        <section className="space-y-3">
          <div className="grid grid-cols-4 items-center gap-3 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
            <div>Production</div>
            <div>Besoin théo</div>
            <div>À produire</div>
            <div>Prévi couverts</div>
          </div>

          <div className="space-y-4">
            {prepBaseGroups
              .filter(
                (group) => normalizeStation(group.station) === normalizeStation(activeStation)
              )
              .map((group) => (
                <div
                  key={`${group.station}-${group.baseName}`}
                  className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm"
                >
                  <div className="grid grid-cols-4 items-center gap-3 border-b border-amber-200 bg-amber-100/70 px-4 py-3">
                    <div className="font-semibold text-stone-900">{group.baseName}</div>
                    <div className="text-sm font-medium text-stone-700">
                      {formatKg(group.theoreticalKg)}
                    </div>
                    <div className="text-sm font-semibold text-stone-900">
                      {formatKg(group.roundedKg)}
                    </div>
                    <div className="text-sm text-stone-700">{dailyCovers}</div>
                  </div>

                  <div className="divide-y divide-amber-100 bg-white/80">
                    {group.children.map((child) => (
                      <div
                        key={child.id}
                        className="grid grid-cols-4 items-center gap-3 px-4 py-2 text-sm"
                      >
                        <div className="pl-4 text-stone-800">— {child.name}</div>
                        <div className="text-stone-600">
                          {child.theoreticalNeedUnits.toFixed(1).replace(".", ",")}
                        </div>
                        <div className="font-medium text-stone-900">{child.toProduceUnits}</div>
                        <div className="text-stone-600">{dailyCovers}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {prepStandaloneLines
              .filter((line) => normalizeStation(line.station) === normalizeStation(activeStation))
              .map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-4 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="font-medium text-stone-900">{line.name}</div>
                  <div className="text-sm text-stone-700">
                    {line.theoreticalNeedUnits.toFixed(1).replace(".", ",")}
                  </div>
                  <div className="text-sm font-semibold text-stone-900">{line.toProduceUnits}</div>
                  <div className="text-sm text-stone-700">{dailyCovers}</div>
                </div>
              ))}

            {prepBaseGroups.filter(
              (group) => normalizeStation(group.station) === normalizeStation(activeStation)
            ).length === 0 &&
              prepStandaloneLines.filter(
                (line) => normalizeStation(line.station) === normalizeStation(activeStation)
              ).length === 0 && (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-stone-500">
                  Rien à afficher sur ce poste pour le moment.
                </div>
              )}
          </div>
        </section>
      </div>
    </div>
  )
}
