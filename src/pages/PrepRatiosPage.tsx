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

const STORAGE_KEY = "prep-ratios-v1"

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function defaultRows(): PrepRatioRow[] {
  return [
    {
      id: uid(),
      name: "Mousse carte",
      station: "poste dessert",
      importMapping: "Mousse chocolat",
      averageRatio: 0.08,
      baseProduction: "Base mousse",
      unitWeightGrams: 100,
    },
    {
      id: uid(),
      name: "Mousse menu",
      station: "poste dessert",
      importMapping: "Mousse menu",
      averageRatio: 0.05,
      baseProduction: "Base mousse",
      unitWeightGrams: 80,
    },
    {
      id: uid(),
      name: "Mousse kids",
      station: "poste dessert",
      importMapping: "Mousse kids",
      averageRatio: 0.04,
      baseProduction: "Base mousse",
      unitWeightGrams: 60,
    },
    {
      id: uid(),
      name: "Mini mousse café",
      station: "poste dessert",
      importMapping: "Mini mousse",
      averageRatio: 0.1,
      baseProduction: "Base mousse",
      unitWeightGrams: 40,
    },
  ]
}

export default function PrepRatiosPage() {
  const [rows, setRows] = useState<PrepRatioRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRows(parsed)
        } else {
          setRows(defaultRows())
        }
      } else {
        setRows(defaultRows())
      }
    } catch {
      setRows(defaultRows())
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  }, [rows, loaded])

  const updateRow = (id: string, patch: Partial<PrepRatioRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        name: "",
        station: "poste dessert",
        importMapping: null,
        averageRatio: 0,
        baseProduction: null,
        unitWeightGrams: null,
      },
    ])
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  const groupedPreview = useMemo(() => {
    const map = new Map<string, { count: number; totalWeight: number }>()
    for (const row of rows) {
      if (!row.baseProduction || !row.unitWeightGrams) continue
      const current = map.get(row.baseProduction) ?? { count: 0, totalWeight: 0 }
      current.count += 1
      current.totalWeight += Number(row.unitWeightGrams || 0)
      map.set(row.baseProduction, current)
    }
    return Array.from(map.entries())
  }, [rows])

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Calcul prod ratio</h1>
              <p className="mt-1 text-sm text-stone-600">
                V1 test — ajout de la logique Base production + Poids unitaire.
              </p>
            </div>

            <button
              onClick={addRow}
              className="rounded-2xl border border-stone-300 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Ajouter une production
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Production</th>
                  <th className="px-3 py-3 text-left font-semibold">Poste</th>
                  <th className="px-3 py-3 text-left font-semibold">Mapping import</th>
                  <th className="px-3 py-3 text-left font-semibold">Base production</th>
                  <th className="px-3 py-3 text-left font-semibold">Poids unitaire (g)</th>
                  <th className="px-3 py-3 text-left font-semibold">Ratio moyen</th>
                  <th className="px-3 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-stone-200">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Nom production"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <select
                        value={row.station}
                        onChange={(e) => updateRow(row.id, { station: e.target.value })}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      >
                        <option value="poste chaud">Poste chaud</option>
                        <option value="poste entrée">Poste entrée</option>
                        <option value="poste dessert">Poste dessert</option>
                        <option value="décongélation">Décongélation</option>
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.importMapping ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            importMapping: e.target.value.trim() === "" ? null : e.target.value,
                          })
                        }
                        placeholder="Ligne d'import"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.baseProduction ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            baseProduction: e.target.value.trim() === "" ? null : e.target.value,
                          })
                        }
                        placeholder="Ex: Base mousse"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.unitWeightGrams ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            unitWeightGrams: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="100"
                        className="w-28 rounded-xl border border-stone-300 bg-white px-3 py-2 text-center"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={row.averageRatio ?? 0}
                        onChange={(e) =>
                          updateRow(row.id, {
                            averageRatio: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className="w-28 rounded-xl border border-stone-300 bg-white px-3 py-2 text-center"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                      Aucune ligne pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">Aperçu des bases détectées</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groupedPreview.map(([baseName, info]) => (
              <div
                key={baseName}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div className="font-semibold text-stone-900">{baseName}</div>
                <div className="mt-1 text-sm text-stone-700">{info.count} déclinaison(s)</div>
                <div className="text-sm text-stone-700">
                  Total poids référencé : {info.totalWeight} g
                </div>
              </div>
            ))}

            {groupedPreview.length === 0 && (
              <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                Aucune base production renseignée.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
