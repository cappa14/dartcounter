import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, RotateCcw, Settings } from "lucide-react";
import "./styles.css";
import dartboardUrl from "../assets/dartboard.png";

const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const CHECKOUTS = {
  170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull",
  160: "T20 T20 D20", 121: "T20 T11 D14", 120: "T20 20 D20", 100: "T20 D20",
  80: "T20 D10", 76: "T20 D8", 60: "20 D20", 50: "10 D20",
  40: "D20", 32: "D16", 24: "D12", 16: "D8", 8: "D4", 4: "D2", 2: "D1"
};

function emptyStats() {
  return { darts: 0, last: "-", hits: 0, misses: 0, legs: 0, totalScored: 0 };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function neededLegs(mode, length) {
  return mode === "firstto" ? length : Math.floor(length / 2) + 1;
}

function detectSegmentFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const rn = r / (rect.width / 2);
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const sector = Math.floor((angle + 9) / 18) % 20;
  const num = NUMBERS[sector];

  if (rn <= 0.045) return { label: "Bull", value: 50, num: 25, mult: 2, isBull: true };
  if (rn <= 0.095) return { label: "Outer Bull", value: 25, num: 25, mult: 1, isBull: true };
  if (rn > 0.095 && rn <= 0.405) return { label: "S" + num, value: num, num, mult: 1 };
  if (rn > 0.405 && rn <= 0.505) return { label: "T" + num, value: num * 3, num, mult: 3 };
  if (rn > 0.505 && rn <= 0.785) return { label: "S" + num, value: num, num, mult: 1 };
  if (rn > 0.785 && rn <= 0.905) return { label: "D" + num, value: num * 2, num, mult: 2 };
  return { label: "MIS", value: 0, num: null, mult: 0 };
}

function callerText(points, remaining, bust, wonLeg, wonMatch) {
  if (bust) return "BUST!";
  if (wonMatch) return "GAME SHOT AND THE MATCH!";
  if (wonLeg) return "GAME SHOT!";
  if (points === 180) return "ONE HUNDRED AND EIGHTY!";
  if (points === 140) return "ONE HUNDRED AND FORTY!";
  if (points === 100) return "ONE HUNDRED!";
  return `${points} · ${remaining} LEFT`;
}

