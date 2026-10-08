"use client";

/**
 * Full-screen launch reveal — visual + timings from exports/launch-reveal/reference.html.
 * Automatic playback (no Skip/Next/Replay). Order saves via POST /api/orders.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LAUNCH_PACKS,
  markLaunchRevealSeen,
} from "@/lib/launchReveal";
import "./launch-reveal.css";

const DUR: (number | null)[] = [30000, 6500, 10000, 7500, 16500, null];
const SYM = ["", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const CYC = 10;
/** Slower, readable reel spins (reject prices). */
const SPIN_BASE_MS = 1700;
const SPIN_STAGGER_MS = 380;
const SPIN_LOOPS = 2;
/** Final ₹499 — longer settle so digits read clearly. */
const FINAL_SPIN_BASE_MS = 2600;
const FINAL_SPIN_STAGGER_MS = 420;
const FINAL_SPIN_LOOPS = 4;
const REJECT_GAP_MS = 3000;

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

type Props = { onDone: () => void };

export function LaunchReveal({ onDone }: Props) {
  const router = useRouter();
  const reduceRef = useRef(false);
  const [scene, setScene] = useState(0);
  const [countText, setCountText] = useState("00:30");
  const [countClass, setCountClass] = useState("");
  const [pnote, setPnote] = useState("सुरक्षा की कीमत क्या हो?");
  const [slotWin, setSlotWin] = useState(false);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotLand, setSlotLand] = useState(false);
  const [xShow, setXShow] = useState(false);
  const [lockShow, setLockShow] = useState(false);
  const [commaHide, setCommaHide] = useState(false);
  const [reel0Gone, setReel0Gone] = useState(false);
  const [leverPull, setLeverPull] = useState(false);
  const [sweepGo, setSweepGo] = useState(false);
  const [sel, setSel] = useState<{ p: string; v: number }>({
    p: LAUNCH_PACKS[0].id,
    v: LAUNCH_PACKS[0].price,
  });
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      r: number;
      amb?: number;
    }[]
  >([]);
  const rafRef = useRef<number | null>(null);
  const reelPos = useRef([0, 0, 0, 0]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sceneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSlotTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const clearTimers = () => {
    clearSlotTimers();
    if (sceneTimer.current) clearTimeout(sceneTimer.current);
    if (cdTimer.current) clearInterval(cdTimer.current);
  };

  const sizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
  }, []);

  const burst = useCallback(() => {
    if (reduceRef.current) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width;
    const H = cv.height;
    for (let k = 0; k < 140; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = (1 + Math.random() * 5) * dpr;
      partsRef.current.push({
        x: W / 2,
        y: H * 0.42,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2 * dpr,
        life: 1,
        r: (1 + Math.random() * 2.4) * dpr,
      });
    }
  }, []);

  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    sizeCanvas();
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);
    const cv = canvasRef.current;
    const cx = cv?.getContext("2d");
    const dpr = () => window.devicePixelRatio || 1;
    const loop = () => {
      if (!cx || !cv) return;
      cx.clearRect(0, 0, cv.width, cv.height);
      if (!reduceRef.current && Math.random() < 0.25) {
        partsRef.current.push({
          x: Math.random() * cv.width,
          y: cv.height + 5,
          vx: 0,
          vy: -(0.3 + Math.random() * 0.8) * dpr(),
          life: 1,
          r: (0.6 + Math.random() * 1.4) * dpr(),
          amb: 1,
        });
      }
      const parts = partsRef.current;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (!p.amb) {
          p.vy += 0.06 * dpr();
          p.vx *= 0.985;
          p.life -= 0.012;
        } else p.life -= 0.004;
        cx.globalAlpha = Math.max(0, p.life);
        cx.fillStyle = p.amb ? "#B8860B" : "#F2D060";
        cx.beginPath();
        cx.arc(p.x, p.y, p.r, 0, 7);
        cx.fill();
      }
      partsRef.current = parts.filter((p) => p.life > 0 && p.y < cv.height + 20);
      rafRef.current = requestAnimationFrame(loop);
    };
    if (!reduceRef.current) rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimers();
    };
  }, [sizeCanvas]);

  // Build reel strips once
  useEffect(() => {
    stripRefs.current.forEach((st) => {
      if (!st || st.childElementCount) return;
      let h = "";
      for (let c = 0; c < CYC; c++)
        SYM.forEach((x) => {
          h += `<span>${x || "&nbsp;"}</span>`;
        });
      st.innerHTML = h;
    });
  }, []);

  const setReel = (ri: number, sym: string, ms: number, spins: number) => {
    const st = stripRefs.current[ri];
    const reel = reelRefs.current[ri];
    if (!st || !reel) return;
    const H = reel.getBoundingClientRect().height || 80;
    const idx = Math.max(0, SYM.indexOf(sym));
    // Snap to a clean cycle start so digits stay sharp (no blue compositor smear)
    const base = reelPos.current[ri] % SYM.length;
    st.style.transition = "none";
    st.style.filter = "none";
    st.style.transform = `translate3d(0, ${-base * H}px, 0)`;
    void st.offsetHeight;
    const target = spins * SYM.length + idx;
    reelPos.current[ri] = target;
    // Fast start → soft settle (readable stop, no overshoot blur)
    st.style.transition = `transform ${ms}ms cubic-bezier(0.12, 0.75, 0.18, 1)`;
    st.style.transform = `translate3d(0, ${-target * H}px, 0)`;
  };

  const spinTo = (
    val: string,
    at: number,
    opts?: { final?: boolean }
  ) => {
    const reduce = reduceRef.current;
    const final = !!opts?.final;
    const baseMs = final ? FINAL_SPIN_BASE_MS : SPIN_BASE_MS;
    const stag = final ? FINAL_SPIN_STAGGER_MS : SPIN_STAGGER_MS;
    const loops = final ? FINAL_SPIN_LOOPS : SPIN_LOOPS;
    const d = val.padStart(4, " ").split("").map((c) => (c === " " ? "" : c));
    const longest = reduce ? 40 : baseMs + 3 * stag;
    timers.current.push(
      setTimeout(() => {
        setSlotSpinning(true);
        setSlotLand(false);
        setLeverPull(false);
        requestAnimationFrame(() => setLeverPull(true));
        d.forEach((sym, k) =>
          setReel(
            k,
            sym,
            reduce ? 40 : baseMs + k * stag,
            reduce ? 0 : loops + k
          )
        );
        // Collapse thousands reel after first reel has mostly settled
        timers.current.push(
          setTimeout(() => {
            setReel0Gone(d[0] === "");
            setCommaHide(d[0] === "");
          }, reduce ? 40 : Math.round(baseMs * 0.72))
        );
        timers.current.push(
          setTimeout(() => {
            setSlotSpinning(false);
            if (final) setSlotLand(true);
          }, longest)
        );
      }, at)
    );
    return longest;
  };

  const runSlot = useCallback(() => {
    clearSlotTimers();
    setSlotWin(false);
    setSlotSpinning(false);
    setSlotLand(false);
    setLockShow(false);
    setXShow(false);
    setReel0Gone(false);
    setCommaHide(false);
    setPnote("सुरक्षा की कीमत क्या हो?");
    const steps: [string, string][] = [
      ["2999", "Not ₹2,999…"],
      ["1999", "Not even ₹1,999…"],
      ["999", "Not ₹999…"],
    ];
    const gap = REJECT_GAP_MS;
    const rejectSpinMs = SPIN_BASE_MS + 3 * SPIN_STAGGER_MS;
    steps.forEach(([v, cap], k) => {
      spinTo(v, 400 + k * gap);
      timers.current.push(
        setTimeout(() => {
          setPnote(cap);
          setXShow(false);
          requestAnimationFrame(() => setXShow(true));
        }, 400 + k * gap + rejectSpinMs + 80)
      );
    });
    const finalAt = 400 + 3 * gap;
    const finalMs = spinTo("499", finalAt, { final: true });
    timers.current.push(
      setTimeout(() => {
        setPnote("Launch price: just ₹499 per card · सिर्फ़ ₹499");
        setSlotWin(true);
        setLockShow(true);
        burst();
        burst();
      }, finalAt + finalMs + 220)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);

  const goHome = useCallback(() => {
    markLaunchRevealSeen();
    onDone();
    router.replace("/");
  }, [onDone, router]);

  // Scene machine
  useEffect(() => {
    clearTimers();
    setSweepGo(false);
    requestAnimationFrame(() => {
      if (scene > 0 && !reduceRef.current) setSweepGo(true);
    });
    if (scene === 0) {
      const end = Date.now() + (DUR[0] || 30000);
      const tick = () => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        const t = "00:" + String(left).padStart(2, "0");
        setCountText(t);
        setCountClass(left <= 10 ? "final10" : "tick");
        if (left <= 0 && cdTimer.current) clearInterval(cdTimer.current);
      };
      tick();
      cdTimer.current = setInterval(tick, 200);
    }
    if (scene === 1) burst();
    if (scene === 4) runSlot();
    const ms = DUR[scene];
    if (ms) {
      sceneTimer.current = setTimeout(() => setScene((s) => s + 1), ms);
    }
    return () => clearTimers();
  }, [scene, burst, runSlot]);

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");
    const form = e.target as HTMLFormElement;
    const name = (form.querySelector("#o-name") as HTMLInputElement).value.trim();
    const phone = (form.querySelector("#o-phone") as HTMLInputElement).value.trim();
    const address = (
      form.querySelector("#o-addr") as HTMLTextAreaElement
    ).value.trim();
    const miss: string[] = [];
    if (!name) miss.push("name");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)))
      miss.push("a valid 10-digit mobile");
    if (address.length < 10) miss.push("full address");
    if (miss.length) {
      setErr("Please add " + miss.join(", ") + ".");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          pack: sel.p,
          quantity: qty,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        order_id?: string;
      };
      if (!r.ok || !j.ok) {
        setErr(j.error || "Could not place order. Please try again.");
        return;
      }
      setOk(
        `Order received (${j.order_id}). Our team will call ${phone} to confirm payment and delivery.`
      );
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ks-launch-root" role="dialog" aria-modal="true" aria-label="KavachSaathi launch reveal">
      <div id="stage" aria-live="polite">
        <canvas id="fx" ref={canvasRef} aria-hidden="true" />
        <div className={`sweep${sweepGo ? " go" : ""}`} aria-hidden="true" />

        {/* 0 COUNTDOWN */}
        <section className={`scene center${scene === 0 ? " on" : ""}`} id="s0">
          <div className="wrap">
            <div className="kicker">Launching in</div>
            <div className={`count ${countClass}`}>{countText}</div>
            <div className="cd-sub">
              KavachSaathi · Smart Health Card
              <span className="hi">लॉन्च होने में बस कुछ पल</span>
            </div>
          </div>
        </section>

        {/* 1 REVEAL */}
        <section className={`scene center${scene === 1 ? " on" : ""}`} id="s1">
          <div className="wrap">
            <div className="shield-wrap">
              <div className="rings" aria-hidden="true">
                <i /><i /><i />
              </div>
              <svg className="shield" viewBox="0 0 200 230" aria-label="KavachSaathi shield">
                <defs>
                  <linearGradient id="ksg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#F9E39A" />
                    <stop offset=".55" stopColor="#E8BF3E" />
                    <stop offset="1" stopColor="#B8860B" />
                  </linearGradient>
                </defs>
                <path className="fill" fill="url(#ksg)" d="M100 8 L186 44 V112 C186 165 148 201 100 222 C52 201 14 165 14 112 V44 Z" />
                <path className="s" d="M100 8 L186 44 V112 C186 165 148 201 100 222 C52 201 14 165 14 112 V44 Z" />
                <path className="ekg" d="M34 118 H70 L82 84 L98 150 L112 96 L122 132 L130 118 H166" />
              </svg>
            </div>
            <div className="word">
              Kavach<span>Saathi</span>
            </div>
            <div className="sub">SMART HEALTH CARD</div>
            <div className="tag">
              Because every second counts when it matters most.
              <span className="hi">मुश्किल घड़ी में हर पल कीमती है।</span>
            </div>
            <div className="live">NOW LIVE · 11 OCTOBER 2026</div>
          </div>
        </section>

        {/* 2 LEGACY */}
        <section className={`scene${scene === 2 ? " on" : ""}`} id="s2">
          <div className="wrap">
            <div className="kicker">Our roots</div>
            <h2>
              Five Brothers, <span className="g">One Legacy</span>
            </h2>
            <div className="h2hi hi">पाँच भाई, एक विरासत</div>
            <div className="pin">
              Bhirdana · Fatehabad · Haryana{" "}
              <span className="hi">भिरडाना · फतेहाबाद</span>
            </div>
            <div className="bros">
              {[
                ["G", "Shri Gangadhar", "श्री गंगाधर बजाज", true],
                ["B", "Shri Bansi Dhar", "श्री बंसी धर बजाज", false],
                ["S", "Shri Surender", "श्री सुरेंदर बजाज", false],
                ["N", "Shri Narender", "श्री नरेंदर बजाज", false],
                ["P", "Shri Pawan", "श्री पवन बजाज", false],
              ].map(([m, n, nh, first]) => (
                <div key={String(n)} className={`bro${first ? " first" : ""}`}>
                  <div className="m">{m}</div>
                  <div className="n">{n}</div>
                  <div className="s">BAJAJ</div>
                  <div className="nh">{nh}</div>
                </div>
              ))}
            </div>
            <p className="story">
              Our story begins in Bhirdana, a village in Fatehabad, Haryana. Five
              brothers whose lives were built on hard work, honesty and standing
              by one another.
              <span className="hi">
                हमारी कहानी फतेहाबाद के गाँव भिरडाना से शुरू होती है — पाँच भाई,
                जिनकी ज़िंदगी मेहनत, ईमानदारी और एक-दूसरे के साथ पर बनी।
              </span>
            </p>
            <div className="dedi">
              Dedicated to the memory of Shri Gangadhar Bajaj.
              <span className="hi">श्री गंगाधर बजाज जी की याद को समर्पित।</span>
            </div>
          </div>
        </section>

        {/* 3 LEADERSHIP */}
        <section className={`scene${scene === 3 ? " on" : ""}`} id="s3">
          <div className="wrap">
            <div className="kicker">Leadership</div>
            <h2>
              Our <span className="g">Leadership</span>
            </h2>
            <div className="h2hi hi">हमारा नेतृत्व</div>
            <div className="leaders">
              <div className="ld">
                <div className="av">SM</div>
                <div>
                  <div className="nm">Saurabh Mehta</div>
                  <div className="rl">Co-Founder, CEO &amp; Director</div>
                  <p>
                    Leads the company&apos;s vision and operations, with a
                    commitment to making emergency health information simple and
                    accessible for every family.
                  </p>
                </div>
              </div>
              <div className="ld">
                <div className="av">JM</div>
                <div>
                  <div className="nm">Jyoti Mehta</div>
                  <div className="rl">Co-Founder &amp; Director</div>
                  <p>
                    Guides the company&apos;s community outreach and values,
                    ensuring every product we build serves people with care,
                    dignity and trust.
                  </p>
                </div>
              </div>
            </div>
            <div className="by">
              Presented by <b>GDM Technoworld Pvt. Ltd.</b> · Fatehabad, Haryana
            </div>
          </div>
        </section>

        {/* 4 PRICE — SLOT MACHINE */}
        <section className={`scene center${scene === 4 ? " on" : ""}`} id="s4">
          <div className="wrap">
            <div className="kicker">Launch price reveal</div>
            <h2>
              What should <span className="g">safety</span> cost?
            </h2>
            <div className="pnote">{pnote}</div>
            <div
              className={`slot${slotWin ? " win" : ""}${slotSpinning ? " spinning" : ""}${slotLand ? " land" : ""}`}
              id="slot"
            >
              <div className="bulbs" aria-hidden="true" />
              <div className="slot-top">KAVACH · JACKPOT</div>
              <div className="window">
                <span className="cur">₹</span>
                <div
                  className={`reel${reel0Gone ? " gone" : ""}`}
                  ref={(el) => {
                    reelRefs.current[0] = el;
                  }}
                >
                  <div
                    className="strip"
                    ref={(el) => {
                      stripRefs.current[0] = el;
                    }}
                  />
                </div>
                <span
                  className="comma"
                  style={{ opacity: commaHide ? 0 : 1 }}
                  aria-hidden="true"
                >
                  ,
                </span>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="reel"
                    ref={(el) => {
                      reelRefs.current[i] = el;
                    }}
                  >
                    <div
                      className="strip"
                      ref={(el) => {
                        stripRefs.current[i] = el;
                      }}
                    />
                  </div>
                ))}
                <div className={`x${xShow ? " show" : ""}`} aria-hidden="true">
                  ✕
                </div>
                <div className="glass" aria-hidden="true" />
              </div>
              <div
                className={`lever${leverPull ? " pull" : ""}`}
                aria-hidden="true"
              >
                <i />
              </div>
            </div>
            <div className={`lock${lockShow ? " show" : ""}`}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                aria-hidden="true"
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              LAUNCH PRICE LOCKED · ₹499
            </div>
          </div>
        </section>

        {/* 5 ORDER */}
        <section className={`scene${scene === 5 ? " on" : ""}`} id="s5">
          <div className="wrap">
            <div className="kicker">Now open</div>
            <h2>
              KavachSaathi is <span className="g">now live</span>
            </h2>
            <div className="h2hi hi">कवचसाथी अब लाइव है — अपना पैक चुनें</div>
            <div className="packs" id="packs">
              {LAUNCH_PACKS.map((p) => (
                <button
                  key={p.id}
                  className={`pack${p.best ? " best" : ""}`}
                  type="button"
                  aria-pressed={sel.p === p.id}
                  onClick={() => setSel({ p: p.id, v: p.price })}
                >
                  <span className="pn">{p.label}</span>
                  <span className="pc">{p.cards}</span>
                  <span className="pr">{fmt(p.price)}</span>
                  <span className="pp">
                    {p.save > 0 ? `Save ₹${p.save}` : "\u00a0"}
                  </span>
                </button>
              ))}
            </div>
            <form id="order" onSubmit={submitOrder} noValidate>
              <label>
                Name
                <input id="o-name" autoComplete="name" placeholder="Your full name" />
              </label>
              <label>
                Mobile
                <input
                  id="o-phone"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                />
              </label>
              <label className="full">
                Delivery address
                <textarea
                  id="o-addr"
                  placeholder="House, street, city, PIN code"
                />
              </label>
              <label>
                Selected pack
                <input
                  id="o-pack"
                  readOnly
                  value={`${sel.p} · ${fmt(sel.v)}`}
                />
              </label>
              <label>
                Quantity
                <select
                  id="o-qty"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              {err ? <div className="err">{err}</div> : null}
              <button className="cta" type="submit" id="o-btn" disabled={busy}>
                {busy ? "Sending…" : `Order now · ${fmt(sel.v * qty)}`}
              </button>
              {ok ? <div className="ok">{ok}</div> : null}
            </form>
            <button type="button" className="home" onClick={goHome}>
              Go to Home Page <span aria-hidden="true">→</span>
              <span className="hi">होम पेज पर जाएँ</span>
            </button>
            <div className="help">
              Already have a card? Scan the QR on its back to activate. · Helpline{" "}
              <b>+91 72730 00075</b> · <b>+91 73001 00102</b>
            </div>
          </div>
        </section>

        <div className="dots" id="dots" hidden={scene === 5} aria-hidden="true">
          {DUR.map((_, i) => (
            <i key={i}>
              <b
                style={{
                  transform: i < scene ? "scaleX(1)" : i === scene ? "scaleX(1)" : "scaleX(0)",
                  transition:
                    i === scene && DUR[i]
                      ? `transform ${DUR[i]}ms linear`
                      : "none",
                }}
              />
            </i>
          ))}
        </div>
      </div>
    </div>
  );
}
