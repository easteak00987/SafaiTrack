import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowUpRight, Bell, Bike, Camera, Check, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3, Compass, Eye, EyeOff, FileText, Filter, Gauge, Key, LayoutDashboard, Lock, Mail, MapPin, Menu, Navigation, Radio, RefreshCw, Route as RouteIcon, Search, Settings2, Shield, ShieldCheck, Sparkles, Truck, User, UserRound, X, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { getBinsForWardSync, computeDijkstraRoute, computeNearestNeighborRoute } from "./lib/routeOptimizer";
import { HeaderActions } from "./components/HeaderActions";
import { DEMO_PROFILES, type UserProfile, type UserRole } from "./lib/headerData";
import { apiClient } from "./lib/api-client";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// TODO: Connect this mock data to ASP.NET Core + SQL Server APIs when backend is available.
const complaints = [
  { id: "ST-2408", location: "Dhanmondi Lake Road", ward: "Ward 08", category: "Overflowing bin", status: "In Progress", time: "12 min ago", fill: 94, note: "Bin cluster beside the footbridge is blocking the walkway." },
  { id: "ST-2407", location: "Lalmatia Block C", ward: "Ward 08", category: "Missed collection", status: "Pending", time: "38 min ago", fill: 81, note: "Scheduled pickup did not arrive by 09:00." },
  { id: "ST-2405", location: "Mohammadpur Bus Stand", ward: "Ward 11", category: "Overflowing bin", status: "Resolved", time: "Yesterday", fill: 66, note: "A high-fill bin was cleared and the route log was updated." },
  { id: "ST-2398", location: "Kalabagan Market Lane", ward: "Ward 05", category: "Damaged bin", status: "Resolved", time: "2 days ago", fill: 42, note: "Replacement bin installed by field crew." },
];
const stops = [
  { name: "Dhanmondi 08", area: "Lake Road / Footbridge", fill: 94, eta: "Now", tone: "hot" },
  { name: "Lalmatia 06", area: "Block C collection point", fill: 81, eta: "06 min", tone: "warn" },
  { name: "Mohammadpur 11", area: "Bus stand service lane", fill: 76, eta: "14 min", tone: "warn" },
  { name: "Adabor 02", area: "Ring Road entrance", fill: 66, eta: "22 min", tone: "ok" },
];
const chartData = [{ day: "M", value: 42 }, { day: "T", value: 58 }, { day: "W", value: 49 }, { day: "T", value: 74 }, { day: "F", value: 64 }, { day: "S", value: 82 }, { day: "S", value: 71 }];

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

function getBreadcrumbTitle(pathname: string): string {
  if (pathname === "/citizen/dashboard") return "Citizen Portal";
  if (pathname === "/driver/dashboard") return "Driver Console";
  if (pathname === "/officer/dashboard") return "Ward Officer Desk";
  if (pathname === "/driver/route") return "Live Route";
  if (pathname === "/citizen/report") return "Report Issue";
  if (pathname === "/citizen/complaints") return "Complaints";
  if (pathname.startsWith("/citizen/complaints/")) return "Complaint Trail";
  if (pathname.startsWith("/officer/complaints/")) return "Officer Review";
  if (pathname === "/settings") return "System Settings";
  if (pathname === "/home") return "Overview";
  return "Overview";
}