function App() {
  const [screen, setScreen] = useState("home");
  const [caller, setCaller] = useState("GAME ON");
  const [typed, setTyped] = useState("");
  const [inputMode, setInputMode] = useState("score");

  const [matchSetup, setMatchSetup] = useState({
    players: ["", "", "", ""],
    start: 501,
    out: "double",
    mode: "bestof",
    type: "legs",
    length: 3
  });

  const [clockSetup, setClockSetup] = useState({
    players: ["", "", "", ""]
  });

  const [match, setMatch] = useState(null);
  const [clock, setClock] = useState(null);

  function go(next) {
    setScreen(next);
    setTyped("");
  }

  function startMatch() {
    const players = matchSetup.players.map(p => p.trim()).filter(Boolean);
    if (players.length < 1) {
      alert("Vul minimaal 1 speler in.");
      return;
    }

    setMatch({
      players,
      scores: players.map(() => Number(matchSetup.start)),
      stats: players.map(emptyStats),
      turn: 0,
      history: [],
      start: Number(matchSetup.start),
      out: matchSetup.out,
      darts: [],
      mode: matchSetup.mode,
      type: matchSetup.type,
      length: Number(matchSetup.length),
      legNumber: 1,
      matchWinner: null
    });

    setTyped("");
    setInputMode("score");
    setCaller("GAME ON");
    setScreen("match");
  }

  function startClock() {
    const players = clockSetup.players.map(p => p.trim()).filter(Boolean);
    if (players.length < 1) {
      alert("Vul minimaal 1 speler in.");
      return;
    }

    const sequence = [...Array(20)].map((_, i) => i + 1).concat(["Outer Bull", "Bullseye"]);
    setClock({
      players,
      sequence,
      targetIndex: players.map(() => 0),
      stats: players.map(emptyStats),
      turn: 0,
      darts: [],
      history: []
    });

    setCaller("GAME ON");
    setScreen("clock");
  }

  function processMatchScore(points, dartCount) {
    if (!match || match.matchWinner) return;
    if (points < 0 || points > 180) {
      alert("Score moet tussen 0 en 180 zijn.");
      return;
    }

    setMatch(prev => {
      const next = clone(prev);
      next.history.push(clone(prev));

      const i = next.turn;
      const newScore = next.scores[i] - points;
      let bust = false;
      let wonLeg = false;
      let wonMatch = false;

      if (newScore < 0 || (next.out === "double" && newScore === 1)) {
        bust = true;
      } else if (newScore === 0) {
        wonLeg = true;
      }

      if (!bust) {
        next.scores[i] = newScore;
        next.stats[i].last = points;
        next.stats[i].darts += dartCount;
        next.stats[i].totalScored += points;
      }

      if (wonLeg) {
        next.stats[i].legs += 1;
        const required = neededLegs(next.mode, next.length);

        if (next.stats[i].legs >= required) {
          next.matchWinner = next.players[i];
          wonMatch = true;
        } else {
          next.scores = next.players.map(() => next.start);
          next.stats = next.stats.map(s => ({ ...s, last: "-" }));
          next.legNumber += 1;
        }
      }

      next.darts = [];
      setCaller(callerText(points, next.scores[i], bust, wonLeg, wonMatch));

      if (!wonMatch) next.turn = (next.turn + 1) % next.players.length;

      return next;
    });

    setTyped("");
  }

  function submitTypedScore() {
    processMatchScore(Number(typed || 0), 3);
  }

  function addMatchDart(segment) {
    setMatch(prev => {
      if (!prev || prev.darts.length >= 3 || prev.matchWinner) return prev;
      const next = clone(prev);
      next.darts.push(segment);

      if (next.darts.length === 3) {
        const total = next.darts.reduce((sum, d) => sum + d.value, 0);
        setTimeout(() => processMatchScore(total, next.darts.length), 0);
      }

      return next;
    });
  }

  function removeLastMatchDart() {
    setMatch(prev => {
      if (!prev || !prev.darts.length) return prev;
      const next = clone(prev);
      next.darts.pop();
      return next;
    });
  }

  function submitMatchBoard() {
    if (!match || !match.darts.length) return;
    const total = match.darts.reduce((sum, d) => sum + d.value, 0);
    processMatchScore(total, match.darts.length);
  }

  function matchUndo() {
    setMatch(prev => {
      if (!prev?.history.length) return prev;
      setCaller("UNDO");
      return prev.history[prev.history.length - 1];
    });
  }

  function addClockBoardDart(segment) {
    setClock(prev => {
      if (!prev || prev.darts.length >= 3) return prev;
      const next = clone(prev);
      const target = next.sequence[next.targetIndex[next.turn]];
      let steps = 0;
      let label = segment.label;

    if (typeof target === "number" && segment.num === target) {
  steps = segment.mult;
}
      if (target === "Outer Bull" && segment.label === "Outer Bull") steps = 1;
      if (target === "Bullseye" && segment.label === "Bull") steps = 1;

      if (steps === 0 && segment.label !== "MIS") label = `${segment.label} (MIS)`;

    const previousTargetIndex = next.targetIndex[next.turn];

next.darts.push({ label, steps, previousTargetIndex });
next.targetIndex[next.turn] += steps;

return next;
    });
  }

  function submitClockTurn() {
    setClock(prev => {
      if (!prev || prev.darts.length === 0) return prev;
      const next = clone(prev);
      next.history.push(clone(prev));
      const i = next.turn;
      let totalSteps = 0;

      next.darts.forEach(d => {
        if (d.steps > 0) {
          next.stats[i].hits += 1;
          totalSteps += d.steps;
        } else {
          next.stats[i].misses += 1;
        }
        next.stats[i].darts += 1;
      });

      // next.targetIndex[i] += totalSteps;
      const target = next.sequence[next.targetIndex[i]] || "Finished";
      setCaller(target === "Finished" ? "GAME SHOT!" : `MOVING TO ${String(target).toUpperCase()}`);
      next.darts = [];
      next.turn = (next.turn + 1) % next.players.length;
      return next;
    });
  }

 function removeLastClockDart() {
  setClock(prev => {
    if (!prev || !prev.darts.length) return prev;
    const next = clone(prev);

    const removed = next.darts.pop();

    if (removed && removed.previousTargetIndex !== undefined) {
      next.targetIndex[next.turn] = removed.previousTargetIndex;
    }

    return next;
  });
}

  function clockUndo() {
    setClock(prev => {
      if (!prev?.history.length) return prev;
      setCaller("UNDO");
      return prev.history[prev.history.length - 1];
    });
  }

  const isPlaying = screen === "match" || screen === "clock";

  return (
    <main className={`app ${isPlaying ? "playing" : ""}`}>
      {screen === "home" && <Home go={go} />}
      {screen === "matchSetup" && (
        <SetupMatch setup={matchSetup} setSetup={setMatchSetup} go={go} start={startMatch} />
      )}
      {screen === "clockSetup" && (
        <SetupClock setup={clockSetup} setSetup={setClockSetup} go={go} start={startClock} />
      )}
      {screen === "match" && match && (
        <MatchScreen
          match={match}
          typed={typed}
          setTyped={setTyped}
          inputMode={inputMode}
          setInputMode={setInputMode}
          submitTypedScore={submitTypedScore}
          addDart={addMatchDart}
          removeLastDart={removeLastMatchDart}
          submitBoard={submitMatchBoard}
          undo={matchUndo}
          caller={caller}
          go={go}
        />
      )}
      {screen === "clock" && clock && (
        <ClockScreen
          clock={clock}
          addDart={addClockBoardDart}
          submitTurn={submitClockTurn}
          removeLastDart={removeLastClockDart}
          undo={clockUndo}
          caller={caller}
          go={go}
        />
      )}

      {!isPlaying && (
        <nav className="bottom-nav">
          <button onClick={() => go("home")}>🏠<span>Home</span></button>
          <button onClick={() => go("matchSetup")}>🎯<span>Wedstrijd</span></button>
          <button onClick={() => go("clockSetup")}>⏱️<span>Klok</span></button>
        </nav>
      )}
    </main>
  );
}

