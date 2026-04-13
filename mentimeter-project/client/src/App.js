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
  const [showOnlyResults, setShowOnlyResults] = useState(false);

  const [isHostPage, setIsHostPage] = useState(false);
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

      if (code) {
        loadHostSession(code);
      }
    } else if (code) {
      setPage("join");
      setJoinCode(code);
    }
  }, []);

  const createSession = async () => {
    if (!question.trim() || !option1.trim() || !option2.trim()) {
      setMessage("Please fill all fields");
      return;
    }

    try {
      setMessage("Creating session...");

      const res = await fetch(`${BACKEND_URL}/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          options: [option1, option2]
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to create session");
        return;
      }

      setSessionId(data.sessionId);
      setMessage("Session created successfully");
    } catch (error) {
      console.error(error);
      setMessage("Server is waking up. Please try again.");
    }
  };

  const joinSession = useCallback(() => {
    if (!joinCode.trim()) {
      setMessage("Please enter session code");
      return;
    }

    setShowOnlyResults(false);
    setJoined(false);
    setSelectedOption("");
    setResults([]);

    socket.emit("join_session", {
      sessionId: joinCode.trim(),
      voterId
    });
  }, [joinCode, voterId]);

  const submitVote = () => {
    if (!selectedOption) {
      setMessage("Please select an answer");
      return;
    }

    socket.emit("submit_answer", {
      sessionId: joinCode.trim(),
      answer: selectedOption,
      voterId
    });
  };

  const loadHostSession = async (code) => {
    try {
      const res = await fetch(`${BACKEND_URL}/session/${code}`);
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Host session not found");
        return;
      }

      setHostQuestion(data.question);
      setHostOptions(data.options || []);
      setHostResults(data.answers || []);

      socket.emit("join_session", {
        sessionId: code,
        voterId: `host_${code}`
      });
    } catch (error) {
      console.error(error);
      setMessage("Failed to load host session");
    }
  };

  useEffect(() => {
    socket.on("session_data", (data) => {
      if (isHostPage) {
        setHostQuestion(data.question);
        setHostOptions(data.options || []);
        setHostResults(data.answers || []);
      } else {
        setJoined(true);
        setJoinedQuestion(data.question);
        setJoinedOptions(data.options || []);
        setResults(data.answers || []);
      }
    });

    socket.on("update_results", (data) => {
      if (isHostPage) {
        setHostResults(data);
      } else {
        setResults(data);
      }
    });

    socket.on("vote_success", () => {
      setMessage("Vote submitted successfully");

      setTimeout(() => {
        setShowOnlyResults(true);
      }, 800);
    });

    socket.on("vote_error", (msg) => {
      setMessage(msg);
    });

    socket.on("join_error", (msg) => {
      setMessage(msg);
    });

    return () => {
      socket.off("session_data");
      socket.off("update_results");
      socket.off("vote_success");
      socket.off("vote_error");
      socket.off("join_error");
    };
  }, [isHostPage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!isHostPage && page === "join" && code && joinCode === code && !joined) {
      joinSession();
    }
  }, [page, joinCode, joined, joinSession, isHostPage]);

  const countResults = (optionsList, answersList) => {
    const counts = {};

    answersList.forEach((answer) => {
      counts[answer] = (counts[answer] || 0) + 1;
    });

    return optionsList.map((option) => ({
      name: option,
      percent: Math.round(((counts[option] || 0) / (answersList.length || 1)) * 100)
    }));
  };

  const participantResults = countResults(joinedOptions, results);
  const hostResultsData = countResults(hostOptions, hostResults);

  if (isHostPage) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Live Results</h1>
        <h2>{hostQuestion}</h2>

        {hostResultsData.map((item, index) => (
          <div key={index}>
            {item.name} - {item.percent}%
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
          <input
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <input
            placeholder="Option 1"
            value={option1}
            onChange={(e) => setOption1(e.target.value)}
          />
          <input
            placeholder="Option 2"
            value={option2}
            onChange={(e) => setOption2(e.target.value)}
          />

          <button onClick={createSession}>Create</button>

          {sessionId && (
            <>
              <p>Code: {sessionId}</p>
              <QRCode value={qrLink} />
              <div style={{ marginTop: 12 }}>
                <a href={hostLink} target="_blank" rel="noreferrer">
                  Host Screen
                </a>
              </div>
            </>
          )}
        </>
      )}

      {page === "join" && (
        <>
          <input
            placeholder="Enter code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button onClick={joinSession}>Join</button>

          {joined && (
            <>
              {!showOnlyResults && (
                <>
                  <h3>{joinedQuestion}</h3>

                  {joinedOptions.map((option, index) => (
                    <button key={index} onClick={() => setSelectedOption(option)}>
                      {option}
                    </button>
                  ))}

                  <button onClick={submitVote}>Submit</button>
                </>
              )}

              {showOnlyResults && <p>Thanks! Showing results...</p>}

              <h3>Results</h3>
              {participantResults.map((item, index) => (
                <div key={index}>
                  {item.name} - {item.percent}%
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