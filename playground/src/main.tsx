import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  Pending,
  SteadyProvider,
  useMutation,
  useNavigation,
  useTask,
} from '@oddurs/steady/react';
import type { TaskContext } from '@oddurs/steady';
import { PrefetchDemo } from './PrefetchDemo';
import './style.css';

const sections = ['Overview', 'Activity', 'Settings'] as const;
const content: Record<
  string,
  { title: string; description: string; values: string[] }
> = {
  Overview: {
    title: 'A little room to think.',
    description: 'Your workspace, just as you left it.',
    values: ['12', '04', '98%'],
  },
  Activity: {
    title: 'Everything in its place.',
    description: 'The latest work across your workspace.',
    values: ['28', '07', '100%'],
  },
  Settings: {
    title: 'Make yourself at home.',
    description: 'Small adjustments. A better everyday.',
    values: ['08', '02', '100%'],
  },
};
const projects = [
  'Design principles',
  'Design tokens',
  'Interaction patterns',
  'Navigation research',
  'Release notes',
  'Search architecture',
  'System foundations',
];

function wait(ms: number, signal: AbortSignal, ignoreAbort: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (!ignoreAbort && signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (!ignoreAbort) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>;
}

function App() {
  const [latency, setLatency] = useState(900);
  const [ignoreAbort, setIgnoreAbort] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const failRef = useRef(false);
  const [events, setEvents] = useState<
    { id: number; text: string; kind: string }[]
  >([{ id: 0, text: 'Ready when you are.', kind: 'ready' }]);
  const counter = useRef(0);
  const [copied, setCopied] = useState(false);
  const log = (text: string, kind = 'info') =>
    setEvents((old) =>
      [{ id: ++counter.current, text, kind }, ...old].slice(0, 6),
    );

  async function transport(
    label: string,
    context: TaskContext,
    duration = latency,
  ) {
    const failure = failRef.current;
    if (failure) {
      failRef.current = false;
      setFailNext(false);
    }
    await wait(duration, context.signal, ignoreAbort);
    if (failure)
      throw new Error(
        'The connection dropped. Your last confirmed state is safe.',
      );
    return label;
  }

  const navigation = useNavigation(
    async (destination, context) => {
      await transport(destination, context);
      return content[destination]!;
    },
    { initial: { destination: 'Overview', data: content.Overview! } },
  );

  const [query, setQuery] = useState('');
  const [searchRequests, setSearchRequests] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      event.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  const search = useTask(
    async (term: string, context) => {
      setSearchRequests((count) => count + 1);
      await transport(term, context);
      return projects.filter((project) =>
        project.toLowerCase().includes(term.toLowerCase()),
      );
    },
    { initialData: projects, debounceMs: 250 },
  );

  const save = useMutation(
    async (next: boolean, context) => {
      await transport('bookmark', context);
      return next;
    },
    { initialData: false, optimistic: (_, next) => next },
  );

  async function navigate(destination: string) {
    log(`Intent → ${destination}`);
    const result = await navigation.navigate(destination);
    if (result.status === 'success')
      log(`Committed → ${destination}`, 'success');
    else if (result.status === 'error')
      log(`Failed → ${destination}. Selection restored.`, 'error');
    else if (result.status === 'superseded')
      log(`Superseded → ${destination}`, 'muted');
    else if (result.status === 'cancelled')
      log(`Cancelled → ${destination}`, 'muted');
  }

  async function runRace() {
    log('Race started: slow first request, fast second request.');
    const first = race.run({ label: 'First request', ms: 1300 });
    const second = race.run({ label: 'Latest request', ms: 250 });
    const results = await Promise.all([first, second]);
    log(
      `First: ${results[0]!.status}. Latest: ${results[1]!.status}.`,
      'success',
    );
  }
  const race = useTask(
    async ({ label, ms }: { label: string; ms: number }) => {
      // This transport deliberately ignores cancellation. The core must still be safe.
      await new Promise((resolve) => setTimeout(resolve, ms));
      return label;
    },
    { initialData: 'Ready for a race' },
  );

  async function toggleSave() {
    const next = !save.data;
    log(`Optimistic → ${next ? 'saved' : 'removed'}`);
    const result = await save.run(next);
    log(
      result.status === 'success'
        ? 'Save confirmed by server.'
        : result.status === 'error'
          ? 'Save failed. Optimistic change rolled back.'
          : `Save: ${result.status}`,
      result.status === 'success' ? 'success' : 'error',
    );
  }

  async function copyClone() {
    try {
      await navigator.clipboard.writeText(
        'git clone https://github.com/oddurs/steady.git',
      );
      setCopied(true);
    } catch {
      log('Clone command: git clone https://github.com/oddurs/steady.git');
    }
  }

  const current = navigation.data!.data;
  return (
    <>
      <header className="topbar wrap">
        <a className="brand" href="#" aria-label="Steady home">
          <span className="brand-icon" aria-hidden="true">
            ≋
          </span>
          steady<span className="version">v0.2</span>
        </a>
        <nav aria-label="Main">
          <a href="https://github.com/oddurs/steady#readme">
            Documentation <Arrow diagonal />
          </a>
          <a href="https://github.com/oddurs/steady">
            GitHub <Arrow diagonal />
          </a>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <div className="eyebrow">
            <span className="status-dot" /> A LITTLE LESS FRICTION. EVERYWHERE.
          </div>
          <h1>
            Interfaces
            <br />
            that <em>hold up.</em>
          </h1>
          <div className="hero-bottom">
            <p>
              Immediate intent. Honest feedback. Graceful recovery.
              <br className="desktop" /> The small things that make the web feel
              right.
            </p>
            <a className="pill-link" href="#playground">
              Put it under pressure <Arrow />
            </a>
          </div>
          <div className="hero-rule">
            <span>FRAMEWORK-INDEPENDENT CORE</span>
            <span>REACT READY</span>
            <span>MIT LICENSED</span>
            <span className="hero-number">001 — INTERACTION FOUNDATIONS</span>
          </div>
        </section>

        <section
          className="lab wrap"
          id="playground"
          aria-labelledby="lab-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE INTERACTION LAB</div>
              <h2 id="lab-title">Good behavior. Bad conditions.</h2>
            </div>
            <p>
              Slow it down. Change your mind. Break a request.
              <br />
              The interface should stay on your side.
            </p>
          </div>
          <div className="lab-grid">
            <aside className="conditions" aria-label="Network conditions">
              <div className="panel-label">
                <span className="tiny-cross">+</span> CONDITIONS
              </div>
              <label className="slider-label" htmlFor="latency">
                Network latency{' '}
                <output>
                  {latency.toLocaleString()}
                  <span>ms</span>
                </output>
              </label>
              <input
                id="latency"
                type="range"
                min="0"
                max="4000"
                step="100"
                value={latency}
                onChange={(event) => setLatency(Number(event.target.value))}
                style={{ '--range': `${latency / 40}%` } as CSSProperties}
              />
              <div className="range-labels">
                <span>Instant</span>
                <span>Time for tea</span>
              </div>
              <button
                className={`condition-button ${failNext ? 'armed' : ''}`}
                aria-pressed={failNext}
                onClick={() => {
                  failRef.current = !failRef.current;
                  setFailNext(failRef.current);
                }}
              >
                <span aria-hidden="true">↯</span>
                {failNext ? 'Failure armed' : 'Fail next request'}
                <span className="toggle-dot" />
              </button>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={ignoreAbort}
                  onChange={(event) => setIgnoreAbort(event.target.checked)}
                />
                <span>Ignore abort signals</span>
              </label>
              <p className="aside-note">
                Even an uncooperative request shouldn’t get the last word.
              </p>
              <div className="divider" />
              <div className="panel-label">THE CONTRACT</div>
              <ol className="contract">
                <li>Acknowledge immediately.</li>
                <li>Keep useful content.</li>
                <li>Honor the latest intent.</li>
                <li>Recover honestly.</li>
              </ol>
              <div className="core-badge">
                <span className="status-dot" /> Zero runtime dependencies in
                core
              </div>
            </aside>

            <div className="workspace">
              <div className="workspace-chrome">
                <div className="window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span>your-app / workspace</span>
                <span className="live-label">
                  <span className="status-dot" /> LIVE DEMO
                </span>
              </div>
              <div className="workspace-body">
                <div className="workspace-title">
                  <span className="workspace-logo" aria-hidden="true">
                    w.
                  </span>
                  <strong>Workspace</strong>
                  <span className="avatar" aria-label="Demo user">
                    S
                  </span>
                </div>
                <div
                  className="tab-row"
                  role="group"
                  aria-label="Workspace sections"
                >
                  {sections.map((section) => (
                    <button
                      key={section}
                      data-selected={navigation.selected === section}
                      aria-pressed={navigation.selected === section}
                      onClick={() => {
                        void navigate(section);
                      }}
                    >
                      {section}
                      <span
                        className="tab-pending"
                        data-pending={
                          navigation.isPending &&
                          navigation.selected === section
                        }
                      />
                    </button>
                  ))}
                </div>
                <div
                  className="content-panel"
                  data-testid="navigation-content"
                  aria-busy={navigation.isPending}
                >
                  <div className="content-eyebrow">
                    {navigation.current.toUpperCase()}
                  </div>
                  <h3>{current.title}</h3>
                  <p>{current.description}</p>
                  <div className="stats">
                    {['Projects', 'In progress', 'Looking good'].map(
                      (label, index) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{current.values[index]}</strong>
                          <div className="stat-line">
                            <i style={{ width: `${[72, 38, 93][index]}%` }} />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="project-card">
                    <div className="project-graphic" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div>
                      <strong>The details make the difference.</strong>
                      <p>Every interaction is a chance to build trust.</p>
                    </div>
                    <button
                      className="bookmark"
                      aria-label={
                        save.data ? 'Remove bookmark' : 'Bookmark project'
                      }
                      aria-pressed={save.data}
                      disabled={save.isPending}
                      onClick={() => {
                        void toggleSave();
                      }}
                    >
                      <svg
                        width="19"
                        height="22"
                        viewBox="0 0 19 22"
                        fill={save.data ? 'currentColor' : 'none'}
                        aria-hidden="true"
                      >
                        <path
                          d="M4 3h11v16l-5.5-4L4 19V3Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="feedback-row">
                  <Pending
                    state={navigation}
                    slow="Taking a little longer. You can still switch sections."
                  >
                    Loading {navigation.selected.toLowerCase()}…
                  </Pending>
                  {navigation.isPending && (
                    <button onClick={navigation.cancel}>Cancel</button>
                  )}
                  {navigation.status === 'error' && (
                    <div role="alert">
                      Couldn’t open {navigation.input}.{' '}
                      <button
                        onClick={() => {
                          void navigate(navigation.input!);
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
                <div className="save-feedback">
                  <Pending state={save} slow="Still waiting for confirmation…">
                    Saving bookmark…
                  </Pending>
                  {save.status === 'error' && (
                    <span role="alert">
                      Save failed. Your bookmark was restored.{' '}
                      <button
                        onClick={() => {
                          void toggleSave();
                        }}
                      >
                        Try again
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <div className="state-strip">
                <span>
                  <i className="intent-dot" /> INTENT{' '}
                  <strong data-testid="intent">{navigation.selected}</strong>
                </span>
                <span>
                  <i className="committed-dot" /> COMMITTED{' '}
                  <strong data-testid="committed">{navigation.current}</strong>
                </span>
                <span className="state-status">
                  {navigation.isPending
                    ? 'IN FLIGHT'
                    : navigation.status === 'error'
                      ? 'RECOVERED'
                      : 'IN SYNC'}
                </span>
              </div>
            </div>
          </div>
          <div className="lab-caption">
            <span>01 / OPTIMISTIC NAVIGATION + MUTATIONS</span>
            <p>
              Click between sections quickly. The selection moves immediately.
              The content catches up.
            </p>
          </div>

          <div className="experiments">
            <article className="experiment" aria-labelledby="search-title">
              <div className="panel-label">02 / SEARCH THAT KEEPS UP</div>
              <h3 id="search-title">Your last word wins.</h3>
              <p>
                Keep typing. Requests wait for a 250ms pause. Press Enter to
                search immediately.
              </p>
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  ref={searchInput}
                  aria-label="Search projects"
                  placeholder="Search projects…"
                  value={query}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                      search.flush();
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuery(value);
                    void search.run(value);
                  }}
                />
                <kbd>/</kbd>
              </label>
              <div className="search-metrics">
                <span data-testid="search-phase">
                  {search.isScheduled
                    ? 'Waiting for typing to stop'
                    : search.isPending
                      ? 'Request in flight'
                      : 'Ready'}
                </span>
                <span>
                  Requests:{' '}
                  <output data-testid="search-requests">
                    {searchRequests}
                  </output>
                </span>
              </div>
              <ul
                className="search-results"
                aria-label="Search results"
                aria-busy={search.isPending}
              >
                {search.data?.map((project) => (
                  <li key={project}>
                    <span className="file-icon" aria-hidden="true">
                      ▤
                    </span>
                    {project}
                    <Arrow />
                  </li>
                ))}
                {search.data?.length === 0 && <li>No matching projects.</li>}
              </ul>
              <div className="experiment-feedback">
                <Pending
                  state={search}
                  slow="Still searching. Your current results are safe."
                >
                  Updating results…
                </Pending>
                {search.status === 'error' && (
                  <span role="alert">
                    Search failed.{' '}
                    <button
                      onClick={() => {
                        void search.retry();
                      }}
                    >
                      Try again
                    </button>
                  </span>
                )}
              </div>
            </article>
            <article
              className="experiment race-experiment"
              aria-labelledby="race-title"
            >
              <div className="panel-label">03 / AN UNFAIR RACE</div>
              <h3 id="race-title">Late doesn’t mean latest.</h3>
              <p>
                Two requests. The first takes longer and ignores cancellation.
                Only the latest intent gets to commit.
              </p>
              <div className="race-tracks">
                <div>
                  <span>First request</span>
                  <div className="track">
                    <i className="track-old" />
                  </div>
                  <span>1,300ms</span>
                </div>
                <div>
                  <span>Latest request</span>
                  <div className="track">
                    <i className="track-new" />
                  </div>
                  <span>250ms</span>
                </div>
              </div>
              <div className="race-result" aria-live="polite">
                <span className="status-dot" />
                <span data-testid="race-result">
                  {race.isPending ? 'Requests in flight…' : race.data}
                </span>
              </div>
              <button
                className="primary-button"
                disabled={race.isPending}
                onClick={() => {
                  void runRace();
                }}
              >
                {race.isPending ? 'Racing…' : 'Run the race'}
                <Arrow />
              </button>
              <div className="race-note">
                Deterministic timings. Both requests really run.
              </div>
            </article>
          </div>
          <PrefetchDemo transport={transport} />
          <div className="event-log">
            <div className="panel-label">
              <span className="status-dot" /> UNDER THE SURFACE
            </div>
            <ol aria-label="Interaction events">
              {events.map((event) => (
                <li key={event.id} data-kind={event.kind}>
                  <span>{String(event.id).padStart(2, '0')}</span>
                  {event.text}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="integration wrap">
          <div>
            <div className="eyebrow">SMALL SURFACE. STRONG DEFAULTS.</div>
            <h2>
              Bring your interface.
              <br />
              We’ll bring the follow-through.
            </h2>
            <p>
              A tiny TypeScript core. Headless React hooks.
              <br />
              Your components, your styles, your data layer.
            </p>
            <button
              className="clone-command"
              onClick={() => {
                void copyClone();
              }}
            >
              <code>git clone github.com/oddurs/steady</code>
              <span>{copied ? 'Copied ✓' : 'Copy ↗'}</span>
            </button>
            <span className="source-note">
              Available from source · npm publishing comes next
            </span>
          </div>
          <div className="code-card">
            <div className="code-header">
              <span>navigation.tsx</span>
              <span>REACT</span>
            </div>
            <pre>
              <code>
                <span className="code-muted">
                  {'// Selection now. Content when it’s ready.\n'}
                </span>
                <span className="code-purple">{'const '}</span>
                {'nav = '}
                <span className="code-blue">{'useNavigation'}</span>
                {'(loadSection, {\n  initial: {\n    destination: '}
                <span className="code-green">{'"overview"'}</span>
                {
                  ',\n    data: initialContent,\n  },\n});\n\n<button\n  data-active={nav.selected === '
                }
                <span className="code-green">{'"settings"'}</span>
                {'}\n  onClick={() => nav.navigate('}
                <span className="code-green">{'"settings"'}</span>
                {')}\n>\n  Settings\n</button>'}
              </code>
            </pre>
          </div>
        </section>
      </main>
      <footer className="wrap">
        <a className="brand" href="#">
          steady<span className="footer-period">.</span>
        </a>
        <span>Care is in the behavior.</span>
        <a href="https://github.com/oddurs/steady">
          Open source, always. <Arrow diagonal />
        </a>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SteadyProvider delayMs={150} slowMs={2200}>
      <App />
    </SteadyProvider>
  </StrictMode>,
);