function Home({ go }) {
  return (
    <section className="screen">
      <header className="home-header">
        <div className="logo"><span>D</span>DartVision</div>
      </header>
      <div className="profile-card">
        <div className="avatar">D</div>
        <div>
          <h2>Spelers klaar?</h2>
          <p>Maak een wedstrijd aan of speel rond de klok</p>
        </div>
      </div>
      <div className="home-grid">
        <button className="tile orange" onClick={() => go("matchSetup")}>
          <strong>Wedstrijd</strong>
          <span>Score of dartbord</span>
        </button>
        <button className="tile blue" onClick={() => go("clockSetup")}>
          <strong>Rond de Klok</strong>
          <span>Met dartbord</span>
        </button>
      </div>
    </section>
  );
}

function SetupMatch({ setup, setSetup, go, start }) {
  function updatePlayer(index, value) {
    const players = [...setup.players];
    players[index] = value;
    setSetup({ ...setup, players });
  }

  function changeLength(delta) {
    const step = setup.mode === "bestof" ? 2 : 1;
    const min = 1;
    const max = 21;
    const next = Math.max(min, Math.min(max, setup.length + delta * step));
    setSetup({ ...setup, length: next });
  }

  return (
    <section className="screen">
      <Top title="Wedstrijd" back={() => go("home")} />

      <div className="panel">
        <h2>Spelers</h2>
        {setup.players.map((p, i) => (
          <label key={i}>
            <span>Speler {i + 1}{i > 1 ? " optioneel" : ""}</span>
            <input
              value={p}
              placeholder={i < 2 ? `Naam speler ${i + 1}` : "Naam optioneel"}
              onChange={e => updatePlayer(i, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="panel">
        <h2>Spelinstellingen</h2>

        <div className="match-settings-grid">
          <button
            className={setup.mode === "bestof" ? "active" : ""}
            onClick={() => setSetup({ ...setup, mode: "bestof", length: setup.length % 2 === 0 ? setup.length + 1 : setup.length })}
          >
            Best of
          </button>

          <div className="counter-box">
            <button onClick={() => changeLength(1)}>⌃</button>
            <strong>{setup.length}</strong>
            <button onClick={() => changeLength(-1)}>⌄</button>
          </div>

          <button
            className={setup.type === "legs" ? "active" : ""}
            onClick={() => setSetup({ ...setup, type: "legs" })}
          >
            Legs
          </button>

          <button
            className={setup.mode === "firstto" ? "active" : ""}
            onClick={() => setSetup({ ...setup, mode: "firstto" })}
          >
            First to
          </button>

        

          <button
            className={setup.type === "sets" ? "active" : ""}
            onClick={() => setSetup({ ...setup, type: "sets" })}
          >
            Sets
          </button>
        </div>

        <p className="setting-summary">
          {setup.mode === "bestof"
            ? `Best of ${setup.length} ${setup.type}`
            : `First to ${setup.length} ${setup.type}`}
        </p>
      </div>

      <div className="panel">
        <h2>Spel</h2>
        <div className="choice-row">
          {[301, 501, 701].map(score => (
            <button
              key={score}
              className={setup.start === score ? "active" : ""}
              onClick={() => setSetup({ ...setup, start: score })}
            >
              {score}
            </button>
          ))}
        </div>

        <div className="choice-row">
          <button
            className={setup.out === "straight" ? "active" : ""}
            onClick={() => setSetup({ ...setup, out: "straight" })}
          >
            Straight out
          </button>
          <button
            className={setup.out === "double" ? "active" : ""}
            onClick={() => setSetup({ ...setup, out: "double" })}
          >
            Double out
          </button>
        </div>
      </div>

      <button className="start-button" onClick={start}>Start wedstrijd</button>
    </section>
  );
}

function SetupClock({ setup, setSetup, go, start }) {
  return (
    <section className="screen">
      <Top title="Rond de Klok" back={() => go("home")} />
      <div className="panel">
        <h2>Spelers</h2>
        {setup.players.map((p, i) => (
          <label key={i}>
            <span>Speler {i + 1}{i > 0 ? " optioneel" : ""}</span>
            <input
              value={p}
              placeholder={i === 0 ? "Naam speler 1" : "Naam optioneel"}
              onChange={e => {
                const players = [...setup.players];
                players[i] = e.target.value;
                setSetup({ ...setup, players });
              }}
            />
          </label>
        ))}
      </div>
      <div className="panel">
        <h2>Regels</h2>
        <p>Je tikt op het dartbord. Alleen het juiste doel telt mee: S = +1, D = +2, T = +3.</p>
      </div>
      <button className="start-button" onClick={start}>Start rond de klok</button>
    </section>
  );
}

function MatchScreen({
  match, typed, setTyped, inputMode, setInputMode, submitTypedScore,
  addDart, removeLastDart, submitBoard, undo, caller, go
}) {
  const score = match.scores[match.turn];
  const required = neededLegs(match.mode, match.length);

  function pressKey(k) {
    if (k === "⌫") setTyped(typed.slice(0, -1));
    else if (k === "MIS") {
      setTyped("0");
      setTimeout(submitTypedScore, 0);
    } else if (typed.length < 3) setTyped(typed + String(k));
  }

  return (
    <section className="screen">
      <Top title={`${match.start}`} back={() => go("home")} right={<button onClick={undo}><RotateCcw size={18}/></button>} />

      <div className="match-info-pill">
        {match.matchWinner
          ? `${match.matchWinner} wint de wedstrijd`
          : `${match.mode === "bestof" ? "Best of" : "First to"} ${match.length} ${match.type} · Leg ${match.legNumber}`}
      </div>

      <PlayerScoreCards players={match.players} scores={match.scores} stats={match.stats} turn={match.turn} type="score" required={required} />
      <div className="caller">{caller}</div>
      {CHECKOUTS[score] && !match.matchWinner && <div className="checkout">Checkout: {CHECKOUTS[score]}</div>}

      {!match.matchWinner && (
        <>
         <div className="tabs three">
  <button className={inputMode === "score" ? "active" : ""} onClick={() => setInputMode("score")}>Score</button>
  <button className={inputMode === "board" ? "active" : ""} onClick={() => setInputMode("board")}>Dartbord</button>
  <button className={inputMode === "camera" ? "active" : ""} onClick={() => setInputMode("camera")}>Camera</button>
</div>

          {inputMode === "score" && (
            <>
              <div className="submit-bar">
                <input readOnly value={typed} placeholder="Voer score in" />
                <button onClick={submitTypedScore}>Submit</button>
              </div>
              <div className="keypad">
                {[1,2,3,4,5,6,7,8,9,"⌫",0,"MIS"].map(k => (
                  <button key={k} onClick={() => pressKey(k)}>{k}</button>
                ))}
              </div>
            </>
          )}

        {inputMode === "board" && (
  <BoardInput
    darts={match.darts}
    onBoardClick={seg => addDart(seg)}
    onRemove={removeLastDart}
    onSubmit={submitBoard}
  />
)}

{inputMode === "camera" && (
  <CameraPanel />
)}
        </>
      )}
    </section>
  );
}

function ClockScreen({ clock, addDart, submitTurn, removeLastDart, undo, caller, go }) {
  const target = clock.sequence[clock.targetIndex[clock.turn]] || "Finished";

  return (
    <section className="screen">
      <Top title="Around the Clock" back={() => go("home")} right={<button onClick={undo}><RotateCcw size={18}/></button>} />
      <PlayerScoreCards players={clock.players} clock={clock} turn={clock.turn} type="clock" />
      <h2 className="turn-title">{clock.players[clock.turn]} is aan de beurt!</h2>
      <div className="caller">{caller}</div>
      <div className="target-note">Doel: <strong>{String(target)}</strong></div>
      <BoardInput
        darts={clock.darts}
        onBoardClick={seg => addDart(seg)}
        onRemove={removeLastDart}
        onSubmit={submitTurn}
      />
    </section>
  );
}

function PlayerScoreCards({ players, scores, stats, turn, type, clock, required }) {
  return (
    <div className="two-player-cards">
      {players.map((player, i) => {
        const active = i === turn;

        if (type === "clock") {
          const target = clock.sequence[clock.targetIndex[i]] || "Done";
          const attempts = clock.stats[i].hits + clock.stats[i].misses;
          const pct = attempts ? Math.round((clock.stats[i].hits / attempts) * 100) : 0;

          return (
            <div key={player + i} className={`player-card ${active ? "active" : ""}`}>
              <div className="player-line"><span className="turn-arrow">▶</span><div className="avatar">D</div><strong>{player}</strong></div>
              <div className="target-circle">{target}</div>
              <small>DOEL</small>
              <p>Darts geraakt <b>{clock.stats[i].hits}/{attempts}</b></p>
              <p>Geraakt <b>{pct}%</b></p>
            </div>
          );
        }

        return (
          <div key={player + i} className={`player-card ${active ? "active" : ""}`}>
            <div className="player-line"><span className="turn-arrow">▶</span><div className="avatar">D</div><strong>{player}</strong></div>
            <div className="target-circle">{scores[i]}</div>
            <small>SCORE</small>
            <p>Laatste <b>{stats[i].last}</b></p>
            <p>Legs <b>{stats[i].legs}/{required}</b></p>
          </div>
        );
      })}
    </div>
  );
}

function BoardInput({ darts, onBoardClick, onRemove, onSubmit }) {
  const boardRef = useRef(null);

  function handleClick(event) {
    onBoardClick(detectSegmentFromEvent(event));
  }

  return (
    <>
      <div className="dart-log">
        {darts.length ? `${darts.map(d => d.label).join(" · ")} (${3 - darts.length} over)` : "Tik je 3 pijlen aan"}
      </div>
      <div className="real-board-wrap">
       <img src={dartboardUrl} className="real-board" alt="Dartbord" />
        <button ref={boardRef} className="board-overlay" aria-label="Klikbaar dartbord" onClick={handleClick}></button>
      </div>
      <div className="board-actions">
        <button className="grey" onClick={onRemove}>← Laatste pijl</button>
        <button className="green" onClick={onSubmit}>Submit</button>
      </div>
    </>
  );
}
}
 
function CameraPanel() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Camera staat uit");

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });

      videoRef.current.srcObject = stream;
      setStatus("Camera staat aan");
    } catch (error) {
      setStatus("Camera kon niet starten. Controleer je toestemming.");
    }
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStatus("Camera staat uit");
  }

  return (
    <div className="camera-panel">
      <video ref={videoRef} autoPlay playsInline muted className="camera-video" />

      <div className="camera-actions">
        <button className="green" onClick={startCamera}>Start camera</button>
        <button className="grey" onClick={stopCamera}>Stop</button>
      </div>

      <p>{status}</p>
      <small>Dit is nu alleen live beeld. Later koppelen we hier scoreherkenning aan.</small>
    </div>
  );
}

function Top({ title, back, right }) {
  return (
    <header className="topbar">
      <button onClick={back}><ArrowLeft size={22}/></button>
      <h1>{title}</h1>
      <div className="right-slot">{right || <Settings size={22}/>}</div>
    </header>
  );
}

createRoot(document.getElementById("root")).render(<App />);
