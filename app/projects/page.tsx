type Project = {
  num: string;
  year: string;
  status: "Active" | "Shipped" | "Dormant" | "Retired";
  title: string;
  oneLine: string;
  body: string;
  role: string;
  link?: { label: string; href: string };
};

const projects: Project[] = [
  {
    num: "01",
    year: "[ year ]",
    status: "Active",
    title: "[ project name ]",
    oneLine: "[ one-line description ]",
    body: "[ a short paragraph about this project — what it is, what it is for, what stage it is in ]",
    role: "[ your role ]",
    link: { label: "[ link text ]", href: "#" },
  },
  {
    num: "02",
    year: "[ year ]",
    status: "Shipped",
    title: "[ project name ]",
    oneLine: "[ one-line description ]",
    body: "[ a short paragraph about this project ]",
    role: "[ your role ]",
  },
  {
    num: "03",
    year: "[ year ]",
    status: "Dormant",
    title: "[ project name ]",
    oneLine: "[ one-line description ]",
    body: "[ a short paragraph about this project ]",
    role: "[ your role ]",
  },
];

const statusColor: Record<Project["status"], string> = {
  Active: "text-[var(--color-vermillion)]",
  Shipped: "text-[var(--color-ink)]",
  Dormant: "text-[var(--color-muted)]",
  Retired: "text-[var(--color-muted-soft)]",
};

export default function ProjectsPage() {
  return (
    <div className="px-6 md:px-10 pt-12 md:pt-16 pb-24">
      {/* Header */}
      <header className="grid grid-cols-12 gap-6 mb-16 md:mb-20 pb-10 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-8 rise">
          <p className="eyebrow mb-5">№ II · Department of Projects</p>
          <h1 className="display text-[clamp(2.2rem,6.5vw,4.5rem)] mb-6">
            [ Page headline — your projects, in your words ]
          </h1>
          <p className="max-w-[60ch] text-[1.05rem] italic text-[var(--color-muted)]">
            [ Two or three sentences introducing the catalogue — what counts as
            a project, what you include, what you leave out. ]
          </p>
        </div>
        <aside
          className="col-span-12 md:col-span-3 md:col-start-10 md:border-l md:border-[var(--color-rule)] md:pl-6 rise"
          style={{ animationDelay: "0.12s" }}
        >
          <p className="eyebrow mb-3">Rules of the Shop</p>
          <ol className="font-display italic text-base leading-relaxed space-y-2 text-[var(--color-muted)]">
            <li>1. [ rule one ]</li>
            <li>2. [ rule two ]</li>
            <li>3. [ rule three ]</li>
          </ol>
        </aside>
      </header>

      {/* Catalogue */}
      <div className="space-y-20">
        {projects.map((p) => (
          <article
            key={p.num}
            className="grid grid-cols-12 gap-6 md:gap-10 group"
          >
            <div className="col-span-12 md:col-span-3 flex md:flex-col gap-4 md:gap-6">
              <div className="section-num text-6xl md:text-8xl leading-none">
                {p.num}
              </div>
              <div className="space-y-2 mt-2 md:mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-soft)]">
                  {p.year}
                </p>
                <p className={`font-mono text-[10px] uppercase tracking-[0.22em] ${statusColor[p.status]}`}>
                  ● {p.status}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-soft)]">
                  {p.role}
                </p>
              </div>
            </div>

            <div className="col-span-12 md:col-span-9 border-t border-[var(--color-ink)] pt-6">
              <h2 className="display text-3xl md:text-5xl mb-3 leading-[0.95]">
                {p.title}
              </h2>
              <p className="font-display italic text-lg md:text-xl text-[var(--color-vermillion)] mb-5">
                {p.oneLine}
              </p>
              <p className="max-w-[58ch] text-[1.02rem] italic text-[var(--color-muted)]">
                {p.body}
              </p>
              {p.link && (
                <a
                  href={p.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="linkish inline-block mt-6 font-mono text-[11px] uppercase tracking-[0.22em]"
                >
                  {p.link.label} →
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Tail */}
      <section className="mt-28 text-center max-w-xl mx-auto">
        <p className="aster text-2xl mb-4">✦</p>
        <p className="font-display italic text-lg text-[var(--color-muted)]">
          [ closing note for the projects catalogue ]
        </p>
      </section>
    </div>
  );
}
