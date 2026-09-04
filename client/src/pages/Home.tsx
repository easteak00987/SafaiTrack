/*
 * SafaiTrack / Monsoon Signal
 * This page uses an editorial civic-tech composition: ink-blue surfaces, rain-lime
 * operational signals, coral overflow alerts, asymmetry, and purposeful motion.
 */
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Droplets,
  Github,
  Leaf,
  MapPinned,
  Menu,
  Navigation,
  Play,
  Radio,
  Route,
  ShieldCheck,
  Signal,
  Sparkles,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ASSETS = {
  logo: "/manus-storage/safaitrack-logo_4efeb451.png",
  hero: "/manus-storage/safaitrack-hero_bcb1fd7f.png",
  routeMap: "/manus-storage/safaitrack-route-map_4e8b81bf.png",
  collection: "/manus-storage/safaitrack-collection_4208f4d8.png",
  texture: "/manus-storage/safaitrack-texture_4b3dc844.png",
};

const navItems = [
  { label: "System", href: "#system" },
  { label: "How it works", href: "#flow" },
  { label: "For the city", href: "#people" },
];

const signalCards = [
  {
    icon: Radio,
    label: "Live fill intelligence",
    title: "Know what needs attention before the street does.",
    body: "A simulated sensor layer watches each bin's fill level so teams can move from fixed schedules to responsive collection.",
    accent: "lime",
    tag: "01 / SENSE",
  },
  {
    icon: Route,
    label: "Route intelligence",
    title: "Every route starts with a reason.",
    body: "Dijkstra's algorithm and greedy nearest-neighbor logic turn ward-level demand into shorter, smarter trips.",
    accent: "mist",
    tag: "02 / OPTIMIZE",
  },
  {
    icon: ShieldCheck,
    label: "Accountable response",
    title: "A complaint should leave a trail.",
    body: "Citizens report once, officers see the record, and every issue moves through Pending, In Progress, and Resolved.",
    accent: "coral",
    tag: "03 / RESPOND",
  },
];

const userRoles = [
  { label: "Citizens", detail: "Report a bin. Track a response.", icon: Users },
  { label: "Ward officers", detail: "Resolve what your ward can see.", icon: ShieldCheck },
  { label: "Dispatch teams", detail: "Generate routes around reality.", icon: Navigation },
  { label: "Drivers", detail: "Follow the shortest useful path.", icon: Truck },
];

const routeStops = [
  { name: "Dhanmondi 08", fill: 84, x: "22%", y: "68%", tone: "coral" },
  { name: "Kalabagan 03", fill: 61, x: "36%", y: "37%", tone: "lime" },
  { name: "Lalmatia 06", fill: 47, x: "56%", y: "27%", tone: "mist" },
  { name: "Mohammadpur 11", fill: 76, x: "72%", y: "52%", tone: "lime" },
  { name: "Adabor 02", fill: 33, x: "86%", y: "76%", tone: "mist" },
];

function scrollToId(id: string) {
  document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
}

function SignalTag({ children, tone = "lime" }: { children: React.ReactNode; tone?: "lime" | "coral" | "mist" }) {
  return (
    <span className={`signal-tag signal-tag-${tone}`}>
      <span className="signal-dot" />
      {children}
    </span>
  );
}

function Wordmark({ light = true }: { light?: boolean }) {
  return (
    <a className="wordmark" href="#top" aria-label="SafaiTrack home">
      <span className="wordmark-mark"><img src={ASSETS.logo} alt="" aria-hidden="true" /></span>
      <span className={light ? "wordmark-text" : "wordmark-text wordmark-text-dark"}>
        Safai<span>Track</span><i className="wordmark-terminal" aria-hidden="true" />
      </span>
    </a>
  );
}

function SectionKicker({ index, children, tone = "lime" }: { index: string; children: React.ReactNode; tone?: "lime" | "coral" | "mist" }) {
  return (
    <div className="section-kicker">
      <span className={`kicker-index kicker-${tone}`}>{index}</span>
      <span>{children}</span>
    </div>
  );
}