function getInitialProfile(pathname: string): UserProfile {
  const storedRole = (typeof localStorage !== "undefined" ? localStorage.getItem("safaitrack_active_role") : null) as UserRole | null;
  if (storedRole && DEMO_PROFILES[storedRole]) {
    return DEMO_PROFILES[storedRole];
  }
  if (pathname.startsWith("/driver")) return DEMO_PROFILES["Truck Driver"];
  if (pathname.startsWith("/citizen")) return DEMO_PROFILES["Citizen"];
  if (pathname.startsWith("/officer")) return DEMO_PROFILES["Ward Officer"];
  return DEMO_PROFILES["Ward Officer"];
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => getInitialProfile(location.pathname));
  const currentBreadcrumb = getBreadcrumbTitle(location.pathname);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.title = `${currentBreadcrumb} — SafaiTrack`;
  }, [currentBreadcrumb]);

  // Keep state and localStorage in sync when navigating to role-dedicated routes
  useEffect(() => {
    if (location.pathname === "/driver/dashboard" || location.pathname === "/driver/route") {
      if (currentUser.role !== "Truck Driver") {
        setCurrentUser(DEMO_PROFILES["Truck Driver"]);
        localStorage.setItem("safaitrack_active_role", "Truck Driver");
      }
    } else if (location.pathname === "/citizen/dashboard" || location.pathname === "/citizen/report" || location.pathname === "/citizen/complaints") {
      if (currentUser.role !== "Citizen") {
        setCurrentUser(DEMO_PROFILES["Citizen"]);
        localStorage.setItem("safaitrack_active_role", "Citizen");
      }
    } else if (location.pathname === "/officer/dashboard" || location.pathname.startsWith("/officer/complaints")) {
      if (currentUser.role !== "Ward Officer") {
        setCurrentUser(DEMO_PROFILES["Ward Officer"]);
        localStorage.setItem("safaitrack_active_role", "Ward Officer");
      }
    }
  }, [location.pathname]);

  const handleUpdateUser = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    localStorage.setItem("safaitrack_active_role", newUser.role);
  };

  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-head">
          <Logo />
          <button onClick={() => setOpen(false)} className="close-menu">
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-label">ACTIVE WORKSPACE</span>
          <div className="workspace-card">
            <span className="ward-orb">08</span>
            <div>
              <b>Ward 08 / Dhanmondi</b>
              <small>North Dhaka operations</small>
            </div>
            <ChevronRight size={16} />
          </div>
        </div>
        <div className="page-directory">
          <span className="workspace-label">PAGE DIRECTORY</span>
          <div className="directory-grid">
            <NavLink to="/home">Overview</NavLink>
            <NavLink to="/citizen/dashboard">Citizen</NavLink>
            <NavLink to="/driver/dashboard">Driver</NavLink>
            <NavLink to="/officer/dashboard">Officer</NavLink>
            <NavLink to="/admin/fleet">Fleet</NavLink>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </div>
        </div>
        <nav className="side-nav">
          <span className="workspace-label">OPERATIONS</span>
          {[
            ["/home", "Overview", LayoutDashboard],
            ["/driver/route", "Live route", Navigation],
            ["/citizen/complaints", "Complaints", ClipboardList],
            ["/citizen/report", "Report issue", CircleAlert],
            ["/admin/fleet", "Fleet", Truck],
          ].map(([to, label, Icon]) => (
            <NavLink
              key={to as string}
              to={to as string}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={17} />
              {label as string}
              {label === "Complaints" && <b className="nav-count">3</b>}
            </NavLink>
          ))}
          <span className="workspace-label lower">ACCOUNT</span>
          <NavLink to="/login">
            <UserRound size={17} />
            Switch role
          </NavLink>
          <NavLink to="/settings">
            <Settings2 size={17} />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="profile">
            <span style={{ backgroundColor: currentUser.avatarColor }}>{currentUser.initials}</span>
            <div>
              <b>{currentUser.name}</b>
              <small>{currentUser.role}</small>
            </div>
            <ChevronRight size={14} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-topbar">
          <button className="mobile-menu dark" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="crumb">
            <span>Dhaka North</span>
            <ChevronRight size={13} />
            <b>{currentBreadcrumb}</b>
          </div>
          <HeaderActions currentUser={currentUser} setCurrentUser={handleUpdateUser} />
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease }}
          >
            {React.isValidElement(children)
              ? React.cloneElement(children as React.ReactElement<any>, { currentUser })
              : children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
function MetricCard({ label, value, detail, tone = "lime", icon: Icon }: { label:string; value:string | number; detail:string; tone?:string; icon: React.ElementType }) { return <motion.div variants={rise} whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,.3)" }} whileTap={{ scale: .98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="metric-card"><div className="metric-icon"><Icon size={18} /></div><span>{label}</span><strong>{typeof value === "number" ? <CountUp final={value} /> : value}</strong><small className={tone === "coral" ? "negative" : "positive"}>{detail}</small><div className={`metric-spark ${tone}`} /></motion.div> }
function Overview({ currentUser }: { currentUser?: UserProfile }) { 
  const { user } = useAuth();
  const [bins, setBins] = useState<any[]>([]);
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.fullName || currentUser?.name || "Operations Lead";
  const firstName = displayName.split(" ")[0];

  useEffect(() => {
    let isMounted = true;
    const fetchOverviewData = async () => {
      try {
        const [binsRes, compRes] = await Promise.all([
          apiClient.get("/api/bins"),
          apiClient.get("/api/complaints"),
        ]);
        if (isMounted) {
          setBins(binsRes.data || []);
          setComplaintsList(compRes.data || []);
        }
      } catch (err) {
        console.warn("Failed to fetch live overview data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchOverviewData();
    return () => { isMounted = false; };
  }, []);

  const priorityBinsCount = bins.filter((b) => b.currentFillPercent > 60).length;
  const coveragePercent = bins.length
    ? Math.round((bins.filter((b) => b.currentFillPercent < 75).length / bins.length) * 100)
    : 0;
  const openComplaintsCount = complaintsList.filter((c) => c.status !== "Resolved").length;
  const topSignals = [...bins].sort((a, b) => b.currentFillPercent - a.currentFillPercent).slice(0, 4);

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><SignalBar /> LIVE OPERATIONS / WARD 08</div>
          <h1>Good morning, {firstName}.</h1>
          <p>Here’s what is moving across Dhanmondi and the surrounding wards.</p>
        </div>
        <div className="heading-actions">
          <button className="outline-button"><Clock3 size={16} /> 06:42 AM BST</button>
          <Link to="/driver/route" className="lime-button"><Zap size={16} /> Generate route</Link>
        </div>
      </div>

      <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.2 }} className="metric-grid">
        <MetricCard label="Priority bins" value={priorityBinsCount} detail={`${priorityBinsCount} > 60% fill`} icon={CircleAlert} tone="coral" />
        <MetricCard label="Collection coverage" value={coveragePercent} detail={`${bins.length} total monitored`} icon={Gauge} />
        <MetricCard label="Distance avoided" value={18.4} detail="vs. fixed schedule" icon={RouteIcon} tone="blue" />
        <MetricCard label="Open complaints" value={openComplaintsCount} detail={`${complaintsList.length} logged total`} icon={ClipboardList} tone="coral" />
      </motion.div>

      <div className="dashboard-grid">
        <section className="surface chart-surface">
          <div className="surface-head">
            <div>
              <span className="overline">FILL SIGNAL / LAST 7 DAYS</span>
              <h2>Ward demand is <em>rising.</em></h2>
            </div>
            <button className="filter-button">This week <ChevronRight size={14} /></button>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8F04A" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#C8F04A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#83908a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#103B3C", border: 0, borderRadius: 10, color: "#fff" }} />
                <Area type="monotone" dataKey="value" stroke="#8baa2d" strokeWidth={3} fill="url(#fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span><i className="dot lime" /> Average fill level</span>
            <span>Threshold <b>60%</b></span>
          </div>
        </section>

        <section className="surface signal-surface">
          <div className="surface-head">
            <div>
              <span className="overline">LIVE SIGNALS</span>
              <h2>Needs attention <em>now.</em></h2>
            </div>
            <Link to="/citizen/complaints" className="text-link dark">View all <ArrowUpRight size={14} /></Link>
          </div>
          <div className="signal-list">
            {topSignals.map((bin, i) => (
              <div className="signal-row" key={bin.binId || bin.name}>
                <span className={`stop-index ${bin.currentFillPercent > 70 ? "hot" : bin.currentFillPercent > 50 ? "warn" : "ok"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{bin.name}</b>
                  <small>{bin.wardName || "Ward 08"}</small>
                </div>
                <div className="fill-meter">
                  <div style={{ width: `${bin.currentFillPercent}%` }} />
                  <span>{bin.currentFillPercent}%</span>
                </div>
                <ChevronRight size={15} />
              </div>
            ))}
          </div>
          <Link to="/driver/route" className="route-link"><RouteIcon size={16} /> Open optimized route <ArrowUpRight size={14} /></Link>
        </section>
      </div>

      <section className="surface complaints-surface">
        <div className="surface-head">
          <div>
            <span className="overline">ACCOUNTABLE RESPONSE</span>
            <h2>Complaint pulse</h2>
          </div>
          <Link to="/citizen/complaints" className="outline-button small">View complaints <ArrowUpRight size={14} /></Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Location / Bin</th>
                <th>Category</th>
                <th>Status</th>
                <th>Logged</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {complaintsList.slice(0, 4).map((c) => (
                <tr key={c.complaintId || c.id}>
                  <td>
                    <Link to={`/citizen/complaints/${c.complaintId || c.id}`} className="ref-link">
                      ST-{c.complaintId || c.id}
                    </Link>
                  </td>
                  <td>
                    <b>{c.binName || c.location}</b>
                    <small>Ward 08</small>
                  </td>
                  <td>{c.category}</td>
                  <td><Status status={c.status} /></td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : c.time}</td>
                  <td><ChevronRight size={16} /></td>
                </tr>
              ))}
              {complaintsList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#83908a", padding: "18px" }}>
                    No complaints reported yet. All signals clear.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface" style={{ marginTop: "24px" }}>
        <div className="surface-head">
          <div>
            <span className="overline">MUNICIPAL ANALYTICS</span>
            <h2>Routing &amp; Sensor Telemetry</h2>
          </div>
          <Link to="/admin/fleet" className="outline-button small">
            <Truck size={15} /> Fleet manager <ArrowUpRight size={14} />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginTop: "16px" }}>
          <div style={{ background: "rgba(16, 59, 60, 0.4)", border: "1px solid rgba(200, 240, 74, 0.15)", borderRadius: "14px", padding: "20px" }}>
            <span className="overline" style={{ color: "#C8F04A" }}>ALGORITHM PERFORMANCE</span>
            <h3 style={{ margin: "8px 0 4px", fontSize: "20px" }}>Held-Karp Exact TSP</h3>
            <p style={{ color: "#83908a", fontSize: "13px", lineHeight: "1.5" }}>
              Dynamic programming with bitmask state transitions guarantees mathematically optimal tour distance, avoiding unnecessary fuel spend on Ward circuits.
            </p>
            <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
              <Link to="/driver/route" className="lime-button small" style={{ fontSize: "12px", height: "32px", padding: "0 12px" }}>
                Inspect Route Engine <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div style={{ background: "rgba(16, 59, 60, 0.4)", border: "1px solid rgba(200, 240, 74, 0.15)", borderRadius: "14px", padding: "20px" }}>
            <span className="overline" style={{ color: "#85e86a" }}>FILL SEVERITY INDEX</span>
            <h3 style={{ margin: "8px 0 4px", fontSize: "20px" }}>{priorityBinsCount} Critical / {bins.length} Monitored</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#b0c4b9" }}>
                <span>&gt; 70% Overfill Alert</span>
                <b style={{ color: "#e26d5c" }}>{bins.filter(b => b.currentFillPercent > 70).length} bins</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#b0c4b9" }}>
                <span>50% - 70% Approaching Threshold</span>
                <b style={{ color: "#f39c12" }}>{bins.filter(b => b.currentFillPercent >= 50 && b.currentFillPercent <= 70).length} bins</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#b0c4b9" }}>
                <span>&lt; 50% Clear</span>
                <b style={{ color: "#85e86a" }}>{bins.filter(b => b.currentFillPercent < 50).length} bins</b>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
function ComplaintsPage() { 
  const [filter, setFilter] = useState("All"); 
  const [complaintsData, setComplaintsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = () => {
    setLoading(true);
    apiClient.get("/api/complaints")
      .then(res => setComplaintsData(res.data))
      .catch(err => {
        console.error("Failed to load complaints", err);
        toast.error("Failed to fetch complaints from server");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

  const visible = filter === "All" 
    ? complaintsData 
    : complaintsData.filter(c => norm(c.status) === norm(filter));

  return (
    <div className="page-wrap complaints-page-wrap">
      <div className="page-heading complaints-page-heading">
        <div>
          <div className="complaints-eyebrow">
            <SignalBar color="coral" /> CITIZEN RECORD / WARD AUDIT TRAIL
          </div>
          <h1>Complaint trail.</h1>
          <p>Every signal logged, assigned, and visible until it is resolved.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            onClick={fetchComplaints}
            className="outline-button small"
            title="Refresh complaints"
            style={{ height: "46px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <Link to="/citizen/report" className="complaints-report-btn">
            <CircleAlert size={20} strokeWidth={2.4} /> 
            <span>Report an issue</span>
            <ArrowUpRight size={18} strokeWidth={2.6} />
          </Link>
        </div>
      </div>

      <div className="complaints-filter-tabs">
        {["All", "Pending", "In Progress", "Resolved"].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`complaints-filter-tab ${filter === f ? "active" : ""}`}
          >
            <span>{f}</span>
            <span className="tab-count">
              {f === "All" 
                ? complaintsData.length 
                : complaintsData.filter(c => norm(c.status) === norm(f)).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#83908a" }}>
          <RefreshCw size={24} className="spin-icon" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
          <div>Loading authenticated complaints...</div>
        </div>
      ) : complaintsData.length === 0 ? (
        <div className="surface" style={{ textAlign: "center", padding: "60px 20px", color: "#83908a" }}>
          <ClipboardList size={36} style={{ margin: "0 auto 14px", opacity: 0.7 }} />
          <h3 style={{ color: "#dbe5de", marginBottom: "8px" }}>No complaints on record</h3>
          <p style={{ maxWidth: "420px", margin: "0 auto 20px" }}>
            No complaint signals match your current account scope. Click "Report an issue" above to submit a new street-level report.
          </p>
          <Link to="/citizen/report" className="lime-button" style={{ display: "inline-flex", margin: "0 auto" }}>
            Submit new signal <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="surface" style={{ textAlign: "center", padding: "40px 20px", color: "#83908a" }}>
          <p>No complaints found with status "{filter}".</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="complaints-cards-grid">
          {visible.map(c => {
            const displayId = `ST-${c.complaintId}`;
            const timeAgo = c.createdAt 
              ? new Date(c.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Recent";
            return (
              <motion.div 
                variants={rise} 
                whileHover={{ y: -6, boxShadow: "0 24px 50px rgba(16, 59, 60, 0.12)" }} 
                whileTap={{ scale: 0.99 }} 
                transition={{ type: "spring", stiffness: 400, damping: 25 }} 
                key={c.complaintId} 
                className="complaint-card-upgraded"
              >
                <div className="complaint-top-row">
                  <span className="complaint-ref-badge">{displayId}</span>
                  <Status status={c.status === "InProgress" ? "In Progress" : c.status} />
                </div>

                <h3 className="complaint-title">{c.binName || `Bin #${c.binId}`}</h3>
                <p className="complaint-note">{c.description || c.category}</p>

                <div className="complaint-meta-row">
                  <span className="meta-item"><MapPin size={16} strokeWidth={2.2} /> {c.category}</span>
                  <span className="meta-item"><Clock3 size={16} strokeWidth={2.2} /> {timeAgo}</span>
                  <span className="fill-signal-badge">{c.citizenName ? `By ${c.citizenName}` : "Citizen signal"}</span>
                </div>

                <Link to={`/citizen/complaints/${c.complaintId}`} className="complaint-action-link">
                  <span>Open complaint audit trail</span>
                  <ArrowUpRight size={19} strokeWidth={2.6} className="action-arrow-icon" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  ); 
}
function ComplaintDetail({ officer = false }: { officer?: boolean }) { 
  const { id } = useParams(); 
  const { user } = useAuth();
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchDetail = () => {
    if (!id) return;
    setLoading(true);
    apiClient.get(`/api/complaints/${id}`)
      .then(res => setComplaint(res.data))
      .catch(err => {
        console.error("Failed to load complaint detail", err);
        toast.error("Failed to load complaint record");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!complaint) return;
    const current = complaint.status;
    let nextStatus = "InProgress";
    if (current === "InProgress") nextStatus = "Resolved";
    else if (current === "Resolved") return;

    setUpdating(true);
    try {
      const res = await apiClient.put(`/api/complaints/${complaint.complaintId}/status`, { status: nextStatus });
      setComplaint(res.data);
      toast.success(`Complaint ST-${complaint.complaintId} status moved to ${nextStatus}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update complaint status";
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrap narrow" style={{ textAlign: "center", padding: "80px 20px", color: "#83908a" }}>
        <RefreshCw size={26} className="spin-icon" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
        <div>Loading complaint audit trail...</div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="page-wrap narrow" style={{ textAlign: "center", padding: "80px 20px" }}>
        <CircleAlert size={36} style={{ color: "#e26d5c", marginBottom: "12px" }} />
        <h2>Complaint record not found</h2>
        <p style={{ color: "#83908a", marginBottom: "20px" }}>Record ST-{id} could not be retrieved from the server.</p>
        <Link to={officer ? "/officer/dashboard" : "/citizen/complaints"} className="outline-button small">
          {officer ? "← Back to officer desk" : "← Back to complaints"}
        </Link>
      </div>
    );
  }

  const isOfficerOrAdmin = officer || user?.role === "WardOfficer" || user?.role === "Admin";
  const status = complaint.status === "InProgress" ? "In Progress" : complaint.status;
  const timeFormatted = complaint.createdAt 
    ? new Date(complaint.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) 
    : "Recently";

  return (
    <div className="page-wrap narrow">
      <Link to={officer ? "/officer/dashboard" : "/citizen/complaints"} className="back-link">
        {officer ? "← Back to officer desk" : "← Back to complaints"}
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow dark">
            <SignalBar color={complaint.status === "Resolved" ? "lime" : "coral"} /> 
            ST-{complaint.complaintId} / AUDIT TRAIL
          </div>
          <h1>{complaint.binName || `Bin #${complaint.binId}`}</h1>
          <p>{complaint.category} · Citizen: {complaint.citizenName || "Verified Citizen"} · Logged {timeFormatted}</p>
        </div>
        <Status status={status} />
      </div>

      <div className="detail-grid">
        <section className="surface detail-main">
          <div className="detail-photo">
            <img src="/manus-storage/safaitrack-field_adf72cdb.webp" alt="Field crew checking a bin" />
            <span><MapPin size={14} /> Ward 08, Dhaka</span>
          </div>
          <h2>{complaint.description || "Street issue reported by resident requiring ward resolution."}</h2>
          <p className="body-copy">
            This record is cryptographically tied to the citizen account and visible to ward operations, 
            dispatch teams, and field crews. The shared trail prevents street-level signals from disappearing.
          </p>
          <div className="timeline">
            {[
              [
                complaint.createdAt ? new Date(complaint.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "08:14",
                "Reported by citizen",
                `Signal entered the ward record by ${complaint.citizenName || "citizen"}.`,
                "done"
              ],
              [
                complaint.status !== "Pending" ? "Verified" : "—",
                "Assigned to Ward operations",
                "Ward desk prioritized the report for field response.",
                complaint.status !== "Pending" ? "done" : "active"
              ],
              [
                complaint.status !== "Pending" ? "In Motion" : "—",
                "Field response in motion",
                "Field collection crew notified and routed.",
                complaint.status === "InProgress" ? "active" : complaint.status === "Resolved" ? "done" : "pending"
              ],
              [
                complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
                "Resolved",
                complaint.status === "Resolved" ? "Bin cleared and verified in collection audit trail." : "Awaiting resolution confirmation.",
                complaint.status === "Resolved" ? "done" : "pending"
              ]
            ].map(([time, title, desc, state]) => (
              <div className={`timeline-item ${state}`} key={title}>
                <span className="timeline-time">{time}</span>
                <span className="timeline-dot">
                  {state === "done" ? <Check size={13}/> : state === "active" ? <i/> : ""}
                </span>
                <div>
                  <b>{title}</b>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="detail-aside">
          <div className="surface">
            <span className="overline">SERVICE CONTEXT</span>
            <div className="context-stat">
              <b>ST-{complaint.complaintId}</b>
              <span>Reference Number</span>
            </div>
            <div className="context-row">
              <span>Category</span>
              <b>{complaint.category}</b>
            </div>
            <div className="context-row">
              <span>Target Bin</span>
              <b>#{complaint.binId} - {complaint.binName}</b>
            </div>
            <div className="context-row">
              <span>Reporting Citizen</span>
              <b>{complaint.citizenName || "Citizen"}</b>
            </div>
            <div className="context-row">
              <span>Current Status</span>
              <b>{complaint.status}</b>
            </div>
          </div>

          {isOfficerOrAdmin && (
            <div className="surface officer-actions">
              <span className="overline">OFFICER ACTION</span>
              <h3>Move this record forward.</h3>
              <button 
                onClick={handleUpdateStatus} 
                disabled={updating || complaint.status === "Resolved"}
                className="lime-button full"
              >
                {updating ? (
                  "Updating status..."
                ) : complaint.status === "Pending" ? (
                  <>Start response <ArrowUpRight size={15}/></>
                ) : complaint.status === "InProgress" ? (
                  <>Mark resolved <ArrowUpRight size={15}/></>
                ) : (
                  <>Resolved <Check size={15}/></>
                )}
              </button>
              <button 
                className="outline-button full" 
                onClick={() => toast.success("Field note registered on complaint ST-" + complaint.complaintId)}
              >
                Add field note
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  ); 
}
function ReportPage() { 
  const { register, handleSubmit, reset } = useForm(); 
  const [submitted, setSubmitted] = useState(false); 
  const [createdComplaintId, setCreatedComplaintId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bins, setBins] = useState<any[]>([]);
  const [loadingBins, setLoadingBins] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient.get("/api/bins")
      .then(res => {
        if (isMounted) {
          setBins(res.data);
        }
      })
      .catch(err => {
        console.error("Failed to fetch bins for complaint reporting", err);
      })
      .finally(() => {
        if (isMounted) setLoadingBins(false);
      });
    return () => { isMounted = false; };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      toast.success(`Photo attached: ${file.name}`);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (data: any) => {
    if (!data.binId) {
      toast.error("Please select a target bin location.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        binId: parseInt(data.binId, 10),
        category: data.category,
        description: data.description || ""
      };
      const res = await apiClient.post("/api/complaints", payload);
      setCreatedComplaintId(res.data.complaintId);
      setSubmitted(true); 
      reset(); 
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success(`Complaint ST-${res.data.complaintId} submitted to ward operations`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to submit complaint";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrap narrow report-page-wrap">
      <Link to="/citizen/complaints" className="report-back-link">
        <span className="back-arrow">←</span>
        <span>Back to complaints</span>
      </Link>

      <div className="report-form-heading">
        <div className="report-eyebrow">
          <SignalBar color="coral" /> NEW CITIZEN SIGNAL
        </div>
        <h1>
          Log what the street<br />
          <em>is telling you.</em>
        </h1>
        <p>Give the ward team enough detail to act without a second phone call.</p>
      </div>

      {submitted ? (
        <div className="success-state surface">
          <div className="success-icon"><Check size={32} strokeWidth={2.6}/></div>
          <span className="overline">RECORD CREATED / ST-{createdComplaintId ?? "NEW"}</span>
          <h2>Signal received.</h2>
          <p>Your report is now visible to ward operations. We’ll keep the response trail open here.</p>
          <Link to={createdComplaintId ? `/citizen/complaints/${createdComplaintId}` : "/citizen/complaints"} className="lime-button report-success-btn">
            View response trail <ArrowUpRight size={18} strokeWidth={2.5}/>
          </Link>
        </div>
      ) : (
        <form 
          onSubmit={handleSubmit(onSubmit)} 
          className="report-form-card"
        >
          <div className="report-field-group">
            <label htmlFor="report-category">What needs attention?</label>
            <div className="report-select-wrap">
              <select id="report-category" {...register("category")}>
                <option>Overflowing bin</option>
                <option>Missed collection</option>
                <option>Damaged bin</option>
                <option>Illegal dumping</option>
              </select>
              <ChevronDown size={22} className="report-select-arrow" strokeWidth={2.4} />
            </div>
          </div>

          <div className="report-field-group">
            <label htmlFor="report-bin">Select Bin / Location</label>
            <div className="report-select-wrap">
              <select id="report-bin" {...register("binId", { required: true })} disabled={loadingBins}>
                {loadingBins ? (
                  <option value="">Loading active bins...</option>
                ) : bins.length === 0 ? (
                  <option value="">No bins available</option>
                ) : (
                  bins.map((b) => (
                    <option key={b.binId} value={b.binId}>
                      {b.name} ({b.wardName || `Ward ${b.wardId}`} · {b.currentFillPercent}% fill)
                    </option>
                  ))
                )}
              </select>
              <ChevronDown size={22} className="report-select-arrow" strokeWidth={2.4} />
            </div>
          </div>

          <div className="report-field-group">
            <label htmlFor="report-description">What did you notice?</label>
            <textarea 
              id="report-description"
              {...register("description", { required: true })} 
              rows={4} 
              placeholder="Describe the situation for the ward team…" 
            />
          </div>

          <div className="report-field-group">
            <label>Add a photo (optional)</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              style={{ display: "none" }} 
            />
            <div 
              className={`report-upload-box ${selectedFile ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            >
              {selectedFile ? (
                <div className="report-upload-preview">
                  {previewUrl && <img src={previewUrl} alt="Attached preview" className="upload-thumb" />}
                  <div className="upload-file-info">
                    <b className="upload-file-name">{selectedFile.name}</b>
                    <small className="upload-file-meta">{(selectedFile.size / 1024).toFixed(1)} KB · Attached successfully</small>
                  </div>
                  <button 
                    type="button" 
                    className="upload-remove-btn" 
                    onClick={handleRemoveFile}
                    title="Remove attached photo"
                  >
                    <X size={16} strokeWidth={2.5} /> Remove
                  </button>
                </div>
              ) : (
                <div className="report-upload-inner">
                  <div className="report-upload-icon-wrap">
                    <Camera size={26} strokeWidth={2.2} />
                  </div>
                  <div className="report-upload-text">
                    <b>Attach field photograph</b>
                    <small>JPG, PNG or WEBP up to 10MB · Click anywhere to browse</small>
                  </div>
                  <button 
                    type="button" 
                    className="report-choose-btn"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Choose file
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="report-form-actions">
            <div className="report-security-badge">
              <ShieldCheck size={20} className="shield-icon" strokeWidth={2.4} /> 
              <span>Your report is directly logged against the live bin sensor network.</span>
            </div>
            <button className="report-submit-btn" type="submit" disabled={submitting}>
              {submitting ? "Submitting signal..." : <>Submit signal <ArrowUpRight size={20} strokeWidth={2.6} /></>}
            </button>
          </div>
        </form>
      )}
    </div>
  ); 
}
function RoutePage() { 
  const { user } = useAuth();
  const [route, setRoute] = useState<any>(null);
  const [algorithm, setAlgorithm] = useState<"dijkstra" | "nearest_neighbor">("dijkstra");
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [collectingStopId, setCollectingStopId] = useState<number | null>(null);
  const [timeStr, setTimeStr] = useState("06:42:18 BST");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(getBangladeshTime().full);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLatestOrGenerate = async (algo: "dijkstra" | "nearest_neighbor" = "dijkstra") => {
    setGenerating(true);
    try {
      // First check if there's already an active or recent route for Ward 1
      const listRes = await apiClient.get("/api/routes?wardId=1");
      if (listRes.data && listRes.data.length > 0) {
        const latest = listRes.data[listRes.data.length - 1];
        // Fetch full route details with stops
        const detailRes = await apiClient.get(`/api/routes/${latest.routeId}`);
        setRoute(detailRes.data);
        setAlgorithm(detailRes.data.algorithm === "nearest_neighbor" ? "nearest_neighbor" : "dijkstra");
        return;
      }

      // If no route exists, generate a fresh one
      await handleGenerate(algo);
    } catch (err: any) {
      console.warn("Could not fetch existing route, generating new one...", err);
      if (user?.role === "Admin" || user?.role === "Driver") {
        await handleGenerate(algo);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async (algoToUse: "dijkstra" | "nearest_neighbor" = algorithm) => {
    setGenerating(true);
    try {
      const res = await apiClient.post("/api/routes/generate", {
        wardId: 1,
        algorithm: algoToUse
      });
      setRoute(res.data);
      setAlgorithm(algoToUse);
      toast.success(
        `Route #${res.data.routeId} generated with ${algoToUse === "dijkstra" ? "Dijkstra (Held-Karp DP)" : "Nearest Neighbor"}! (${res.data.totalDistanceKm} km)`
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to generate route";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchLatestOrGenerate();
  }, []);

  const handleStartRoute = async () => {
    if (!route) return;
    setActionLoading(true);
    try {
      const res = await apiClient.put(`/api/routes/${route.routeId}/start`);
      setRoute((prev: any) => ({ ...prev, status: res.data.status }));
      toast.success(`Route #${route.routeId} started! Navigation live.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to start route");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCollectStop = async (routeStopId: number) => {
    if (!route) return;
    setCollectingStopId(routeStopId);
    try {
      const res = await apiClient.put(`/api/routes/${route.routeId}/stops/${routeStopId}/collect`);
      setRoute((prev: any) => ({
        ...prev,
        orderedStops: prev.orderedStops.map((s: any) => 
          s.routeStopId === routeStopId ? { ...s, collectedAt: res.data.collectedAt } : s
        )
      }));
      toast.success(`Stop #${routeStopId} marked collected!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to mark stop as collected");
    } finally {
      setCollectingStopId(null);
    }
  };

  const handleCompleteRoute = async () => {
    if (!route) return;
    setActionLoading(true);
    try {
      const res = await apiClient.put(`/api/routes/${route.routeId}/complete`);
      setRoute((prev: any) => ({ ...prev, status: res.data.status }));
      toast.success(`Route #${route.routeId} marked Completed! Collection audit finalized.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to complete route");
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = route?.status === "InProgress";
  const isCompleted = route?.status === "Completed";
  const stopsList = route?.orderedStops || [];
  const allStopsCollected = stopsList.length > 0 && stopsList.every((s: any) => s.collectedAt !== null);

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark">
            <SignalBar color={isRunning ? "lime" : isCompleted ? "blue" : "coral"} /> 
            ROUTE ENGINE / {route ? `ROUTE #${route.routeId} (${route.status.toUpperCase()})` : "LIVE"}
          </div>
          <h1>Route in motion.</h1>
          <p>
            Priority-weighted sequence for Ward 08, powered by ASP.NET Core &amp; SQL Server.
          </p>
        </div>
        <div className="heading-actions" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Algorithm Toggle */}
          <button 
            className="outline-button"
            disabled={generating || isRunning}
            onClick={() => {
              const nextAlgo = algorithm === "dijkstra" ? "nearest_neighbor" : "dijkstra";
              handleGenerate(nextAlgo);
            }}
            title="Switch between exact Held-Karp dynamic programming and Nearest Neighbor heuristic"
          >
            <Filter size={16}/> 
            {algorithm === "dijkstra" ? "Algorithm: Dijkstra / Held-Karp" : "Algorithm: Nearest Neighbor"}
          </button>

          {/* Regenerate Button */}
          <button 
            className="outline-button"
            disabled={generating || isRunning}
            onClick={() => handleGenerate(algorithm)}
            title="Generate fresh route with current algorithm"
          >
            <RefreshCw size={16} className={generating ? "spin-icon" : ""} style={generating ? { animation: "spin 1s linear infinite" } : {}} />
            <span>{generating ? "Computing..." : "Regenerate"}</span>
          </button>

          {/* Route Lifecycle Button (Start -> Complete) */}
          {!isRunning && !isCompleted ? (
            <button 
              onClick={handleStartRoute} 
              disabled={actionLoading || !route} 
              className="lime-button"
            >
              {actionLoading ? "Starting..." : <>Start route <ArrowUpRight size={15}/></>}
            </button>
          ) : isRunning ? (
            <button 
              onClick={handleCompleteRoute} 
              disabled={actionLoading} 
              className="lime-button"
              style={{ backgroundColor: allStopsCollected ? "#2ecc71" : "#e67e22" }}
            >
              {actionLoading ? "Completing..." : <>Complete route <Check size={16}/></>}
            </button>
          ) : (
            <div className="status status-resolved" style={{ padding: "8px 16px", borderRadius: "100px" }}>
              <Check size={16} /> Route Completed
            </div>
          )}
        </div>
      </div>

      <div className="route-layout">
        <section className="surface live-map">
          <div className="map-toolbar">
            <span><i className="live-pip" style={isRunning ? { backgroundColor: "#85e86a" } : {}}/> LIVE ROUTE / DHK-08</span>
            <span>{timeStr}</span>
          </div>
          <div className="big-map">
            <img src="/manus-storage/safaitrack-ward-map_aa0dc48a.webp" alt="Ward map with route line" />
            <svg className="route-svg" viewBox="0 0 800 500" preserveAspectRatio="none">
              <path d="M80 420 C 175 270, 190 380, 305 170 S 485 150, 555 310 S 650 370, 735 90" />
            </svg>
            {stopsList.map((s: any, i: number) => {
              const leftOffsets = [12, 32, 52, 72, 86, 24, 64];
              const topOffsets = [78, 38, 58, 22, 68, 28, 82];
              const isCollected = s.collectedAt !== null;
              const tone = isCollected ? "ok" : i === 0 ? "hot" : "warn";
              return (
                <motion.div 
                  animate={{ y: isRunning && !isCollected ? [0, -5, 0] : 0 }} 
                  transition={{ repeat: isRunning && !isCollected ? Infinity : 0, duration: 1.5, delay: i * 0.2 }} 
                  className={`big-node ${tone}`} 
                  key={s.routeStopId || i} 
                  style={{
                    left: `${leftOffsets[i % leftOffsets.length]}%`,
                    top: `${topOffsets[i % topOffsets.length]}%`
                  }}
                  title={`${s.name} - Stop #${s.stopSequence}`}
                >
                  <span>{s.stopSequence || i + 1}</span>
                  <b>{s.name}</b>
                </motion.div>
              );
            })}
          </div>
          <div className="map-legend">
            <span><i className="legend-line"/> Optimized Held-Karp Path</span>
            <span><i className="legend-dot coral"/> High Fill / In Progress</span>
            <span><i className="legend-dot lime"/> Stop Collected</span>
          </div>
        </section>

        <aside className="surface stop-panel">
          <div className="surface-head">
            <div>
              <span className="overline">STOP SEQUENCE</span>
              <h2>{stopsList.length} priority stops</h2>
            </div>
            {route && (
              <span className="distance-badge">
                <Zap size={16} /> 
                {route.distanceAvoidedKm ? `${route.distanceAvoidedKm.toFixed(1)} km saved` : `${route.totalDistanceKm} km total`}
              </span>
            )}
          </div>

          <div className="stop-list">
            {stopsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#83908a" }}>
                {generating ? "Computing stops..." : "No route stops generated yet. Click Regenerate."}
              </div>
            ) : (
              stopsList.map((s: any, i: number) => {
                const isCollected = s.collectedAt !== null;
                return (
                  <div 
                    className={`stop-item ${isRunning && !isCollected && i === 0 ? "current" : ""} ${isCollected ? "completed-stop" : ""}`} 
                    key={s.routeStopId || i}
                    style={isCollected ? { opacity: 0.75, borderLeft: "3px solid #85e86a" } : {}}
                  >
                    <span className={`stop-number ${isCollected ? "ok" : "warn"}`}>
                      {String(s.stopSequence || i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1 }}>
                      <b>{s.name}</b>
                      <small>
                        {isCollected 
                          ? `Collected at ${new Date(s.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` 
                          : `Bin #${s.binId} · Sequence #${s.stopSequence}`}
                      </small>
                    </div>

                    <div className="stop-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isCollected ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#85e86a", fontSize: "12px", fontWeight: 600 }}>
                          <Check size={14} strokeWidth={3} /> Collected
                        </span>
                      ) : isRunning ? (
                        <button
                          className="lime-button small"
                          disabled={collectingStopId === s.routeStopId}
                          onClick={() => handleCollectStop(s.routeStopId)}
                          style={{ padding: "4px 10px", fontSize: "12px", height: "30px" }}
                        >
                          {collectingStopId === s.routeStopId ? "..." : "Collect"}
                        </button>
                      ) : (
                        <div className="stop-fill">
                          <strong>Pending</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="truck-status">
            <div className="truck-icon-wrap">
              <Truck size={24} strokeWidth={2.4}/>
            </div>
            <span>
              <b>DHK-METRO-SHA-9988 / Assigned Unit</b>
              <small>
                {isRunning ? "Route active · Collection in progress" : isCompleted ? "Route completed · Vehicle at depot" : "Standby · Ready for dispatch"}
              </small>
            </span>
            <span className="truck-live-dot" title="Truck status" style={isRunning ? { backgroundColor: "#85e86a" } : {}} />
          </div>
        </aside>
      </div>
    </div>
  ); 
}
function ForgotPasswordModal({ 
  isOpen, 
  onClose, 
  defaultEmail = "" 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  defaultEmail?: string; 
}) {
  const [step, setStep] = useState<"email" | "otp" | "reset" | "success">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState(["8", "4", "0", "9", "1", "2"]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timer, setTimer] = useState(119);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("email");
      setNewPassword("");
      setConfirmPassword("");
    } else if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [isOpen, defaultEmail]);

  useEffect(() => {
    let interval: any;
    if (step === "otp" && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isOpen) return null;

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setStep("otp");
      setTimer(119);
      toast.success("Security verification signal dispatched to " + email);
    }, 700);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("reset");
    toast.success("Identity confirmed. Set a new access key.");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setStep("success");
    toast.success("Access key updated successfully!");
    setTimeout(() => {
      onClose();
    }, 2400);
  };

  const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
  const seconds = String(timer % 60).padStart(2, "0");

  return (
    <AnimatePresence>
      <div className="forgot-modal-backdrop" onClick={onClose}>
        <motion.div 
          className="forgot-modal-card"
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", damping: 24, stiffness: 320 }}
        >
          {/* Animated decorative color orbs */}
          <div className="modal-glow-orbs" aria-hidden="true">
            <span className="glow-orb lime" />
            <span className="glow-orb coral" />
            <span className="glow-orb cyan" />
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>

          {step === "email" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="modal-step">
              <div className="modal-badge coral">
                <Sparkles size={14} /> SECURE KEY RECOVERY
              </div>
              <h3>Reset ward access</h3>
              <p>Enter the email address tied to your ward workspace. We’ll send an encrypted recovery signal.</p>

              <form onSubmit={handleSendCode} className="modal-form">
                <div className="input-with-icon">
                  <Mail size={16} className="field-icon" />
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@municipality.gov.bd" 
                    autoFocus
                  />
                </div>
                <button type="submit" className="lime-button full" disabled={isSending}>
                  {isSending ? "Dispatching signal..." : "Send recovery code"} <ArrowUpRight size={17} />
                </button>
              </form>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="modal-step">
              <div className="modal-badge cyan">
                <ShieldCheck size={14} /> ENTER 6-DIGIT CODE
              </div>
              <h3>Verify ward identity</h3>
              <p>We transmitted a code to <b>{email}</b>. Simulated security code auto-filled for preview:</p>

              <form onSubmit={handleVerifyOtp} className="modal-form">
                <div className="otp-digit-row">
                  {otp.map((digit, idx) => (
                    <input 
                      key={idx} 
                      type="text" 
                      maxLength={1} 
                      value={digit} 
                      onChange={e => {
                        const newOtp = [...otp];
                        newOtp[idx] = e.target.value.slice(-1);
                        setOtp(newOtp);
                      }}
                      className="otp-box"
                    />
                  ))}
                </div>

                <div className="otp-timer-row">
                  <span>Code expires in: <b>{minutes}:{seconds}</b></span>
                  <button type="button" onClick={() => { setTimer(119); toast.success("New code dispatched"); }} className="resend-link">
                    <RefreshCw size={13} /> Resend
                  </button>
                </div>

                <button type="submit" className="lime-button full">
                  Verify & Proceed <ArrowUpRight size={17} />
                </button>
              </form>
            </motion.div>
          )}

          {step === "reset" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="modal-step">
              <div className="modal-badge lime">
                <Key size={14} /> CREATE NEW KEY
              </div>
              <h3>Set new password</h3>
              <p>Choose a strong password to protect your field assignments and ward operations.</p>

              <form onSubmit={handleResetPassword} className="modal-form">
                <div className="input-with-icon">
                  <Lock size={16} className="field-icon" />
                  <input 
                    type="password" 
                    required 
                    placeholder="New password (min. 6 chars)" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="input-with-icon">
                  <Lock size={16} className="field-icon" />
                  <input 
                    type="password" 
                    required 
                    placeholder="Confirm new password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>

                {newPassword && (
                  <div className="pw-strength-bar">
                    <div className={`meter ${newPassword.length >= 8 ? "strong" : newPassword.length >= 6 ? "medium" : "weak"}`} />
                    <small>Strength: {newPassword.length >= 8 ? "Strong" : newPassword.length >= 6 ? "Medium" : "Weak"}</small>
                  </div>
                )}

                <button type="submit" className="lime-button full">
                  Update access key <Check size={17} strokeWidth={2.6} />
                </button>
              </form>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="modal-step success-step">
              <div className="success-check-orb">
                <Check size={36} strokeWidth={3} />
              </div>
              <div className="modal-badge lime">ACCESS RESTORED</div>
              <h3>Key updated successfully!</h3>
              <p>Your password has been changed. You can now use your new access key to sign in.</p>
              <button onClick={onClose} className="lime-button full">
                Return to sign in <ArrowUpRight size={17} />
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Auth({ registerMode=false }: { registerMode?:boolean }) {
  const nav = useNavigate();
  const { login: authLogin } = useAuth();
  const [role, setRole] = useState<UserRole>(() => {
    const stored = (typeof localStorage !== "undefined" ? localStorage.getItem("safaitrack_active_role") : null) as UserRole | null;
    return (stored && DEMO_PROFILES[stored]) ? stored : "Truck Driver";
  });
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [password, setPassword] = useState("Password123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mapRoleToBackend = (uiRole: string): string => {
    switch (uiRole) {
      case "Ward Officer": return "WardOfficer";
      case "Truck Driver": return "Driver";
      case "Citizen": return "Citizen";
      case "City Admin": return "Admin";
      default: return "Citizen";
    }
  };

  const handleEnter = async () => {
    setAuthError(null);
    setLoading(true);

    const emailToUse = customEmail.trim() || DEMO_PROFILES[role]?.email || "citizen@safaitrack.local";
    const nameToUse = customName.trim() || DEMO_PROFILES[role]?.name || "SafaiTrack User";
    const backendRole = mapRoleToBackend(role);

    try {
      if (registerMode) {
        const payload = {
          fullName: nameToUse,
          email: emailToUse,
          password: password,
          role: backendRole,
        };
        const res = await apiClient.post("/api/auth/register", payload);
        const { token, fullName, role: userRole } = res.data;
        authLogin(token, { fullName, email: emailToUse, role: userRole });
        toast.success(`Welcome, ${fullName}! Account created.`);
      } else {
        const payload = {
          email: emailToUse,
          password: password,
        };
        const res = await apiClient.post("/api/auth/login", payload);
        const { token, fullName, role: userRole } = res.data;
        authLogin(token, { fullName, email: emailToUse, role: userRole });
        toast.success(`Signed in as ${fullName} (${userRole})`);
      }

      localStorage.setItem("safaitrack_active_role", role);

      if (backendRole === "Citizen") {
        nav("/citizen/dashboard");
      } else if (backendRole === "Driver") {
        nav("/driver/dashboard");
      } else if (backendRole === "WardOfficer") {
        nav("/officer/dashboard");
      } else {
        nav("/home");
      }
    } catch (err: any) {
      let msg = "Authentication failed. Please check your credentials.";
      if (err.response?.status === 401) {
        msg = err.response.data?.message || "Invalid email or password.";
      } else if (err.response?.data?.errors) {
        msg = Array.isArray(err.response.data.errors)
          ? err.response.data.errors.join(" ")
          : Object.values(err.response.data.errors).flat().join(" ");
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const panelEase = [0.16, 1, 0.3, 1] as const;
  const panelVariants = {
    hidden: {
      opacity: 0,
      x: 70,
      clipPath: "inset(0% 0% 0% 100% round 20px)",
    },
    show: {
      opacity: 1,
      x: 0,
      clipPath: "inset(0% 0% 0% 0% round 20px)",
      transition: {
        duration: 0.9,
        ease: panelEase,
        staggerChildren: 0.08,
        delayChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14, x: 12 },
    show: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { duration: 0.55, ease: panelEase },
    },
  };
  
  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-top">
          <Logo />
          <div className="auth-live-badge">
            <span className="live-ping-dot" />
            <span>SYSTEM LIVE</span>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="auth-visual-copy"
        >
          <div className="eyebrow"><SignalBar /> DHAKA · CIVIC OPERATIONS LAYER</div>
          <h1>Log the signal.<br /><span className="text-lime">Move the city.</span></h1>
          <p>A shared operating layer for residents, ward officers, dispatch teams, and drivers.</p>

          <div className="auth-feature-pills">
            <div className="feature-pill">
              <span className="pill-dot lime" />
              <span>Real-time fill signals</span>
            </div>
            <div className="feature-pill">
              <span className="pill-dot cyan" />
              <span>Automated route sequencing</span>
            </div>
            <div className="feature-pill">
              <span className="pill-dot coral" />
              <span>Accountable civic response</span>
            </div>
          </div>
        </motion.div>

        <div className="auth-bottom">
          18.4 km <small>avoided in today’s model route</small>
        </div>
      </div>
      
      <div className="auth-form-wrap">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/" className="auth-back-link">
            <span className="back-arrow">←</span> 
            <b>Return to SafaiTrack</b>
          </Link>
        </motion.div>
        
        <motion.div 
          className="auth-form"
          variants={panelVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants} className="auth-header-row">
            <span className="access-layer-badge">
              <span className="access-dot" /> ACCESS LAYER
            </span>
            <div className="key-icon-box" title="Protected Access">
              <Key size={17} />
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h2>
              {registerMode ? "Join the response layer." : "Welcome back."}
              <br />
              <span className="purpose-highlight">Move with purpose.</span>
            </h2>
            <p className="auth-subtitle">
              {registerMode 
                ? "Choose how you’ll help make civic handoffs visible." 
                : "Sign in to pick up the next useful signal in your ward."}
            </p>
          </motion.div>
          
          <div className="form-fields">
            {registerMode && (
              <motion.div variants={itemVariants} className="field-group">
                <label>Your name</label>
                <div className="input-with-icon">
                  <User size={17} className="field-icon" />
                  <input 
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Kabir Hossain" 
                  />
                </div>
              </motion.div>
            )}

            <motion.div variants={itemVariants} className="field-group">
              <label>Email address</label>
              <div className="input-with-icon">
                <Mail size={17} className="field-icon" />
                <input 
                  type="email" 
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  placeholder={DEMO_PROFILES[role]?.email || "you@municipality.gov.bd"} 
                />
              </div>
            </motion.div>
            
            <motion.div variants={itemVariants} className="field-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock size={17} className="field-icon" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your access key" 
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </motion.div>

            {/* Remember me & Forgot Password */}
            <motion.div variants={itemVariants} className="auth-utility-row">
              <label className="remember-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={e => setRememberMe(e.target.checked)} 
                />
                <span className="checkbox-custom">
                  {rememberMe && <Check size={12} strokeWidth={3.5} />}
                </span>
                <span className="remember-text">Remember this device</span>
              </label>

              <button 
                type="button" 
                className="forgot-password-link"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </button>
            </motion.div>

            {/* Access as dropdown */}
            <motion.div variants={itemVariants} className="field-group">
              <label>Access as</label>
              <div className="role-selector-box" ref={roleDropdownRef}>
                <div className="role-current-display">
                  <span className="role-badge-icon">
                    {role === "Ward Officer" ? <Shield size={22} /> : role === "Truck Driver" ? <Truck size={22} /> : role === "Citizen" ? <User size={22} /> : <Sparkles size={22} />}
                  </span>
                  <span className="role-current-label">{role}</span>
                </div>
                <button 
                  type="button" 
                  className="role-select-arrow-btn"
                  onClick={() => setRoleDropdownOpen(prev => !prev)}
                  aria-label="Toggle role dropdown"
                  aria-expanded={roleDropdownOpen}
                >
                  <ChevronRight size={22} strokeWidth={2.5} className={`role-select-chevron ${roleDropdownOpen ? "open" : ""}`} />
                </button>

                <AnimatePresence>
                  {roleDropdownOpen && (
                    <motion.div 
                      className="role-dropdown-menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {([
                        { name: "Ward Officer", icon: <Shield size={20} /> },
                        { name: "Truck Driver", icon: <Truck size={20} /> },
                        { name: "Citizen", icon: <User size={20} /> },
                        { name: "City Admin", icon: <Sparkles size={20} /> },
                      ] as const).map(item => (
                        <button
                          key={item.name}
                          type="button"
                          className={`role-dropdown-item ${role === item.name ? "selected" : ""}`}
                          onClick={() => {
                            setRole(item.name as UserRole);
                            setRoleDropdownOpen(false);
                          }}
                        >
                          <span className="dropdown-item-icon">{item.icon}</span>
                          <span className="dropdown-item-text">{item.name}</span>
                          {role === item.name && <Check size={18} strokeWidth={2.8} className="dropdown-item-check" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            
            {authError && (
              <motion.div variants={itemVariants} className="auth-error-banner" style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", padding: "10px 14px", color: "#fca5a5", fontSize: "13px", marginBottom: "8px" }}>
                {authError}
              </motion.div>
            )}

            <motion.button 
              variants={itemVariants}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              onClick={handleEnter} 
              disabled={loading}
              className="lime-button full open-access-btn"
            >
              {loading ? "Authenticating..." : registerMode ? "Create access layer" : "Open access layer"} <ArrowUpRight size={22} strokeWidth={2.6}/>
            </motion.button>
          </div>
          
          <motion.div variants={itemVariants} className="civic-workspace-footer">
            <span className="workspace-line" />
            <span className="workspace-text">PROTECTED CIVIC WORKSPACE</span>
            <span className="workspace-line" />
          </motion.div>

          <motion.div variants={itemVariants} className="auth-switch">
            {registerMode ? "Already have access?" : "Need an account?"}{" "}
            <Link to={registerMode ? "/login" : "/register"}>
              {registerMode ? "Sign in" : "Register here"}
            </Link>
          </motion.div>
        </motion.div>

        <ForgotPasswordModal 
          isOpen={showForgotModal} 
          onClose={() => setShowForgotModal(false)} 
          defaultEmail={customEmail || DEMO_PROFILES[role]?.email}
        />
      </div>
    </div>
  );
}
function RoleDashboard({ kind }: {kind:"citizen"|"driver"|"officer"}) { const isDriver=kind==="driver", isCitizen=kind==="citizen"; const title=isCitizen?"Your street, visible.":isDriver?"Your route, sequenced.":"Your ward, in focus."; return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow dark"><SignalBar color={isDriver?"lime":"coral"} /> {isCitizen?"CITIZEN PORTAL":isDriver?"DRIVER CONSOLE":"WARD OFFICER DESK"}</div><h1>{title}</h1><p>{isCitizen?"See what you reported, and what is happening next.":isDriver?"The next useful stop is always clear.":"Resolve what your ward can see, without losing the trail."}</p></div><Link to={isCitizen?"/citizen/report":isDriver?"/driver/route":"/officer/complaints/ST-2408"} className="lime-button">{isCitizen?"Report an issue":isDriver?"Open assigned route":"Review priority signal"} <ArrowUpRight size={17} strokeWidth={2.4}/></Link></div><motion.div variants={rise} whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,.3)" }} whileTap={{ scale: .98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="role-hero surface"><div><span className="overline">{isCitizen?"MY SERVICE SIGNAL":"TODAY / WARD 08"}</span><h2>{isCitizen?"One open signal. One clear trail.":isDriver?"05 stops · 18.4 km avoided":"03 complaints need a handoff"}</h2><p>{isCitizen?"Your latest report from Dhanmondi Lake Road is in progress.":isDriver?"Route DHK-08 is ready from the depot. Estimated completion 07:18 BST.":"One overflow alert has been waiting 38 minutes. Start there."}</p><Link to={isCitizen?"/citizen/complaints/ST-2408":isDriver?"/driver/route":"/officer/complaints/ST-2408"} className="text-link dark">Open details <ArrowUpRight size={16} strokeWidth={2.4}/></Link></div><div className="role-orbit"><div className="orbit-ring"/><div className="orbit-core">{isCitizen?<ClipboardList size={34}/>:isDriver?<Truck size={34}/>:<ShieldCheck size={34}/>}</div><span className="orbit-tag">{isCitizen?"IN PROGRESS":isDriver?"ROUTE READY":"RESPONSE DUE"}</span></div></motion.div><div className="dashboard-grid role-grid"><section className="surface"><div className="surface-head"><div><span className="overline">RECENT ACTIVITY</span><h2>What moved today</h2></div></div>{complaints.slice(0,3).map(c=><div className="activity-row" key={c.id}><span className="activity-icon"><Check size={20} strokeWidth={2.8}/></span><div><b>{c.category}</b><small>{c.location}</small></div><Status status={c.status}/></div>)}</section><section className="surface quick-actions"><span className="overline">QUICK ACTIONS</span><h2>Keep the handoff clear.</h2>{(isCitizen?[["Report overflowing bin",CircleAlert,"/citizen/report"],["View my complaints",ClipboardList,"/citizen/complaints"]]:isDriver?[["View assigned route",Navigation,"/driver/route"],["Log collection",Check,"/driver/route"]]:[["Review complaints",ClipboardList,"/officer/dashboard"],["Open route engine",RouteIcon,"/driver/route"]]).map(([label,Icon,to])=><Link to={to as string} className="quick-link" key={label as string}><span><Icon size={22} strokeWidth={2.4}/></span><b>{label as string}</b><ArrowUpRight size={20} strokeWidth={2.6} className="action-arrow"/></Link>)}</section></div></div> }
function SettingsPage(){return <div className="page-wrap narrow"><div className="page-heading"><div><div className="eyebrow dark"><SignalBar /> WORKSPACE / SETTINGS</div><h1>System settings.</h1><p>Keep the ward workspace clear, current, and ready for the next handoff.</p></div><button className="lime-button" onClick={()=>toast.success("Workspace settings saved")}>Save changes <Check size={15}/></button></div><div className="dashboard-grid"><section className="surface"><span className="overline">WARD PROFILE</span><h2>Ward 08 / Dhanmondi</h2><div className="context-row"><span>Workspace status</span><b className="ref-link">Live model</b></div><div className="context-row"><span>Signal refresh</span><b>Every 10 minutes</b></div><div className="context-row"><span>Route engine</span><b>Dijkstra / weighted</b></div></section><section className="surface"><span className="overline">NOTIFICATIONS</span><h2>Stay close to the signal.</h2><div className="activity-row"><span className="activity-icon"><Bell size={18} strokeWidth={2.4}/></span><div><b>Overflow alerts</b><small>Receive a signal when fill level crosses 80%.</small></div><span className="status status-resolved"><span/>On</span></div><div className="activity-row"><span className="activity-icon"><ClipboardList size={18} strokeWidth={2.4}/></span><div><b>Complaint handoffs</b><small>Notify officers when a new record is assigned.</small></div><span className="status status-resolved"><span/>On</span></div></section></div></div>}
function FleetPage() {
  const { user } = useAuth();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [capacity, setCapacity] = useState("5.0");
  const [creating, setCreating] = useState(false);

  const fetchTrucks = () => {
    setLoading(true);
    apiClient.get("/api/trucks")
      .then(res => setTrucks(res.data))
      .catch(err => {
        console.error("Failed to fetch trucks", err);
        toast.error("Failed to load fleet data");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrucks();
  }, []);

  const handleCreateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      toast.error("Plate number is required");
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient.post("/api/trucks", {
        plateNumber: plateNumber.trim(),
        capacityTons: parseFloat(capacity) || 5.0,
        status: "Available"
      });
      toast.success(`Truck ${res.data.plateNumber} registered to municipal fleet!`);
      setShowAddModal(false);
      setPlateNumber("");
      fetchTrucks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create truck (Admin role required)");
    } finally {
      setCreating(false);
    }
  };

  const availableCount = trucks.filter(t => t.status === "Available").length;
  const enRouteCount = trucks.filter(t => t.status === "EnRoute" || t.status === "InProgress").length;

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><SignalBar color="lime" /> MUNICIPAL DISPATCH / FLEET CONSOLE</div>
          <h1>Collection Fleet.</h1>
          <p>Real-time vehicle status, driver pairings, and capacity tracking.</p>
        </div>
        <div className="heading-actions">
          <button onClick={fetchTrucks} className="outline-button small">
            <RefreshCw size={16} /> Refresh
          </button>
          {(user?.role === "Admin" || !user) && (
            <button onClick={() => setShowAddModal(true)} className="lime-button">
              <Truck size={16} /> Register Vehicle <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="metric-grid">
        <MetricCard label="Total fleet" value={trucks.length} detail="Registered units" icon={Truck} />
        <MetricCard label="Available" value={availableCount} detail="Ready for route assignment" icon={Check} tone="lime" />
        <MetricCard label="Active in transit" value={enRouteCount} detail="Running collection routes" icon={Navigation} tone="blue" />
        <MetricCard label="Depot coverage" value="100%" detail="Ward 08 Hub" icon={MapPin} />
      </motion.div>

      <section className="surface" style={{ marginTop: "24px" }}>
        <div className="surface-head">
          <div>
            <span className="overline">REGISTERED VEHICLES</span>
            <h2>Active fleet inventory</h2>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#83908a" }}>
            <RefreshCw size={24} className="spin-icon" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
            <div>Loading fleet inventory...</div>
          </div>
        ) : trucks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#83908a" }}>
            No trucks registered yet. Click "Register Vehicle" to add one.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle ID</th>
                  <th>License Plate</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th>Driver Assigned</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.truckId}>
                    <td><b className="ref-link">TRK-{String(t.truckId).padStart(3, "0")}</b></td>
                    <td><b>{t.plateNumber}</b></td>
                    <td>
                      <span className={`status status-${(t.status || "available").toLowerCase()}`}>
                        <span />{t.status}
                      </span>
                    </td>
                    <td>{t.capacityTons ? `${t.capacityTons} Tons` : "5.0 Tons"}</td>
                    <td>{t.assignedDriverName || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAddModal && (
        <div className="forgot-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="forgot-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <button className="modal-close-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            <div className="modal-step">
              <div className="modal-badge lime"><Truck size={14} /> NEW VEHICLE REGISTRATION</div>
              <h3>Register Collection Truck</h3>
              <p>Add a new vehicle to the municipal collection fleet database.</p>
              <form onSubmit={handleCreateTruck} className="modal-form">
                <div className="field-group">
                  <label>Plate Number</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. DHK-METRO-SHA-1234" 
                    value={plateNumber} 
                    onChange={e => setPlateNumber(e.target.value)}
                    style={{ background: "#0b2b2c", border: "1px solid #1a4d4e", color: "#fff", padding: "10px 14px", borderRadius: "8px", width: "100%" }}
                  />
                </div>
                <div className="field-group" style={{ marginTop: "12px" }}>
                  <label>Capacity (Tons)</label>
                  <input 
                    type="number" 
                    step="0.5"
                    required 
                    placeholder="5.0" 
                    value={capacity} 
                    onChange={e => setCapacity(e.target.value)}
                    style={{ background: "#0b2b2c", border: "1px solid #1a4d4e", color: "#fff", padding: "10px 14px", borderRadius: "8px", width: "100%" }}
                  />
                </div>
                <button type="submit" disabled={creating} className="lime-button full" style={{ marginTop: "18px" }}>
                  {creating ? "Registering..." : "Register truck"} <ArrowUpRight size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function NotFound(){return <div className="not-found"><Logo/><h1>That signal went quiet.</h1><Link to="/" className="lime-button">Return to system <ArrowUpRight size={15}/></Link></div>}
export default function App(){ return <AuthProvider><BrowserRouter><ScrollProgress /><Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Auth/>}/><Route path="/register" element={<Auth registerMode/>}/><Route path="/citizen/report" element={<AppShell><ReportPage/></AppShell>}/><Route path="/citizen/complaints" element={<AppShell><ComplaintsPage/></AppShell>}/><Route path="/citizen/complaints/:id" element={<AppShell><ComplaintDetail/></AppShell>}/><Route path="/driver/route" element={<AppShell><RoutePage/></AppShell>}/><Route path="/driver/dashboard" element={<AppShell><RoleDashboard kind="driver"/></AppShell>}/><Route path="/citizen/dashboard" element={<AppShell><RoleDashboard kind="citizen"/></AppShell>}/><Route path="/officer/dashboard" element={<AppShell><RoleDashboard kind="officer"/></AppShell>}/><Route path="/officer/complaints/:id" element={<AppShell><ComplaintDetail officer/></AppShell>}/><Route path="/admin/fleet" element={<AppShell><FleetPage/></AppShell>}/><Route path="/home" element={<AppShell><Overview/></AppShell>}/><Route path="/settings" element={<AppShell><SettingsPage/></AppShell>}/><Route path="*" element={<NotFound/>}/></Routes></BrowserRouter></AuthProvider> }
