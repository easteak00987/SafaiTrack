import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Bell, Bike, Camera, Check, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3, Compass, Eye, EyeOff, FileText, Filter, Gauge, Key, LayoutDashboard, Lock, Mail, MapPin, Menu, Navigation, Radio, RefreshCw, Route as RouteIcon, Search, Settings2, Shield, ShieldCheck, Sparkles, Truck, User, UserRound, X, Zap } from "lucide-react";
import { getBinsForWardSync, computeDijkstraRoute, computeNearestNeighborRoute } from "./lib/routeOptimizer";
import { AuthProvider } from "./contexts/AuthContext";
import WorkspaceRoutes from "./Workspace";
import ErrorBoundary from "./components/ErrorBoundary";


const ease = [0.22, 1, 0.36, 1] as const;
const rise = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } };
const stagger = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease, staggerChildren: 0.1 } } };

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className="brand" aria-label="SafaiTrack home"><span className="brand-mark"><span /><span /><span /></span>{!compact && <span className="brand-word">Safai<span className="word-signal">T</span>rack</span>}</Link>;
}
function Status({ status }: { status: string }) { return <span className={`status status-${status.toLowerCase().replaceAll(" ", "-")}`}><span />{status}</span>; }
function SignalBar({ color = "lime" }: { color?: "lime" | "coral" | "blue" }) { return <span className={`signal-bar ${color}`} aria-hidden="true" />; }
function CountUp({ final, decimals = 0, suffix = "" }: { final: number; decimals?: number; suffix?: string }) { return <motion.span initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.55 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>{final.toFixed(decimals)}<small>{suffix}</small></motion.span>; }
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <motion.div className={className} variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease, staggerChildren: 0.1 } } }} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>{children}</motion.div>; }

function ScrollProgress() { const { scrollYProgress } = useScroll(); return <motion.div className="scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />; }

function ScrollImageStrip() { const { scrollY } = useScroll(); const stripX = useMotionValue(0); const lastScroll = useRef(0); const [direction, setDirection] = useState<"down" | "up">("down"); useMotionValueEvent(scrollY, "change", (latest) => { const delta = latest - lastScroll.current; if (Math.abs(delta) < 0.5) return; const dir = delta > 0 ? "down" : "up"; setDirection(dir); lastScroll.current = latest; const next = stripX.get() + (dir === "down" ? 12 : -12); animate(stripX, next, { duration: .36, ease }); }); const cards = [{ src: "/manus-storage/safaitrack-field_adf72cdb.webp", title: "Handoff logged", meta: "06:18 AM / Ward 08" }, { src: "/manus-storage/safaitrack-ward-map_aa0dc48a.webp", title: "Priority map", meta: "06:42 AM / Demo ward" }, { src: "/manus-storage/safaitrack-hero_ab8e9511.webp", title: "Collection in motion", meta: "Route DHK-08 / Live" }]; return <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }} className="scroll-strip" aria-label="SafaiTrack field motion"><motion.div variants={rise} className="strip-rail"><span><i /> SCROLL SIGNAL</span><b>{direction === "down" ? "FORWARD / ROUTE MOTION" : "REVERSE / RETURN PATH"}</b></motion.div><motion.div variants={rise} className="strip-viewport"><motion.div className="strip-track" style={{ x: stripX }}>{[...cards, ...cards].map((card, i) => <motion.div className="strip-card" key={`${card.title}-${i}`} initial={{ opacity: 0, scale: .92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: false, amount: .2 }} transition={{ delay: (i % 3) * .1, type: "spring", stiffness: 180, damping: 20 }}><img src={card.src} alt="" /><div className="strip-wash" /><div className="strip-card-copy"><small>FIELD NOTE / 0{i + 6}</small><strong>{card.title}</strong><span>{card.meta}</span></div></motion.div>)}</motion.div></motion.div></motion.section>; }

function getBangladeshTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value ?? "AM").toUpperCase();

  return {
    full: `${hour}:${minute} ${dayPeriod} / BST`,
    short: `${hour}:${minute}`,
  };
}

const heroBins = [
  { id: 10, label: "10", name: "Dhanmondi 08", fill: 84, x: 35, y: 178, left: 9.72, top: 80.9 },
  { id: 11, label: "11", name: "Kalabagan 03", fill: 61, x: 115, y: 114, left: 31.94, top: 51.8 },
  { id: 12, label: "12", name: "Lalmatia 06", fill: 47, x: 175, y: 64, left: 48.61, top: 29.1 },
  { id: 13, label: "13", name: "Mohammadpur 11", fill: 76, x: 245, y: 126, left: 68.06, top: 57.3 },
  { id: 14, label: "14", name: "Adabor 02", fill: 92, x: 330, y: 52, left: 91.67, top: 23.6 },
];

function HeroMiniMap() {
  const [activeBin, setActiveBin] = useState(0);
  const [truckTransform, setTruckTransform] = useState("translate(35, 178) rotate(-65)");
  const pathRef = useRef<SVGPathElement>(null);
  const startTimeRef = useRef(performance.now());
  const loopRef = useRef<number>(0);

  const pathD = "M35 178 C 70 100, 120 120, 145 66 S 225 58, 245 126 S 305 150, 330 52";

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const totalLength = path.getTotalLength();

    // Map each bin to its exact arc distance along the path
    const binDistances = heroBins.map((b) => {
      let bestDist = 0;
      let minD = Infinity;
      for (let i = 0; i <= 1000; i++) {
        const d = (i / 1000) * totalLength;
        const pt = path.getPointAtLength(d);
        const dist = Math.hypot(pt.x - b.x, pt.y - b.y);
        if (dist < minD) {
          minD = dist;
          bestDist = d;
        }
      }
      return bestDist;
    });

    const DURATION = 10000; // 10 seconds per loop

    const frame = (now: number) => {
      const elapsed = (now - startTimeRef.current) % DURATION;
      const progress = elapsed / DURATION;
      const currentDist = progress * totalLength;

      const pt = path.getPointAtLength(currentDist);
      const ptAhead = path.getPointAtLength(Math.min(currentDist + 2, totalLength));
      const angle = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);

      setTruckTransform(`translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);

      // Determine which bin the truck is passing over right now
      let currentIdx = 0;
      for (let i = binDistances.length - 1; i >= 0; i--) {
        if (currentDist >= binDistances[i] - 14) {
          currentIdx = i;
          break;
        }
      }

      setActiveBin((prev) => (prev === currentIdx ? prev : currentIdx));

      loopRef.current = requestAnimationFrame(frame);
    };

    loopRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(loopRef.current);
  }, []);

  const handleNodeClick = (index: number) => {
    const path = pathRef.current;
    if (!path) return;
    const totalLength = path.getTotalLength();
    let bestDist = 0;
    let minD = Infinity;
    for (let i = 0; i <= 1000; i++) {
      const d = (i / 1000) * totalLength;
      const pt = path.getPointAtLength(d);
      const dist = Math.hypot(pt.x - heroBins[index].x, pt.y - heroBins[index].y);
      if (dist < minD) {
        minD = dist;
        bestDist = d;
      }
    }
    const targetFrac = bestDist / totalLength;
    startTimeRef.current = performance.now() - targetFrac * 10000;
    setActiveBin(index);
  };

  const current = heroBins[activeBin];

  return (
    <motion.div
      className="hero-overlay"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 19, delay: 0.38 }}
    >
      <div className="panel-head">
        <span>SIMULATED WARD SIGNAL</span>
        <b>
          <i /> OPTIMIZED
        </b>
      </div>
      <h3>Collection path / 08</h3>
      <div className="mini-map">
        <div className="map-lines" />
        <svg viewBox="0 0 360 220" preserveAspectRatio="none">
          <path ref={pathRef} id="route-path" d={pathD} />
          <g className="route-truck" transform={truckTransform}>
            <rect x="-11" y="-7" width="16" height="11" rx="2" fill="#c8f04a" />
            <rect x="5" y="-7" width="7" height="8" rx="1" fill="#c8f04a" />
            <circle cx="-6" cy="5" r="2.5" fill="#0f3031" />
            <circle cx="7" cy="5" r="2.5" fill="#0f3031" />
          </g>
        </svg>
        {heroBins.map((b, i) => (
          <button
            key={b.id}
            onClick={() => handleNodeClick(i)}
            className={`map-node ${i === activeBin ? "active" : ""}`}
            style={{ left: `${b.left}%`, top: `${b.top}%` }}
            aria-label={`Bin ${b.label} - ${b.name}`}
          >
            <span>{b.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-footer">
        <div key={current.id} className="footer-ticker">
          <span>
            {current.name}
            <small>next collection stop</small>
          </span>
          <strong style={{ color: current.fill >= 70 ? "var(--coral)" : "var(--lime)" }}>
            {current.fill}
            <small>% fill</small>
          </strong>
        </div>
      </div>
    </motion.div>
  );
}

function Landing() {
  const [routeMode, setRouteMode] = useState<"shortest" | "nearest">("shortest");
  const [currentTime, setCurrentTime] = useState(getBangladeshTime);

  const wardBins = useMemo(() => getBinsForWardSync("W08"), []);
  const routeResult = useMemo(() => {
    return routeMode === "shortest"
      ? computeDijkstraRoute(wardBins)
      : computeNearestNeighborRoute(wardBins);
  }, [routeMode, wardBins]);

  const highestFillStop = useMemo(() => {
    return [...routeResult.orderedStops].sort((a, b) => b.current_fill_percent - a.current_fill_percent)[0];
  }, [routeResult]);

  const [activeFlowStep, setActiveFlowStep] = useState(0);

  // Live Bangladesh Standard Time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getBangladeshTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-cycle the flow steps every 2.8 seconds
  useEffect(() => {
    const id = setInterval(() => setActiveFlowStep(i => (i + 1) % 4), 2800);
    return () => clearInterval(id);
  }, []);
  const bins = ["Dhanmondi 08", "Kalabagan 03", "Lalmatia 06", "Mohammadpur 11", "Adabor 02"]; const { scrollY } = useScroll(); const navX = useTransform(scrollY, [0, 900], [0, 18]); const navScale = useTransform(scrollY, [0, 900], [1, 0.98]); const [scrolled, setScrolled] = useState(false); useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 24));
  return <div className="landing">
    <motion.header style={{ x: navX, scale: navScale }} className={`landing-nav ${scrolled ? "scrolled" : ""}`}><Logo /><nav><a href="#system">System</a><a href="#flow">How it works</a><a href="#city">For the city</a></nav><div className="nav-actions"><Link to="/login" className="text-link">Sign in</Link><Link to="/home" className="lime-button small">Enter system <ArrowUpRight size={15} /></Link></div><button className="mobile-menu"><Menu size={20} /></button></motion.header>
    <main>
      <motion.section className="hero-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}><motion.div className="hero-copy" variants={rise}><div className="eyebrow"><SignalBar /> SMART COLLECTION INFRASTRUCTURE <span>/</span> DHAKA</div><h1>The city moves.<br /><em>Collection</em> should<br />move with it.</h1><p>SafaiTrack turns overflowing bins, fixed schedules, and unanswered complaints into one visible civic workflow—built for the streets of Dhaka.</p><div className="hero-actions"><Link to="/home" className="lime-button">Explore the system <ArrowUpRight size={16} /></Link><a href="#flow" className="ghost-button"><span className="play-dot">▶</span> Watch the workflow</a></div><div className="hero-foot"><span>WDC</span><span>Built with the street in mind.</span><span>Course project / production intent</span></div></motion.div>
      <motion.div className="hero-visual" variants={rise}><motion.div className="hero-image" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 120, damping: 18, delay: .2 }} /><HeroMiniMap /></motion.div></motion.section>
      <section className="signal-strip" aria-label="SafaiTrack system signals">
        <div className="signal-strip-inner">
          <div className="strip-intro">
            <span className="strip-live"><span /> LIVE MODEL</span>
            <span>WARD SIGNAL / 08</span>
          </div>
          <div className="strip-marquee" aria-hidden="true">
            <span>
              Fill levels → route logic → accountable response <i>•</i>{" "}
              Fill levels → route logic → accountable response <i>•</i>{" "}
              Fill levels → route logic → accountable response <i>•</i>{" "}
              Fill levels → route logic → accountable response <i>•</i>
            </span>
          </div>
          <span className="strip-time">{currentTime.full}</span>
        </div>
      </section>
      <ScrollImageStrip />
      <motion.section id="system" className="story-section light-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}><motion.div variants={rise} className="section-kicker"><span>01</span><SignalBar color="coral" /> WHY SAFAITRACK</motion.div><motion.div variants={rise} className="story-grid"><div><h2>From reactive<br /><em>to responsive.</em></h2></div><div><p className="lead">A cleaner city starts with a clearer signal.</p><p>Dhaka does not have a waste problem alone. It has a visibility problem. When fill levels, routes, and resident reports live in separate conversations, the street absorbs the gap.</p><div className="inline-note"><Zap size={16} /> SafaiTrack connects the moment a bin fills to the moment a team responds.</div></div></motion.div></motion.section>
      <motion.section id="flow" className="signal-section feature-section-dark" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}><motion.div variants={rise} className="section-kicker"><span>02</span><SignalBar /> ONE SYSTEM. THREE SIGNALS.</motion.div><motion.div variants={rise} className="section-title-row"><h2>Make every collection<br /><em>decision count.</em></h2><p>Not a prettier schedule. A shared operating layer for the people who sense, move, and resolve.</p></motion.div><motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }} className="feature-card-grid">{[{ n: "01", title: "Sense", label: "Live fill intelligence", head: "Know what needs attention before the street does.", body: "A simulated sensor layer watches each bin's fill level so teams can move from fixed schedules to responsive collection.", icon: Gauge, tone: "lime" }, { n: "02", title: "Optimize", label: "Route intelligence", head: "Every route starts with a reason.", body: "Dijkstra's algorithm and greedy nearest-neighbor logic turn ward-level demand into shorter, smarter trips.", icon: RouteIcon, tone: "mist" }, { n: "03", title: "Respond", label: "Accountable response", head: "A complaint should leave a trail.", body: "Citizens report once, officers see the record, and every issue moves through Pending, In Progress, and Resolved.", icon: ClipboardList, tone: "coral" }].map(({ n, title, label, head, body, icon: Icon, tone }) => <motion.article whileHover={{ y: -8, background: "rgba(25,48,52,.94)", borderColor: "rgba(164,214,218,.4)" }} whileTap={{ scale: .98 }} transition={{ duration: 0.24 }} className={`feature-card feature-card-${tone}`} key={n}><div className="feature-card-top"><span className="feature-index">{n} / {title.toUpperCase()}</span><span className="feature-icon"><Icon size={19} strokeWidth={1.7} /></span></div><div className="feature-card-body"><span className="feature-label">{label}</span><h3>{head}</h3><p>{body}</p></div><Link to="/home" className="card-link">See how it works <ArrowUpRight size={14} /></Link></motion.article>)}</motion.div></motion.section>
      <motion.section className="route-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>
        <motion.div variants={rise} className="section-kicker">
          <span>03</span><SignalBar /> THE ROUTE ENGINE
        </motion.div>
        <motion.div variants={rise} className="route-grid">
          <div className="route-intro-col">
            <h2>Less empty road.<br /><em>More useful motion.</em></h2>
            <p>SafaiTrack treats each ward like a living map. Simulated signals surface demand, then route logic chooses the next best stop—not the next stop on an old spreadsheet.</p>
            
            <div className="route-toggle-wrap">
              <span className="micro-label">OPTIMIZATION MODE</span>
              <div className="route-toggle">
                <button
                  type="button"
                  className={routeMode === "shortest" ? "active" : ""}
                  onClick={() => setRouteMode("shortest")}
                >
                  Shortest path
                </button>
                <button
                  type="button"
                  className={routeMode === "nearest" ? "active" : ""}
                  onClick={() => setRouteMode("nearest")}
                >
                  Nearest neighbor
                </button>
              </div>
            </div>

            <div className="route-metrics">
              <div className="route-metric">
                <span className="metric-bar" />
                <div>
                  <p className="metric-kicker">Distance avoided</p>
                  <p className="metric-value">
                    <CountUp key={`dist-${routeResult.distanceAvoidedKm}`} final={routeResult.distanceAvoidedKm} decimals={1} suffix=" km" />
                  </p>
                  <p className="metric-detail">vs. fixed schedule ({routeResult.naiveDistanceKm} km)</p>
                </div>
              </div>
              <div className="route-metric">
                <span className="metric-bar metric-bar-coral" />
                <div>
                  <p className="metric-kicker">Priority stops</p>
                  <p className="metric-value">
                    {String(routeResult.priorityStopsCount).padStart(2, "0")} / {String(routeResult.totalBinsCount).padStart(2, "0")}
                  </p>
                  <p className="metric-detail">above 60% fill</p>
                </div>
              </div>
            </div>

            <div className="route-cta-wrap">
              <Link to="/driver/route" className="lime-button route-action-btn">Generate a ward route <ArrowUpRight size={17} /></Link>
            </div>
          </div>

          <motion.div className="route-visual" initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.9 }}>
            <div className="route-visual-header">
              <div>
                <span className="signal-tag signal-tag-mist">
                  <span className="signal-dot" /> DHAKA NORTH / DEMO WARD
                </span>
                <p>Priority map / {currentTime.short}</p>
              </div>
              <div className="route-visual-controls">
                <span /><span /><span />
              </div>
            </div>

            <div className="route-image-wrap">
              <div className="route-map-art" aria-label="Stylized ward route map with active collection stops" role="img">
                <div className="route-map-grid" />
                <div className="route-map-ward ward-one" />
                <div className="route-map-ward ward-two" />
                <div className="route-map-ward ward-three" />

                <svg className="route-map-svg" viewBox="0 0 720 420" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    className="route-map-road"
                    points={routeResult.svgPoints}
                  />
                </svg>

                {routeResult.orderedStops.map((stop) => {
                  const isHigh = stop.current_fill_percent > 60;
                  return (
                    <span
                      key={stop.bin_id}
                      className={`route-map-stop ${isHigh ? "route-map-stop-coral" : "route-map-stop-lime"}`}
                      style={{ left: `${stop.xPercent}%`, top: `${stop.yPercent}%` }}
                    >
                      <span className="stop-num">{String(stop.stop_sequence).padStart(2, "0")}</span>
                      <span className="stop-tooltip">{stop.name} · {stop.current_fill_percent}% fill</span>
                    </span>
                  );
                })}

                <div className="route-map-north">N <span /></div>
              </div>

              <div className="route-image-overlay">
                <div className="route-image-callout callout-one">
                  <span className="callout-number">{String(highestFillStop.stop_sequence).padStart(2, "0")}</span>
                  <span>Overflow signal</span>
                </div>
                <div className="route-image-callout callout-two">
                  <span className="callout-number">{String(routeResult.orderedStops.length).padStart(2, "0")}</span>
                  <span>Stops sequenced</span>
                </div>
                <div className="route-image-callout callout-three">
                  <span className="callout-number">{String(routeResult.roadsAvoidedCount).padStart(2, "0")}</span>
                  <span>Roads avoided</span>
                </div>
              </div>
            </div>

            <div className="route-visual-footer">
              <div>
                <span className="footer-label">Algorithm</span>
                <strong>{routeResult.algorithm}</strong>
              </div>
              <div className="route-ready">
                <span className="status-pulse" /> route ready
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.section id="how-it-works" className="flow-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>
        <div className="flow-layout">
          <motion.div className="flow-intro" variants={rise}>
            <div className="section-kicker">
              <span>04</span><SignalBar color="coral" /> HOW IT WORKS
            </div>
            <h2 id="flow-title">
              One signal.<br />
              <span className="accent-word">Four hands.</span>
            </h2>
            <p>Everyone sees the same truth, at the moment it matters.</p>

            <div className="flow-rail" aria-hidden="true">
              <div className="rail-track-bg" />
              <motion.div
                className="rail-progress-line"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
              {[
                { step: "01", label: "Sense", top: "0%" },
                { step: "02", label: "Sequence", top: "33%" },
                { step: "03", label: "Move", top: "66%" },
                { step: "04", label: "Resolve", top: "100%" },
              ].map((dot, i) => (
                <div
                  key={i}
                  className={`rail-node ${activeFlowStep === i ? "active" : ""}`}
                  style={{ top: dot.top }}
                  onMouseEnter={() => setActiveFlowStep(i)}
                >
                  <span className="rail-marker">
                    <span className="rail-marker-inner" />
                  </span>
                  <span className="rail-label">
                    <b>{dot.step}</b> {dot.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flow-intro-footer">
              <span className="flow-footer-pill">
                <Zap size={15} /> 4 civic roles in sync
              </span>
              <p>Continuous feedback loop across resident, fleet & ward operations.</p>
            </div>
          </motion.div>

          <motion.div className="flow-list" variants={stagger}>
            {[
              {
                n: "01",
                title: "Sense",
                body: "The simulated sensor model reads fill levels across a ward and flags what needs attention.",
                icon: Radio,
                tone: "lime",
                to: "/home",
              },
              {
                n: "02",
                title: "Sequence",
                body: "The route engine compares active bins and builds an efficient collection path.",
                icon: RouteIcon,
                tone: "mist",
                to: "/driver/route",
              },
              {
                n: "03",
                title: "Move",
                body: "Dispatch assigns a truck and driver with a clear stop-by-stop route in view.",
                icon: Truck,
                tone: "coral",
                to: "/driver/route",
              },
              {
                n: "04",
                title: "Resolve",
                body: "Residents and ward officers can follow every complaint from Pending to Resolved.",
                icon: Check,
                tone: "lime",
                to: "/citizen/complaints",
              },
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  variants={rise}
                  whileHover={{ scale: 1.025, x: 8 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  className="flow-row-wrap"
                  onMouseEnter={() => setActiveFlowStep(index)}
                >
                  <Link to={step.to} className={`flow-item ${activeFlowStep === index ? "flow-item-active" : ""}`}>
                    <span className={`flow-number flow-number-${step.tone}`}>{step.n}</span>
                    <div className="flow-icon">
                      <Icon size={26} strokeWidth={2} />
                    </div>
                    <div className="flow-copy">
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                    <ArrowUpRight className="flow-arrow" size={24} strokeWidth={2.2} />
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      <motion.section id="city" className="people-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>
        <motion.div className="people-image" variants={rise} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>
          <span className="field-label">FIELD NOTE / 08</span>
          <strong>HANDOFF<br/>LOGGED</strong>
          <span className="field-time">06:18 AM</span>
          <span className="field-route">WARD 08 / COLLECTION IN MOTION</span>
        </motion.div>
        <motion.div variants={rise} className="people-copy">
          <div className="section-kicker"><span>05</span><SignalBar color="coral" /> BUILT FOR THE PEOPLE IN THE LOOP</div>
          <h2>Technology is only useful when the <em>handoff is clear.</em></h2>
          <p>Citizens should not have to wonder whether a complaint disappeared. Drivers should not have to guess which bin matters. SafaiTrack makes the invisible handoffs visible and accountable.</p>
          <div className="role-list">
            {[
              ["Citizens", "Report a bin. Track a response.", UserRound, "/citizen/dashboard"],
              ["Ward officers", "Resolve what your ward can see.", ShieldCheck, "/officer/dashboard"],
              ["Dispatch teams", "Generate routes around reality.", Navigation, "/driver/route"],
              ["Drivers", "Follow the shortest useful path.", Truck, "/driver/dashboard"],
            ].map(([a, b, Icon, to]) => (
              <Link to={to as string} key={a as string} className="role-link">
                <motion.div
                  className="role-item"
                  whileHover={{ y: -4, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Icon className="role-sign-icon" size={32} strokeWidth={2.4} />
                  <span className="role-text-wrap">
                    <b>{a as string}</b>
                    <small>{b as string}</small>
                  </span>
                  <ArrowUpRight className="role-arrow-icon" size={24} strokeWidth={2.4} />
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.section>
      <motion.section className="closing-section" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }}>
        <div className="closing-head">
          <div>
            <motion.div variants={rise} className="section-kicker">
              <span className="closing-signal-mark" aria-hidden="true" />
              <span>06</span>
              <SignalBar /> THE BIGGER REASON
            </motion.div>
            <motion.h2 variants={rise}>
              A more responsive ward<br />
              <em>is a more livable city.</em>
            </motion.h2>
          </div>
          <div className="closing-cta-col">
            <motion.p variants={rise}>
              Aligned to the everyday systems that make SDG 11 and SDG 12 tangible: cleaner streets, clearer handoffs, less wasted motion.
            </motion.p>
            <motion.div variants={rise}>
              <Link to="/home" className="lime-button">
                Enter the showcase <ArrowUpRight size={18} />
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div variants={rise} className="impact-grid">
          <motion.div
            className="impact-card impact-card-primary"
            whileHover={{ y: -10, scale: 1.025 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <span className="impact-card-label">A shared civic layer</span>
            <span className="impact-big-number">18</span>
            <span className="impact-card-note">entities in the data model</span>
            <div className="impact-line">
              <span /> CITIZEN → WARD → FLEET
            </div>
          </motion.div>

          <motion.div
            className="impact-card impact-card-image"
            whileHover={{ y: -10, scale: 1.025 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <div className="impact-grid-art">
              <span className="grid-art-line line-a" />
              <span className="grid-art-line line-b" />
              <span className="grid-art-line line-c" />
              <span className="grid-art-node node-a" />
              <span className="grid-art-node node-b" />
              <span className="grid-art-node node-c" />
              <span className="grid-art-coordinate">
                23.8103° N<br />90.4125° E
              </span>
            </div>
            <div className="impact-image-copy">
              <Sparkles size={20} />
              <span>Signal becomes service.</span>
            </div>
          </motion.div>

          <motion.div
            className="impact-card impact-card-sdgs"
            whileHover={{ y: -10, scale: 1.025 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <span className="impact-card-label">Aligned to</span>
            <div className="impact-sdg-row">
              <div className="impact-sdg-col coral">
                <span>SDG</span>
                <strong>11</strong>
              </div>
              <div className="impact-sdg-col mist">
                <span>SDG</span>
                <strong>12</strong>
              </div>
            </div>
            <p className="impact-sdg-desc">
              Sustainable cities, responsible consumption, and the everyday systems that connect them.
            </p>
          </motion.div>
        </motion.div>
      </motion.section>
    </main>
    <motion.footer variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }} className="landing-footer"><Logo /><span>SafaiTrack / Dhaka, Bangladesh</span></motion.footer>
  </div>
}

export default function App() { return <AuthProvider><BrowserRouter><ErrorBoundary><WorkspaceRoutes landing={<Landing />} /></ErrorBoundary></BrowserRouter></AuthProvider>; }