function HeroRoutePanel() {
  const [activeStop, setActiveStop] = useState(0);
  const active = routeStops[activeStop];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStop((value) => (value + 1) % routeStops.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="hero-visual-shell"
      initial={{ opacity: 0, x: 42, rotate: 2 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      transition={{ delay: 0.22, duration: 1.15, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="hero-visual-image" style={{ backgroundImage: `url(${ASSETS.hero})` }} aria-label="Rain-lit Dhaka street with a municipal waste truck" role="img">
        <div className="image-wash" />
        <div className="route-label route-label-top"><SignalTag tone="lime">WARD 08 / LIVE</SignalTag></div>
        <div className="hero-visual-caption">
          <span className="caption-line" />
          <span>Real streets. Responsive collection.</span>
        </div>
      </div>
      <div className="route-overlay">
        <div className="route-overlay-head">
          <div>
            <p className="micro-label">Simulated ward signal</p>
            <h3>Collection path / 08</h3>
          </div>
          <div className="route-status"><span className="status-pulse" /> Optimized</div>
        </div>
        <div className="route-canvas" aria-label="Animated route map showing bin fill levels">
          <div className="contour contour-a" />
          <div className="contour contour-b" />
          <svg className="route-lines" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
            <path className="route-shadow" d="M76 214 C150 170 160 108 254 122 S390 208 446 142 S515 92 548 74" />
            <path className="route-path" d="M76 214 C150 170 160 108 254 122 S390 208 446 142 S515 92 548 74" />
            <path className="route-branch" d="M254 122 C300 91 327 76 371 56" />
          </svg>
          {routeStops.map((stop, index) => (
            <button
              className={`map-node node-${stop.tone} ${activeStop === index ? "map-node-active" : ""}`}
              style={{ left: stop.x, top: stop.y }}
              onClick={() => setActiveStop(index)}
              key={stop.name}
              aria-label={`Show ${stop.name}, fill level ${stop.fill}%`}
            >
              <span className="node-ring" />
              <span className="node-core" />
            </button>
          ))}
          <motion.div
            className="truck-marker"
            animate={{ left: ["12%", "36%", "61%", "81%", "12%"], top: ["66%", "39%", "27%", "55%", "66%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          >
            <Truck size={15} strokeWidth={2.4} />
          </motion.div>
          <div className="route-legend"><span className="legend-line" /> Efficient route <span className="legend-alert" /> Overflow alert</div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div className="active-stop-card" key={active.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div>
              <span className="active-stop-name">{active.name}</span>
              <span className="active-stop-meta">next collection stop</span>
            </div>
            <div className="fill-reading"><strong>{active.fill}%</strong><span>fill</span></div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function RouteMapArt() {
  return (
    <div className="route-map-art" aria-label="Stylized ward route map with active collection stops" role="img">
      <div className="route-map-grid" />
      <div className="route-map-ward ward-one" /><div className="route-map-ward ward-two" /><div className="route-map-ward ward-three" />
      <svg className="route-map-svg" viewBox="0 0 720 420" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-map-road" d="M40 350 C120 298 132 220 250 238 S400 347 481 257 S601 160 678 96" />
        <path className="route-map-road route-map-road-secondary" d="M160 388 C227 322 274 305 318 220 S423 121 577 48" />
        <path className="route-map-road route-map-road-alert" d="M250 238 C287 201 323 177 365 157" />
      </svg>
      {routeStops.map((stop, index) => <span className={`route-map-stop route-map-stop-${stop.tone}`} style={{ left: stop.x, top: stop.y }} key={`${stop.name}-${index}`}><i /><b>{String(index + 1).padStart(2, "0")}</b></span>)}
      <div className="route-map-label map-label-a"><span>overflow / 84%</span><i /></div><div className="route-map-label map-label-b"><span>route ready</span><i /></div>
      <div className="route-map-north">N <span /></div>
    </div>
  );
}

function RouteMetric({ label, value, detail, accent = "lime" }: { label: string; value: string; detail: string; accent?: "lime" | "coral" | "mist" }) {
  return (
    <div className="route-metric">
      <span className={`metric-bar metric-bar-${accent}`} />
      <div>
        <p className="micro-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-detail">{detail}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [routeMode, setRouteMode] = useState<"shortest" | "nearest">("shortest");
  const [selectedRole, setSelectedRole] = useState(0);
  const { scrollYProgress } = useScroll();
  const progressScale = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.2 });
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -80]);
  const storyRef = useRef<HTMLDivElement>(null);

  const handlePlaceholder = (message: string) => {
    toast(message, { description: "This showcase is a front-end concept. The workflow is architected for the production app." });
  };

  return (
    <div className="safai-page" id="top">
      <motion.div className="scroll-progress" style={{ scaleX: progressScale }} />
      <header className="site-nav">
        <div className="nav-inner">
          <Wordmark />
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
          <div className="nav-actions">
            <button className="nav-login" onClick={() => handlePlaceholder("Sign in will connect residents and ward teams to their live workspace.")}>Sign in <ArrowRight size={15} /></button>
            <button className="nav-cta" onClick={() => scrollToId("#flow")}>See the system <ArrowDown size={15} /></button>
            <button className="mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div className="mobile-nav" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {navItems.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}<ChevronRight size={16} /></a>)}
              <button onClick={() => handlePlaceholder("Sign in will connect residents and ward teams to their live workspace.")}>Sign in <ArrowRight size={15} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-noise" style={{ backgroundImage: `url(${ASSETS.texture})` }} />
          <div className="container hero-grid">
            <motion.div className="hero-copy" style={{ y: heroY }}>
              <motion.div className="hero-eyebrow" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.04 }}>
                <span className="eyebrow-line" />
                <span>Smart collection infrastructure / Dhaka</span>
              </motion.div>
              <motion.h1 id="hero-title" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.14, ease: [0.23, 1, 0.32, 1] }}>
                The city moves.<br /><em>Collection should</em><br />move with it.
              </motion.h1>
              <motion.p className="hero-lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
                SafaiTrack turns overflowing bins, fixed schedules, and unanswered complaints into one visible civic workflow—built for the streets of Dhaka.
              </motion.p>
              <motion.div className="hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.42 }}>
                <button className="button-primary" onClick={() => scrollToId("#system")}>Explore the system <ArrowRight size={17} /></button>
                <button className="button-play" onClick={() => scrollToId("#flow")}><span className="play-icon"><Play size={13} fill="currentColor" /></span> Watch the workflow</button>
              </motion.div>
              <motion.div className="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.68 }}>
                <div className="avatar-stack" aria-hidden="true"><span>W</span><span>D</span><span>C</span></div>
                <p><strong>Built with the street in mind.</strong><br />A course project with production-grade intent.</p>
              </motion.div>
            </motion.div>
            <HeroRoutePanel />
          </div>
          <div className="hero-bottom-row container">
            <div className="scroll-cue"><span className="scroll-cue-line" /> scroll to trace the signal</div>
            <div className="hero-meta"><span>ASP.NET Core</span><span>SQL Server</span><span>18 entities / 04 user roles</span></div>
          </div>
        </section>

        <section className="signal-strip" aria-label="SafaiTrack system signals">
          <div className="container signal-strip-inner">
            <div className="strip-intro"><span className="strip-live"><span /> live model</span><span>Ward signal / 08</span></div>
            <div className="strip-marquee" aria-hidden="true"><span>Fill levels → route logic → accountable response <i>•</i> Fill levels → route logic → accountable response <i>•</i></span></div>
            <span className="strip-time">06:42 AM / BST</span>
          </div>
        </section>

        <section className="statement-section" id="system" ref={storyRef}>
          <div className="section-route-thread section-route-thread-paper" aria-hidden="true"><span /><span /><span /></div>
          <div className="container statement-grid">
            <div className="statement-aside"><SectionKicker index="01" tone="coral">Why SafaiTrack</SectionKicker><span className="aside-rule" /><span className="aside-note">From reactive<br />to responsive.</span></div>
            <div className="statement-content">
              <motion.h2 initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.75 }}>A cleaner city starts with a clearer signal.</motion.h2>
              <motion.p className="statement-lede" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.75, delay: 0.1 }}>Dhaka does not have a waste problem alone. It has a visibility problem. When fill levels, routes, and resident reports live in separate conversations, the street absorbs the gap.</motion.p>
              <div className="statement-foot"><span className="foot-bracket">[</span><span>SafaiTrack connects the moment a bin fills to the moment a team responds.</span><span className="foot-bracket">]</span></div>
            </div>
          </div>
        </section>

        <section className="feature-section" aria-labelledby="feature-title">
          <div className="section-route-thread section-route-thread-ink" aria-hidden="true"><span /><span /><span /></div>
          <div className="container">
            <div className="feature-heading"><SectionKicker index="02">One system. Three signals.</SectionKicker><h2 id="feature-title">Make every collection<br /><span>decision count.</span></h2><p>Not a prettier schedule. A shared operating layer for the people who sense, move, and resolve.</p></div>
            <div className="feature-card-grid">
              {signalCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.article className={`feature-card feature-card-${card.accent}`} key={card.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.7, delay: index * 0.11 }} whileHover={{ y: -8 }}>
                    <div className="feature-card-top"><span className="feature-index">{card.tag}</span><span className="feature-icon"><Icon size={21} strokeWidth={1.7} /></span></div>
                    <div className="feature-card-body"><span className="feature-label">{card.label}</span><h3>{card.title}</h3><p>{card.body}</p></div>
                    <button className="card-link" onClick={() => handlePlaceholder(`${card.label} will open as a role-specific workspace in the full product.`)}>See how it works <ArrowUpRight /></button>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="route-section" id="flow" aria-labelledby="route-title">
          <div className="section-route-thread section-route-thread-mist" aria-hidden="true"><span /><span /><span /></div>
          <div className="route-texture" style={{ backgroundImage: `url(${ASSETS.texture})` }} />
          <div className="container route-layout">
            <div className="route-copy">
              <SectionKicker index="03" tone="mist">The route engine</SectionKicker>
              <h2 id="route-title">Less empty road.<br /><em>More useful motion.</em></h2>
              <p>SafaiTrack treats each ward like a living map. A simulated sensor model surfaces demand, then route logic chooses the next best stop—not the next stop on an old spreadsheet.</p>
              <div className="route-toggle-wrap"><span className="micro-label">Optimization mode</span><div className="route-toggle"><button className={routeMode === "shortest" ? "active" : ""} onClick={() => setRouteMode("shortest")}>Shortest path</button><button className={routeMode === "nearest" ? "active" : ""} onClick={() => setRouteMode("nearest")}>Nearest neighbor</button></div></div>
              <div className="route-metrics"><RouteMetric label="Distance avoided" value={routeMode === "shortest" ? "18.4 km" : "14.1 km"} detail="vs. fixed schedule" /><RouteMetric label="Priority stops" value="05 / 12" detail="above 60% fill" accent="coral" /></div>
              <button className="text-link" onClick={() => handlePlaceholder("Route generation will be available to dispatch teams in the municipal workspace.")}>Generate a ward route <ArrowRight size={16} /></button>
            </div>
            <motion.div className="route-visual" initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.9 }}>
              <div className="route-visual-header"><div><SignalTag tone="mist">DHAKA NORTH / DEMO WARD</SignalTag><p>Priority map / 06:42</p></div><div className="route-visual-controls"><span /><span /><span /></div></div>
              <div className="route-image-wrap"><RouteMapArt /><div className="route-image-overlay"><div className="route-image-callout callout-one"><span className="callout-number">01</span><span>Overflow signal</span></div><div className="route-image-callout callout-two"><span className="callout-number">05</span><span>Stops sequenced</span></div><div className="route-image-callout callout-three"><span className="callout-number">02</span><span>Roads avoided</span></div></div></div>
              <div className="route-visual-footer"><div><span className="footer-label">Algorithm</span><strong>{routeMode === "shortest" ? "Dijkstra / priority-weighted" : "Greedy / nearest-neighbor"}</strong></div><div className="route-ready"><span className="status-pulse" /> route ready</div></div>
            </motion.div>
          </div>
        </section>

        <section className="flow-section" aria-labelledby="flow-title">
          <div className="container flow-layout">
            <div className="flow-intro"><SectionKicker index="04" tone="coral">How it works</SectionKicker><h2 id="flow-title">One signal.<br /><span>Four hands.</span></h2><p>Everyone sees the same truth, at the moment it matters.</p><div className="flow-rail"><span className="rail-progress" /><span className="rail-dot rail-dot-one" /><span className="rail-dot rail-dot-two" /><span className="rail-dot rail-dot-three" /><span className="rail-dot rail-dot-four" /></div></div>
            <div className="flow-list">
              {[
                { n: "01", title: "Sense", body: "The simulated sensor model reads fill levels across a ward and flags what needs attention.", icon: Radio, color: "lime" },
                { n: "02", title: "Sequence", body: "The route engine compares active bins and builds an efficient collection path.", icon: Route, color: "mist" },
                { n: "03", title: "Move", body: "Dispatch assigns a truck and driver with a clear stop-by-stop route in view.", icon: Truck, color: "coral" },
                { n: "04", title: "Resolve", body: "Residents and ward officers can follow every complaint from Pending to Resolved.", icon: Check, color: "lime" },
              ].map((step, index) => {
                const Icon = step.icon;
                return <motion.div className="flow-item" key={step.n} initial={{ opacity: 0, x: 22 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, delay: index * 0.12 }}><span className={`flow-number flow-number-${step.color}`}>{step.n}</span><div className="flow-icon"><Icon size={19} /></div><div className="flow-copy"><h3>{step.title}</h3><p>{step.body}</p></div><ArrowRight className="flow-arrow" size={18} /></motion.div>;
              })}
            </div>
          </div>
        </section>

        <section className="human-section" id="people" aria-labelledby="people-title">
          <div className="section-route-thread section-route-thread-human" aria-hidden="true"><span /><span /><span /></div>
          <div className="container human-grid">
            <motion.div className="human-image" initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.9 }}><div className="human-image-art" style={{ backgroundImage: `url(${ASSETS.hero})` }} role="img" aria-label="Rain-lit Dhaka collection route at dawn"><div className="human-art-wash" /><div className="human-art-stamp"><span>FIELD NOTE / 08</span><strong>HANDOFF<br />LOGGED</strong></div><div className="human-art-route"><span /><span /><span /></div></div><div className="human-image-caption"><span>06:18 AM</span><span>WARD 08 / COLLECTION IN MOTION</span></div></motion.div>
            <div className="human-copy"><SectionKicker index="05">Built for the people in the loop</SectionKicker><h2 id="people-title">Technology is only useful when the handoff is clear.</h2><p>Citizens should not have to wonder whether a complaint disappeared. Drivers should not have to guess which bin matters first. SafaiTrack makes the invisible handoffs of municipal work visible and accountable.</p><div className="role-switcher">{userRoles.map((role, index) => { const Icon = role.icon; return <button key={role.label} className={`role-button ${selectedRole === index ? "role-selected" : ""}`} onClick={() => setSelectedRole(index)}><span className="role-icon"><Icon size={17} /></span><span><strong>{role.label}</strong><small>{role.detail}</small></span><ChevronRight size={16} /></button>; })}</div><div className="human-note"><Droplets size={18} /><span><strong>Designed for Dhaka.</strong> Architected today so real sensors can be added tomorrow.</span></div></div>
          </div>
        </section>

        <section className="impact-section" aria-labelledby="impact-title">
          <div className="section-route-thread section-route-thread-impact" aria-hidden="true"><span /><span /><span /></div>
          <div className="container impact-header"><div><SectionKicker index="06" tone="mist">The bigger reason</SectionKicker><h2 id="impact-title">A more responsive ward<br /><em>is a more livable city.</em></h2></div><p>SafaiTrack is a course project for CSE 3200—built to feel like the civic infrastructure it imagines.</p></div>
          <div className="container impact-grid"><div className="impact-card impact-card-primary"><span className="impact-card-label">A shared civic layer</span><span className="impact-big-number">18</span><span className="impact-card-note">entities in the data model</span><div className="impact-line"><span /> Citizen → Ward → Fleet</div></div><div className="impact-card impact-card-image"><div className="impact-grid-art"><span className="grid-art-line line-a" /><span className="grid-art-line line-b" /><span className="grid-art-line line-c" /><span className="grid-art-node node-a" /><span className="grid-art-node node-b" /><span className="grid-art-node node-c" /><span className="grid-art-coordinate">23.8103° N<br />90.4125° E</span></div><div className="impact-image-copy"><Sparkles size={18} /><span>Signal becomes service.</span></div></div><div className="impact-card impact-card-sdgs"><span className="impact-card-label">Aligned to</span><div className="sdg-row"><span>SDG<br /><strong>11</strong></span><span>SDG<br /><strong>12</strong></span></div><p>Sustainable cities, responsible consumption, and the everyday systems that connect them.</p></div></div>
        </section>

        <section className="cta-section">
          <div className="cta-route-line" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="container cta-inner"><div className="cta-mark"><img src={ASSETS.logo} alt="" aria-hidden="true" /></div><SectionKicker index="07">Make the signal visible</SectionKicker><h2>Cleaner streets start<br />with <em>one logged response.</em></h2><p>Explore the system behind a more accountable way to move a city.</p><button className="button-primary button-primary-dark" onClick={() => handlePlaceholder("The full SafaiTrack workspace is the next stop on this route.")}>Enter the showcase <ArrowRight size={17} /></button></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top"><Wordmark light={false} /><div className="footer-status"><span className="status-pulse" /> system concept / ready to build</div><div className="footer-links"><a href="#system">System</a><a href="#flow">How it works</a><button onClick={() => handlePlaceholder("The SafaiTrack project is built with ASP.NET Core and SQL Server.")}>Project notes <ArrowRight size={14} /></button></div></div>
        <div className="container footer-bottom"><span>SafaiTrack / Dhaka, Bangladesh</span><span>CSE 3200 · Software Development V</span><a href="#top">Back to top <ArrowDown size={14} /></a><a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={16} /></a></div>
      </footer>
    </div>
  );
}

function ArrowUpRight() {
  return <ArrowRight size={16} className="arrow-up-right" />;
}
