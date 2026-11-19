import React, { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAdminData } from './adminApi';
import { TimeChart, BarList, SERIES, fmt, bucketLabel } from './charts';
import '../../styles/adminAnalytics.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'product', label: 'Product' },
  { id: 'reports', label: 'Reports' },
  { id: 'system', label: 'Backend' },
  { id: 'live', label: 'Live' },
];
const RANGES = [['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminAnalyticsView({ onClose }) {
  const [tab, setTab] = useState(() => sessionStorageGet('an_tab') || 'overview');
  const [range, setRange] = useState(() => sessionStorageGet('an_range') || '7d');
  const [nonce, setNonce] = useState(0);

  const choose = (setter, key) => (v) => { setter(v); sessionStorageSet(key, v); };
  const usesRange = !['system', 'live', 'reports'].includes(tab);

  return (
    <div className="an-root" data-track-ignore>
      <header className="an-top">
        <button className="an-icon-btn" onClick={onClose} aria-label="Back to app"><ArrowLeft size={18} /></button>
        <div className="an-title">
          <h1>Analytics</h1>
          <span>RandomChatly · admin</span>
        </div>
        <button className="an-icon-btn" onClick={() => setNonce((n) => n + 1)} aria-label="Refresh"><RefreshCw size={16} /></button>
      </header>

      <div className="an-controls">
        <nav className="an-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={tab === t.id ? 'is-active' : ''} onClick={() => choose(setTab, 'an_tab')(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {usesRange && (
          <div className="an-range" role="group" aria-label="Time range">
            {RANGES.map(([id, label]) => (
              <button key={id} aria-pressed={range === id} className={range === id ? 'is-active' : ''}
                onClick={() => choose(setRange, 'an_range')(id)}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <main className="an-body" key={`${tab}-${nonce}`}>
        {tab === 'overview' && <Overview range={range} />}
        {tab === 'traffic' && <Traffic range={range} />}
        {tab === 'engagement' && <Engagement range={range} />}
        {tab === 'product' && <Product range={range} />}
        {tab === 'reports' && <Reports />}
        {tab === 'system' && <SystemTab />}
        {tab === 'live' && <Live />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ shared bits

function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

function Card({ title, sub, children, span = 1 }) {
  return (
    <section className={`an-card span-${span}`}>
      {(title || sub) && (
        <header>
          {title && <h2>{title}</h2>}
          {sub && <p>{sub}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

function Loader({ state, children }) {
  if (state.error && !state.data) {
    return <div className="an-error">Couldn't load: {state.error.message}</div>;
  }
  if (!state.data) return <div className="an-loading">Loading…</div>;
  return children(state.data);
}

function Kpi({ label, value, prev, format = fmt.int, invert = false, hint }) {
  const cur = Number(value) || 0;
  const before = Number(prev) || 0;
  let delta = null;
  if (prev != null && before > 0) delta = (cur - before) / before;
  else if (prev != null && before === 0 && cur > 0) delta = Infinity;
  const good = delta == null ? null : (invert ? delta < 0 : delta > 0);
  return (
    <div className="an-kpi" title={hint}>
      <span className="an-kpi-label">{label}</span>
      <span className="an-kpi-value">{format(value)}</span>
      {delta != null && Math.abs(delta) >= 0.001 && (
        <span className={`an-kpi-delta ${good ? 'up' : 'down'}`}>
          {delta === Infinity ? 'new' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}%`}
          <span className="an-kpi-vs"> vs prev.</span>
        </span>
      )}
    </div>
  );
}

function useSeries(rows, fields, labels, hourly) {
  return useMemo(() => {
    if (!rows) return { labels: [], series: [] };
    return {
      labels: rows.map((r) => bucketLabel(r.t, hourly)),
      series: fields.map((f, i) => ({ label: labels[i], data: rows.map((r) => Number(r[f]) || 0) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hourly]);
}

function Table({ cols, rows, empty = 'No data yet' }) {
  if (!rows?.length) return <p className="an-empty">{empty}</p>;
  return (
    <div className="an-table-wrap">
      <table className="an-table">
        <thead><tr>{cols.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : (c.num ? fmt.int(r[c.key]) : r[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ overview

function Overview({ range }) {
  const ov = useAdminData('/overview', { range });
  const tr = useAdminData('/traffic', { range });
  const hourly = range === '24h';
  return (
    <>
      <Loader state={ov}>{(d) => {
        const c = d.current; const p = d.previous;
        return (
          <div className="an-kpis">
            <Kpi label="Visitors" value={c.visitors} prev={p.visitors} hint="Distinct browsers (anonymous id)" />
            <Kpi label="Sessions" value={c.sessions} prev={p.sessions} hint="A session ends after 30 min idle" />
            <Kpi label="Signed-in users" value={c.signed_in_users} prev={p.signed_in_users} />
            <Kpi label="Avg session" value={c.avg_session_sec} prev={p.avg_session_sec} format={fmt.dur} />
            <Kpi label="Bounce rate" value={c.bounce_rate} prev={p.bounce_rate} format={fmt.pct} invert hint="Sessions with no click or product event" />
            <Kpi label="New accounts" value={c.new_accounts} prev={p.new_accounts} hint="Google / password accounts created" />
            <Kpi label="Guest logins" value={c.guest_logins} prev={p.guest_logins} />
            <Kpi label="Random matches" value={c.matches} prev={p.matches} hint="Includes bot matches" />
            <Kpi label="Avg match length" value={c.avg_match_sec} prev={p.avg_match_sec} format={fmt.dur} />
            <Kpi label="Messages" value={Number(c.random_messages) + Number(c.dm_messages)} prev={Number(p.random_messages) + Number(p.dm_messages)} hint="Random-chat + friend DMs" />
          </div>
        );
      }}</Loader>
      <div className="an-grid">
        <Card title="Traffic" sub="Visitors and sessions per period" span={2}>
          <Loader state={tr}>{(d) => <TrafficChart rows={d.series} hourly={hourly} />}</Loader>
        </Card>
        <Card title="Top sources" sub="Where visitors came from">
          <Loader state={tr}>{(d) => <BarList rows={d.referrer} />}</Loader>
        </Card>
        <Card title="Devices">
          <Loader state={tr}>{(d) => <BarList rows={d.device} color={SERIES[0]} />}</Loader>
        </Card>
      </div>
    </>
  );
}

function TrafficChart({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['visitors', 'sessions'], ['Visitors', 'Sessions'], hourly);
  return <TimeChart labels={labels} series={series} area height={240} />;
}

// ------------------------------------------------------------------ traffic

function Traffic({ range }) {
  const tr = useAdminData('/traffic', { range });
  const hourly = range === '24h';
  return (
    <Loader state={tr}>{(d) => (
      <div className="an-grid">
        <Card title="Visitors & sessions" span={2}><TrafficChart rows={d.series} hourly={hourly} /></Card>
        <Card title="New vs returning visitors" sub="New = first ever visit in that period" span={2}>
          <NewReturning rows={d.newVsReturning} hourly={hourly} />
        </Card>
        <Card title="Page views & clicks" span={2}><ViewsClicks rows={d.series} hourly={hourly} /></Card>
        <Card title="Referrers"><BarList rows={d.referrer} /></Card>
        <Card title="Entry pages" sub="First page of each session"><BarList rows={d.entryPages} valueKey="count" /></Card>
        <Card title="UTM source"><BarList rows={d.utm_source} /></Card>
        <Card title="UTM campaign"><BarList rows={d.utm_campaign} /></Card>
        <Card title="Device"><BarList rows={d.device} color={SERIES[0]} /></Card>
        <Card title="Browser"><BarList rows={d.browser} color={SERIES[0]} /></Card>
        <Card title="Operating system"><BarList rows={d.os} color={SERIES[0]} /></Card>
        <Card title="Language"><BarList rows={d.lang} color={SERIES[3]} /></Card>
        <Card title="Time zone" sub="Rough location (no IPs are stored)" span={2}><BarList rows={d.tz} color={SERIES[3]} /></Card>
      </div>
    )}</Loader>
  );
}

function NewReturning({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['new_visitors', 'returning_visitors'], ['New', 'Returning'], hourly);
  return <TimeChart type="bar" stacked labels={labels} series={series} />;
}

function ViewsClicks({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['pageviews', 'clicks'], ['Page views', 'Clicks'], hourly);
  return <TimeChart labels={labels} series={series} />;
}

// ------------------------------------------------------------------ engagement

function Engagement({ range }) {
  const en = useAdminData('/engagement', { range });
  return (
    <Loader state={en}>{(d) => {
      const au = d.activeUsers || {};
      const stick = au.mau ? au.dau / au.mau : 0;
      const stm = d.searchToMatch || {};
      return (
        <>
          <div className="an-kpis">
            <Kpi label="DAU" value={au.dau} hint="Visitors in the last 24h" />
            <Kpi label="WAU" value={au.wau} />
            <Kpi label="MAU" value={au.mau} />
            <Kpi label="Stickiness" value={stick} format={fmt.pct} hint="DAU / MAU" />
            <Kpi label="Searches" value={stm.searches} />
            <Kpi label="Avg wait to match" value={stm.avg_wait_sec} format={fmt.dur} />
            <Kpi label="p90 wait to match" value={stm.p90_wait_sec} format={fmt.dur} />
            <Kpi label="Search cancels" value={stm.cancels} />
          </div>
          <div className="an-grid">
            <Card title="Funnel" sub="Visitors who reached each step in this range" span={2}><Funnel steps={d.funnel} /></Card>
            <Card title="When people are active" sub="Distinct visitors by weekday and hour (your time zone)" span={2}>
              <Heatmap cells={d.heatmap} />
            </Card>
            <Card title="Most clicked" sub="Buttons, links and tabs" span={2}>
              <Table rows={d.topClicks} cols={[
                { key: 'label', label: 'Control' },
                { key: 'screen', label: 'Screen' },
                { key: 'clicks', label: 'Clicks', num: true },
                { key: 'visitors', label: 'Visitors', num: true },
              ]} />
            </Card>
            <Card title="Screens" sub="Views and time spent">
              <Table rows={d.screens} cols={[
                { key: 'screen', label: 'Screen' },
                { key: 'views', label: 'Views', num: true },
                { key: 'avg_sec', label: 'Avg time', num: true, render: (r) => fmt.dur(r.avg_sec) },
                { key: 'clicks', label: 'Clicks', num: true },
              ]} />
            </Card>
            <Card title="Product events">
              <Table rows={d.events} cols={[
                { key: 'name', label: 'Event' },
                { key: 'count', label: 'Count', num: true },
                { key: 'visitors', label: 'Visitors', num: true },
              ]} />
            </Card>
            <Card title="Weekly retention" sub="Share of each first-visit week that came back n weeks later" span={2}>
              <Retention cohorts={d.retention?.cohorts} />
            </Card>
          </div>
        </>
      );
    }}</Loader>
  );
}

function Funnel({ steps }) {
  if (!steps?.length) return <p className="an-empty">No data yet</p>;
  const top = Number(steps[0].visitors) || 0;
  return (
    <ol className="an-funnel">
      {steps.map((s, i) => {
        const v = Number(s.visitors) || 0;
        const prev = i === 0 ? v : Number(steps[i - 1].visitors) || 0;
        return (
          <li key={s.step}>
            <span className="an-funnel-label">{s.step}</span>
            <span className="an-funnel-track">
              <span className="an-funnel-bar" style={{ width: `${top ? Math.max(1, (v / top) * 100) : 0}%` }} />
            </span>
            <span className="an-funnel-value">{fmt.int(v)}</span>
            <span className="an-funnel-pct">{top ? fmt.pct(v / top, 0) : '–'}{i > 0 && prev ? ` · ${fmt.pct(v / prev, 0)} of prev.` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Heatmap({ cells }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  (cells || []).forEach((c) => { grid[c.dow - 1][c.hour] = Number(c.visitors) || 0; });
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="an-heatmap" role="table" aria-label="Activity by weekday and hour">
      <div className="an-heat-row an-heat-head" role="row">
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="an-heat-hour">{h % 3 === 0 ? h : ''}</span>)}
      </div>
      {grid.map((row, d) => (
        <div className="an-heat-row" role="row" key={d}>
          <span className="an-heat-day">{DAYS[d]}</span>
          {row.map((v, h) => (
            <span key={h} role="cell" className="an-heat-cell" title={`${DAYS[d]} ${h}:00 – ${v} visitors`}
              style={{ background: v ? `rgba(224, 96, 122, ${0.12 + 0.88 * (v / max)})` : 'var(--bg-input)' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Retention({ cohorts }) {
  if (!cohorts?.length) return <p className="an-empty">Needs at least a week of data</p>;
  const width = Math.max(...cohorts.map((c) => c.weeks.length));
  return (
    <div className="an-table-wrap">
      <table className="an-table an-retention">
        <thead>
          <tr><th>Week of</th><th className="num">Visitors</th>{Array.from({ length: width }, (_, i) => <th key={i} className="num">W{i}</th>)}</tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort}>
              <td>{new Date(c.cohort).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
              <td className="num">{fmt.int(c.size)}</td>
              {Array.from({ length: width }, (_, i) => {
                const v = c.weeks[i];
                const share = c.size ? (v || 0) / c.size : 0;
                return (
                  <td key={i} className="num an-ret-cell"
                    style={{ background: v != null ? `rgba(95, 136, 220, ${0.08 + 0.7 * share})` : 'transparent' }}>
                    {v != null ? fmt.pct(share, 0) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ product

function Product({ range }) {
  const pr = useAdminData('/product', { range });
  const hourly = range === '24h';
  return (
    <Loader state={pr}>{(d) => (
      <>
        <div className="an-kpis">
          <Kpi label="Accounts (all time)" value={d.totals?.accounts} />
          <Kpi label="Guests right now" value={d.totals?.guests} hint="Guests are purged after 24h" />
          <Kpi label="Friendships" value={d.totals?.friendships} />
          <Kpi label="Conversations" value={d.totals?.conversations} />
        </div>
        <div className="an-grid">
          <Card title="Random matches" sub="Human vs bot partner" span={2}><Matches rows={d.matches} hourly={hourly} /></Card>
          <Card title="Average match length" span={2}><MatchLength rows={d.matches} hourly={hourly} /></Card>
          <Card title="How long chats last" sub="Ended random chats in this range"><BarList rows={d.matchLength} valueKey="count" color={SERIES[2]} /></Card>
          <Card title="New accounts"><Signups rows={d.signups} hourly={hourly} /></Card>
          <Card title="Guest logins"><GuestLogins rows={d.guestLogins} hourly={hourly} /></Card>
          <Card title="Friend DMs" sub="Messages between friends"><Dms rows={d.dms} hourly={hourly} /></Card>
        </div>
      </>
    )}</Loader>
  );
}

// ------------------------------------------------------------------ reports

function personLabel(p) {
  if (!p) return '—';
  const name = p.deleted ? 'Deleted account' : (p.name || 'No name');
  const handle = p.username ? ` @${p.username}` : '';
  return `${name}${handle} (…${String(p.id || '').slice(-6)})`;
}

/** People reported by users (from the block & report tools and match history), with the reason given. */
function Reports() {
  const rp = useAdminData('/reports', { limit: 200 }, 60000);
  return (
    <Loader state={rp}>{(d) => (
      <>
        <div className="an-kpis">
          <Kpi label="Reports (all time)" value={d.total} />
          <Kpi label="Shown" value={d.reports?.length} hint="Newest first, up to 200" />
        </div>
        <Card title="Reported people" sub="Newest first. The reported person is never told who reported them." span={2}>
          <Table rows={d.reports} empty="No reports yet" cols={[
            { key: 'createdAt', label: 'When', render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—') },
            { key: 'reported', label: 'Reported', render: (r) => personLabel(r.reported) },
            { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
            { key: 'reporter', label: 'Reported by', render: (r) => personLabel(r.reporter) },
            { key: 'reportedTotal', label: 'Total against them', num: true },
          ]} />
        </Card>
      </>
    )}</Loader>
  );
}

function Matches({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['human', 'bot'], ['Human', 'Bot'], hourly);
  return <TimeChart type="bar" stacked labels={labels} series={series} />;
}
function MatchLength({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['avg_sec'], ['Avg length'], hourly);
  return <TimeChart labels={labels} series={series} yFormat={fmt.dur} />;
}
function Signups({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['accounts'], ['Accounts'], hourly);
  return <TimeChart type="bar" labels={labels} series={series} height={180} />;
}
function GuestLogins({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['guest_logins'], ['Guest logins'], hourly);
  return <TimeChart type="bar" labels={labels} series={series.map((s) => ({ ...s, color: SERIES[1] }))} height={180} />;
}
function Dms({ rows, hourly }) {
  const { labels, series } = useSeries(rows, ['dms', 'media'], ['All', 'Media'], hourly);
  return <TimeChart labels={labels} series={series} height={180} />;
}

// ------------------------------------------------------------------ backend / system

const WINDOWS = [['15m', '15 min'], ['1h', '1 hour'], ['6h', '6 hours'], ['24h', '24 hours']];

function SystemTab() {
  const [win, setWin] = useState('1h');
  const sys = useAdminData('/system', { window: win }, 15000);
  return (
    <>
      <div className="an-range an-subrange" role="group" aria-label="Window">
        {WINDOWS.map(([id, label]) => (
          <button key={id} aria-pressed={win === id} className={win === id ? 'is-active' : ''} onClick={() => setWin(id)}>{label}</button>
        ))}
      </div>
      <Loader state={sys}>{(d) => <SystemBody d={d} />}</Loader>
    </>
  );
}

function SystemBody({ d }) {
  const l = d.latest || {};
  const rt = d.runtime || {};
  const s = useMemo(() => d.series || [], [d.series]);
  const labels = useMemo(() => s.map((p) => new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), [s]);
  const pick = (keys, names) => keys.map((k, i) => ({ label: names[i], data: s.map((p) => Number(p[k]) < 0 ? null : Number(p[k])) }));
  const charts = useMemo(() => ({
    rps: pick(['reqPerSec'], ['Requests / sec']),
    latency: pick(['avgMs', 'p95Ms', 'p99Ms'], ['Avg', 'p95', 'p99']),
    errors: pick(['errorRate', 'clientErrorRate'], ['5xx %', '4xx %']),
    cpu: pick(['cpuProcess', 'cpuSystem'], ['App CPU %', 'Machine CPU %']),
    heap: pick(['heapUsedMb', 'nonHeapMb'], ['Heap used', 'Non-heap']),
    db: pick(['dbActive', 'dbIdle', 'dbPending'], ['Active', 'Idle', 'Waiting threads']),
    users: pick(['onlineUsers', 'wsSessions'], ['Online users', 'Socket sessions']),
    match: pick(['waiting', 'rooms', 'botSessions'], ['Waiting in queue', 'Live random rooms', 'Bot chats']),
    ws: pick(['wsInPerSec', 'wsOutPerSec'], ['Inbound frames/s', 'Outbound frames/s']),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [s]);

  if (!s.length) {
    return <p className="an-empty">Collecting the first samples (every {rt.sampleIntervalSec || 15}s). The history lives in memory and restarts with the server.</p>;
  }
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Uptime" value={rt.uptimeSec} format={fmt.dur} />
        <Kpi label="Requests / sec" value={l.reqPerSec} format={(v) => fmt.num(v)} />
        <Kpi label="p95 latency" value={l.p95Ms} format={(v) => `${fmt.num(v, 0)} ms`} />
        <Kpi label="5xx rate" value={l.errorRate} format={(v) => `${fmt.num(v)}%`} />
        <Kpi label="App CPU" value={l.cpuProcess} format={(v) => (v < 0 ? '–' : `${fmt.num(v)}%`)} />
        <Kpi label="Heap" value={l.heapUsedMb} format={(v) => `${fmt.mb(v)} / ${fmt.mb(l.heapMaxMb)}`} />
        <Kpi label="DB pool" value={l.dbActive} format={(v) => (v < 0 ? '–' : `${v} / ${l.dbMax} busy`)} />
        <Kpi label="Online now" value={l.onlineUsers} />
        <Kpi label="Socket sessions" value={l.wsSessions} />
        <Kpi label="Threads" value={l.threads} />
      </div>
      <div className="an-grid">
        <Card title="Request rate" sub="HTTP requests per second"><TimeChart labels={labels} series={charts.rps} area height={200} /></Card>
        <Card title="Latency" sub="Per-interval, milliseconds"><TimeChart labels={labels} series={charts.latency} height={200} yFormat={(v) => `${fmt.num(v, 0)} ms`} /></Card>
        <Card title="Error rate" sub="Share of requests"><TimeChart labels={labels} series={charts.errors} height={200} yFormat={(v) => `${fmt.num(v)}%`} /></Card>
        <Card title="CPU"><TimeChart labels={labels} series={charts.cpu} height={200} yFormat={(v) => `${fmt.num(v, 0)}%`} /></Card>
        <Card title="JVM memory"><TimeChart labels={labels} series={charts.heap} height={200} yFormat={fmt.mb} /></Card>
        <Card title="Database pool" sub={`Max ${l.dbMax ?? '–'} connections`}><TimeChart labels={labels} series={charts.db} height={200} /></Card>
        <Card title="Connected users"><TimeChart labels={labels} series={charts.users} height={200} /></Card>
        <Card title="Matchmaking"><TimeChart labels={labels} series={charts.match} height={200} /></Card>
        <Card title="WebSocket traffic" sub="STOMP frames per second"><TimeChart labels={labels} series={charts.ws} height={200} /></Card>
        <Card title="Server">
          <dl className="an-dl">
            <dt>Started</dt><dd>{rt.startedAt ? new Date(rt.startedAt).toLocaleString() : '–'}</dd>
            <dt>Java</dt><dd>{rt.javaVersion} · {rt.processors} CPUs</dd>
            <dt>Machine memory</dt><dd>{fmt.mb(l.sysMemUsedMb)} / {fmt.mb(l.sysMemTotalMb)}</dd>
            <dt>Load average</dt><dd>{l.load1 >= 0 ? fmt.num(l.load1, 2) : '–'}</dd>
            <dt>GC (last interval)</dt><dd>{fmt.int(l.gcCount)} runs · {fmt.int(l.gcMs)} ms</dd>
            <dt>Analytics events</dt><dd>{fmt.int(rt.eventsWritten)} written · {fmt.int(rt.eventsDropped)} dropped · {fmt.int(l.eventsBuffered)} buffered</dd>
          </dl>
        </Card>
        <Card title="Endpoints" sub="Since the last restart, busiest first" span={2}>
          <Table rows={d.routes} cols={[
            { key: 'route', label: 'Route', render: (r) => <code>{r.method} {r.route}</code> },
            { key: 'count', label: 'Calls', num: true },
            { key: 'avgMs', label: 'Avg ms', num: true, render: (r) => fmt.num(r.avgMs) },
            { key: 'p95Ms', label: 'p95 ms', num: true, render: (r) => fmt.num(r.p95Ms, 0) },
            { key: 'maxMs', label: 'Max ms', num: true, render: (r) => fmt.num(r.maxMs, 0) },
            { key: 'serverErrors', label: '5xx', num: true },
            { key: 'clientErrors', label: '4xx', num: true },
          ]} />
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ live

function Live() {
  const live = useAdminData('/live', {}, 10000);
  return (
    <Loader state={live}>{(d) => {
      const s = d.system || {};
      return (
        <>
          <div className="an-kpis">
            <Kpi label="Active visitors (5 min)" value={d.activeVisitors5m} />
            <Kpi label="Online users (sockets)" value={s.onlineUsers} />
            <Kpi label="Waiting for a match" value={s.waiting} />
            <Kpi label="Live random rooms" value={s.rooms} />
            <Kpi label="Bot chats" value={s.botSessions} />
          </div>
          <div className="an-grid">
            <Card title="Where they are now" sub="Screens in the last 5 minutes"><BarList rows={d.screensNow} valueKey="count" /></Card>
            <Card title="Latest events" sub="Refreshes every 10 seconds" span={2}>
              <Table rows={d.recent} cols={[
                { key: 'ts', label: 'Time', render: (r) => new Date(r.ts).toLocaleTimeString() },
                { key: 'name', label: 'Event', render: (r) => (r.type === 'click' ? `click · ${r.label || ''}` : r.name) },
                { key: 'screen', label: 'Screen' },
                { key: 'device', label: 'Device', render: (r) => `${r.device || ''} · ${r.browser || ''}` },
                { key: 'visitor', label: 'Visitor', render: (r) => <code>{r.visitor}{r.signed_in ? ' ✓' : ''}</code> },
              ]} />
            </Card>
          </div>
        </>
      );
    }}</Loader>
  );
}
