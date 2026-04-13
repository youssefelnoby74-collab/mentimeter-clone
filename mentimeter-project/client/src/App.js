import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import QRCode from "react-qr-code";

const BACKEND_URL = "https://mentimeter-backend-h4zt.onrender.com";
const socket = io(BACKEND_URL);

function getVoterId() {
  let voterId = localStorage.getItem("voterId");

  if (!voterId) {
    voterId = "voter_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("voterId", voterId);
  }

  return voterId;
}

function App() {
  const [page, setPage] = useState("home");

  const [question, setQuestion] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinedQuestion, setJoinedQuestion] = useState("");
  const [joinedOptions, setJoinedOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [showOnlyResults, setShowOnlyResults] = useState(false);

  const [isHostPage, setIsHostPage] = useState(false);
  const [hostCode, setHostCode] = useState("");
  const [hostQuestion, setHostQuestion] = useState("");
  const [hostOptions, setHostOptions] = useState([]);
  const [hostResults, setHostResults] = useState([]);

  const voterId = getVoterId();
  const frontendUrl = window.location.origin;

  const qrLink = sessionId ? `${frontendUrl}?code=${sessionId}` : "";
  const hostLink = sessionId ? `${frontendUrl}/host?code=${sessionId}` : "";

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (path === "/host") {
      setIsHostPage(true);
      setHostCode(code || "");
    } else if (code) {
      setPage("join");
      setJoinCode(code);
    }
  }, []);

  const createSession = async () => {
    if (!question || !option1 || !option2) {
      setMessage("Fill all fields");
      return;
    }

    try {
      setMessage("Creating...");

      const res = await fetch(`${BACKEND_URL}/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          options: [option1, option2]
        })
      });

      const data = await res.json();

      setSessionId(data.sessionId);
      setMessage("Session created");
    } catch {
      setMessage("Server waking up, try again");
    }
  };

  const joinSession = useCallback(() => {
    setShowOnlyResults(false);
    setHasVoted(false);

    socket.emit("join_session", {
      sessionId: joinCode,
      voterId
    });
  }, [joinCode, voterId]);

  const submitVote = () => {
    socket.emit("submit_answer", {
      sessionId: joinCode,
      answer: selectedOption,
      voterId
    });
  };

  useEffect(() => {
    socket.on("session_data", (data) => {
      if (isHostPage) {
        setHostQuestion(data.question);
        setHostOptions(data.options);
        setHostResults(data.answers);
      } else {
        setJoined(true);
        setJoinedQuestion(data.question);
        setJoinedOptions(data.options);
        setResults(data.answers);
      }
    });

    socket.on("update_results", (data) => {
      if (isHostPage) setHostResults(data);
      else setResults(data);
    });

    socket.on("vote_success", () => {
      setHasVoted(true);
      setTimeout(() => {
        setShowOnlyResults(true);
      }, 800);
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
    };
  }, [isHostPage]);

  const countResults = (opts, answers) => {
    const counts = {};
    answers.forEach((a) => {
      counts[a] = (counts[a] || 0) + 1;
    });

    return opts.map((o) => ({
      name: o,
      percent: Math.round(((counts[o] || 0) / (answers.length || 1)) * 100)
    }));
  };

  const participantResults = countResults(joinedOptions, results);
  const hostResultsData = countResults(hostOptions, hostResults);

  if (isHostPage) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Live Results</h1>
        <h2>{hostQuestion}</h2>

        {hostResultsData.map((r, i) => (
          <div key={i}>
            {r.name} - {r.percent}%
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 30 }}>
      {page === "home" && (
        <>
          <button onClick={() => setPage("create")}>Create</button>
          <button onClick={() => setPage("join")}>Join</button>
        </>
      )}

      {page === "create" && (
        <>
          <input placeholder="Question" onChange={(e) => setQuestion(e.target.value)} />
          <input placeholder="Option 1" onChange={(e) => setOption1(e.target.value)} />
          <input placeholder="Option 2" onChange={(e) => setOption2(e.target.value)} />

          <button onClick={createSession}>Create</button>

          {sessionId && (
            <>
              <p>{sessionId}</p>
              <QRCode value={qrLink} />
              <a href={hostLink} target="_blank">Host Screen</a>
            </>
          )}
        </>
      )}

      {page === "join" && (
        <>
          <input onChange={(e) => setJoinCode(e.target.value)} />
          <button onClick={joinSession}>Join</button>

          {joined && (
            <>
              {!showOnlyResults && (
                <>
                  <h3>{joinedQuestion}</h3>

                  {joinedOptions.map((o, i) => (
                    <button key={i} onClick={() => setSelectedOption(o)}>
                      {o}
                    </button>
                  ))}

                  <button onClick={submitVote}>Submit</button>
                </>
              )}

              {showOnlyResults && <p>Thanks! Showing results...</p>}

              <h3>Results</h3>
              {participantResults.map((r, i) => (
                <div key={i}>
                  {r.name} - {r.percent}%
                </div>
              ))}
            </>
          )}
        </>
      )}

      <p>{message}</p>
    </div>
  );
}

export default App;