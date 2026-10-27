import { useMemo, useState } from "react";
import type { PasswordEntry } from "../types";
import { calculatePasswordHealth, type EntryHealth } from "../security/health";

interface VaultGardenProps {
  entries: PasswordEntry[];
  onSelect: (entry: PasswordEntry) => void;
}

type Growth = "bloom" | "bud" | "seed";
interface GardenPlantData { entry: PasswordEntry; health: EntryHealth; growth: Growth }
type Filter = "all" | "care" | "healthy";

function getGrowth(health: EntryHealth): Growth {
  return health.overall === "SOG'LOM" ? "bloom" : health.overall === "DIQQAT" ? "bud" : "seed";
}

function GardenPlant({ plant, selected, onSelect }: { plant: GardenPlantData; selected: boolean; onSelect: () => void }) {
  const { entry, growth, health } = plant;
  const stateLabel = growth === "bloom" ? "Gullagan" : growth === "bud" ? "Parvarish kerak" : "E’tibor zarur";
  return (
    <button
      className={`garden-plant ${growth}${selected ? " selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={health.reasons.join(" ") || `${entry.website}: ${stateLabel}`}
    >
      <svg className="plant-art" viewBox="0 0 90 112" role="img" aria-label={`${entry.website}: ${stateLabel}`}>
        <ellipse className="plant-ground" cx="45" cy="101" rx="34" ry="6" />
        <path className="plant-stem" d={growth === "seed" ? "M45 94 Q49 84 45 77" : growth === "bud" ? "M45 94 Q39 78 45 58" : "M45 94 Q38 73 45 44"} />
        {growth !== "seed" && <>
          <path className="plant-leaf" d="M43 82 Q22 83 28 68 Q41 68 43 82Z" />
          <path className="plant-leaf" d="M44 73 Q63 73 61 59 Q48 59 44 73Z" />
        </>}
        {growth === "seed" && <ellipse className="plant-seed" cx="45" cy="76" rx="7" ry="10" />}
        {growth === "bud" && <>
          <ellipse className="plant-bud" cx="45" cy="54" rx="8" ry="12" />
          <path className="plant-bud-cap" d="M38 54 Q45 46 52 54 Q45 61 38 54Z" />
        </>}
        {growth === "bloom" && <>
          {[0, 60, 120, 180, 240, 300].map((angle) => <ellipse key={angle} className="plant-petal" cx="45" cy="34" rx="5.5" ry="9" transform={`rotate(${angle} 45 44)`} />)}
          <circle className="plant-center" cx="45" cy="44" r="6" />
        </>}
      </svg>
      <span className="plant-site" title={entry.website}>{entry.website}</span>
      <span className="plant-status">{stateLabel} · {health.strength}%</span>
    </button>
  );
}

function HealthMeter({ label, value }: { label: string; value: number }) {
  return <div className="garden-meter">
    <div><span>{label}</span><b>{value}%</b></div>
    <span className="garden-meter-track"><i style={{ width: `${value}%` }} /></span>
  </div>;
}

export function VaultGarden({ entries, onSelect }: VaultGardenProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"needs-care" | "name">("needs-care");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const plants = useMemo(() => entries.map((entry) => {
    const health = calculatePasswordHealth(entry, entries);
    return { entry, health, growth: getGrowth(health) };
  }), [entries]);
  const healthyCount = plants.filter(({ growth }) => growth === "bloom").length;
  const filteredPlants = plants
    .filter(({ entry, growth }) => (filter === "all" || (filter === "care" ? growth !== "bloom" : growth === "bloom"))
      && (!query.trim() || `${entry.website} ${entry.username}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
    .sort((left, right) => sortBy === "name"
      ? left.entry.website.localeCompare(right.entry.website)
      : ({ seed: 0, bud: 1, bloom: 2 }[left.growth] - { seed: 0, bud: 1, bloom: 2 }[right.growth])
        || left.health.strength - right.health.strength
        || left.entry.website.localeCompare(right.entry.website));
  const selected = filteredPlants.find(({ entry }) => entry.id === selectedId) ?? filteredPlants[0] ?? null;
  const attentionCount = plants.length - healthyCount;

  return (
    <section className="vault-garden" aria-labelledby="garden-title">
      <header className="garden-header">
        <div>
          <p className="eyebrow">SecurePass maxfiy bog‘i</p>
          <h1 id="garden-title">Parol bog‘i</h1>
          <p className="garden-intro">Kuchli va noyob parol gullaydi. Har bir nihol parvarishga loyiq.</p>
        </div>
        <div className="garden-summary" aria-label="Bog‘ holati">
          <strong>{healthyCount}/{entries.length}</strong>
          <span>gullagan</span>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="garden-empty"><span aria-hidden="true">🌱</span><h2>Bog‘ingizga birinchi niholni eking</h2><p>Parol qo‘shsangiz, uning holati shu yerda o‘simlik sifatida ko‘rinadi.</p></div>
      ) : <>
        <div className="garden-legend"><span><i className="legend-bloom" /> Gullagan — sog‘lom</span><span><i className="legend-bud" /> Kurtak — tekshirish kerak</span><span><i className="legend-seed" /> Urug‘ — xavfli</span></div>
        <div className="garden-controls">
          <label className="garden-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sayt yoki loginni qidirish" aria-label="Bog‘dan qidirish" /></label>
          <label className="garden-sort">Saralash
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "needs-care" | "name")}>
              <option value="needs-care">Parvarish keraklari avval</option>
              <option value="name">Sayt nomi bo‘yicha</option>
            </select>
          </label>
        </div>
        <div className="garden-filters" role="group" aria-label="Bog‘ o‘simliklarini filtrlash">
          {([ ["all", `Barchasi (${plants.length})`], ["care", `Parvarish (${attentionCount})`], ["healthy", `Gullagan (${healthyCount})`] ] as const).map(([value, label]) =>
            <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>,
          )}
        </div>
        {filteredPlants.length ? <>
          <div className="garden-grid">{filteredPlants.map((plant) => <GardenPlant key={plant.entry.id} plant={plant} selected={selected?.entry.id === plant.entry.id} onSelect={() => setSelectedId(plant.entry.id)} />)}</div>
          {selected && <section className="garden-detail" aria-live="polite">
            <div className="garden-detail-heading"><div><p className="eyebrow">Tanlangan nihol</p><h2>{selected.entry.website}</h2><span>{selected.entry.username}</span></div><span className={`garden-badge ${selected.growth}`}>{selected.growth === "bloom" ? "Sog‘lom" : selected.growth === "bud" ? "Diqqat" : "Xavfli"}</span></div>
            <div className="garden-meters">
              <HealthMeter label="Parol kuchi" value={selected.health.strength} />
              <HealthMeter label="Noyoblik" value={selected.health.uniqueness} />
              <HealthMeter label="Yangiligi" value={selected.health.age} />
            </div>
            {selected.health.reasons.length > 0 ? <ul className="garden-reasons">{selected.health.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="garden-good">Bu parolda hozircha parvarish talab qiladigan muammo topilmadi.</p>}
            <button className="button secondary full-width" type="button" onClick={() => onSelect(selected.entry)}>Loginni ko‘rib chiqish</button>
          </section>}
        </> : <div className="garden-empty garden-no-results"><h2>Nihol topilmadi</h2><p>Boshqa filtr yoki qidiruv so‘zini tanlang.</p></div>}
        <p className="garden-note">Parol bog‘i tahlili qurilmangizda bajariladi; bog‘ ko‘rinishida parolning o‘zi chiqmaydi.</p>
      </>}
    </section>
  );
}
