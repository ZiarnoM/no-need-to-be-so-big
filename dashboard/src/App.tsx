import type { ReactNode } from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import eda from "./data/eda_summary.json";

type Dataset = "BPDP" | "FAVEL-DS";
const DATASETS: Dataset[] = ["BPDP", "FAVEL-DS"];

const COLOR = {
  BPDP: "#2a78d6",
  "FAVEL-DS": "#1baf7a",
  true: "#2a78d6",
  false: "#eb6834",
  merged: "#a8a7a1",
};

// Wikidata labels are long, the y axis has room for ~10 characters
const SHORT: Record<string, string> = {
  "production company": "prod. co.",
  "located in the administrative territorial entity": "located in",
  "is the study of": "study of",
  "award received": "award",
  "head of government": "head of gov.",
  "place of birth": "birth place",
  "place of death": "death place",
  "cast member": "cast",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span className="flex items-center gap-1.5" key={i.label}>
          <span className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Card({ title, note, legend, children }: { title: string; note: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs leading-relaxed">{note}</p>
      </div>
      {legend}
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="font-semibold text-2xl tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function linkBins() {
  const edges = [0, 100, 250, 500, 1000, Infinity];
  const names = ["<100", "100–250", "250–500", "500–1k", "1k+"];
  return names.map((name, i) => {
    const row: Record<string, string | number> = { name };
    for (const ds of DATASETS) {
      const v = (eda.links as Record<Dataset, number[]>)[ds];
      row[ds] = v.filter((x) => x >= edges[i] && x < edges[i + 1]).length;
    }
    return row;
  });
}

export default function App() {
  const integrity = eda.integrity.map((r) => ({
    ...r,
    name: r.name.replace("FactBench", "FB").replace("FAVEL-DS", "FAVEL"),
  }));
  const favelPreds = eda.predicates["FAVEL-DS"].map((p) => ({ ...p, name: SHORT[p.name] ?? p.name }));
  const corruptionTypes = [...new Set(DATASETS.flatMap((ds) => Object.keys(eda.corruption[ds])))];
  const corruption = corruptionTypes.map((t) => ({
    name: t.replace("no matching true statement", "other"),
    ...Object.fromEntries(DATASETS.map((ds) => [ds, (eda.corruption[ds] as Record<string, number>)[t] ?? 0])),
  }));
  const evidence = DATASETS.map((ds) => ({
    name: ds,
    true: Math.round(eda.evidence[ds].true * 100),
    false: Math.round(eda.evidence[ds].false * 100),
  }));
  const cost = DATASETS.map((ds) => ({
    name: ds,
    lower: eda.cost[ds]["hours (lower)"],
    upper: eda.cost[ds]["hours (upper)"],
  }));
  const favelNegatives = Object.values(eda.corruption["FAVEL-DS"]).reduce((a, n) => a + n, 0);
  const cleanMain = integrity
    .filter((r) => !r.name.startsWith("FB"))
    .reduce((a, r) => a + r.clean, 0);
  const fbMerged = integrity.filter((r) => r.name.startsWith("FB"));
  const fbShare = fbMerged.reduce((a, r) => a + r.merged, 0) / fbMerged.reduce((a, r) => a + r.merged + r.clean, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs uppercase tracking-wider">No Need to Be So Big · Milestone 2</p>
        <h1 className="font-semibold text-2xl tracking-tight">ShallKnow benchmarks at a glance</h1>
        <p className="max-w-3xl text-muted-foreground text-sm">
          Exploratory analysis of the fact-checking datasets used in the ShallKnow paper, as published on Zenodo.
          All numbers come from <code className="text-xs">notebooks/01_eda.ipynb</code>.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="clean statements in BPDP + FAVEL-DS" value={String(cleanMain)} />
        <Stat label="FactBench statements merged in the files" value={pct(fbShare)} />
        <Stat label="FAVEL-DS entities with an English article" value={pct(eda.coverage["FAVEL-DS"])} />
        <Stat label="BPDP entities without an article (mostly wrong ids)" value={pct(1 - eda.coverage.BPDP)} />
        <Stat
          label="LLM hours for one model on FAVEL-DS"
          value={`${eda.cost["FAVEL-DS"]["hours (lower)"]}–${eda.cost["FAVEL-DS"]["hours (upper)"]}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          legend={<Legend items={[{ label: "clean", color: COLOR.true }, { label: "merged", color: COLOR.merged }]} />}
          note={`FB = FactBench. Its true and false statements share file names, so they were merged under one IRI (${pct(fbShare)} of the file). BPDP and FAVEL-DS are intact.`}
          title="Statements per file"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.35} data={integrity} stacked>
            <Grid />
            <Bar dataKey="clean" fill={COLOR.true} lineCap={4} />
            <Bar dataKey="merged" fill={COLOR.merged} lineCap={4} />
            <BarXAxis showAllLabels />
            <ChartTooltip />
          </BarChart>
        </Card>

        <Card
          legend={<Legend items={[{ label: "true", color: COLOR.true }, { label: "false", color: COLOR.false }]} />}
          note="11 relations, each balanced between true and false statements (train + test)."
          title="FAVEL-DS relations"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.3} data={favelPreds} margin={{ left: 80 }} orientation="horizontal" stacked>
            <Grid horizontal={false} vertical />
            <Bar dataKey="true" fill={COLOR.true} lineCap={4} />
            <Bar dataKey="false" fill={COLOR.false} lineCap={4} />
            <BarYAxis />
            <ChartTooltip />
          </BarChart>
        </Card>

        <Card
          legend={<Legend items={DATASETS.map((ds) => ({ label: ds, color: COLOR[ds] }))} />}
          note={`BPDP: all ${eda.corruption.BPDP["predicate swapped"]} negatives swap birth and death place. FAVEL-DS: ${eda.corruption["FAVEL-DS"]["object replaced"]} of ${favelNegatives} replace the object with another entity.`}
          title="How false statements were made"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.3} data={corruption}>
            <Grid />
            <Bar dataKey="BPDP" fill={COLOR.BPDP} lineCap={4} />
            <Bar dataKey="FAVEL-DS" fill={COLOR["FAVEL-DS"]} lineCap={4} />
            <BarXAxis showAllLabels />
            <ChartTooltip />
          </BarChart>
        </Card>

        <Card
          legend={<Legend items={[{ label: "true", color: COLOR.true }, { label: "false", color: COLOR.false }]} />}
          note={`% of statements whose object is mentioned in the subject's Wikipedia article: ${evidence.map((e) => `${e.name} ${e.true}% true vs ${e.false}% false`).join(", ")}. Co-occurrence alone does not separate true from false.`}
          title="Textual evidence"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.45} data={evidence}>
            <Grid />
            <Bar dataKey="true" fill={COLOR.true} lineCap={4} />
            <Bar dataKey="false" fill={COLOR.false} lineCap={4} />
            <BarXAxis showAllLabels />
            <ChartTooltip />
          </BarChart>
        </Card>

        <Card
          legend={<Legend items={DATASETS.map((ds) => ({ label: ds, color: COLOR[ds] }))} />}
          note="Sample of 60 articles per dataset. ShallKnow makes one LLM call per linked article."
          title="Outgoing links per article"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.3} data={linkBins()}>
            <Grid />
            <Bar dataKey="BPDP" fill={COLOR.BPDP} lineCap={4} />
            <Bar dataKey="FAVEL-DS" fill={COLOR["FAVEL-DS"]} lineCap={4} />
            <BarXAxis showAllLabels />
            <ChartTooltip />
          </BarChart>
        </Card>

        <Card
          legend={<Legend items={[{ label: "lower estimate", color: COLOR.true }, { label: "upper estimate", color: COLOR.false }]} />}
          note={`Hours of LLM time for a full run with one 14B model at ~7 s per call: ${cost.map((c) => `${c.name} ${c.lower}–${c.upper} h`).join(", ")}. Hence a fixed subset for the model comparison.`}
          title="Cost of a full run"
        >
          <BarChart aspectRatio="2 / 1" barGap={0.4} data={cost} margin={{ left: 80 }} orientation="horizontal">
            <Grid horizontal={false} vertical />
            <Bar dataKey="lower" fill={COLOR.true} lineCap={4} />
            <Bar dataKey="upper" fill={COLOR.false} lineCap={4} />
            <BarYAxis />
            <ChartTooltip />
          </BarChart>
        </Card>
      </div>
    </main>
  );
}
