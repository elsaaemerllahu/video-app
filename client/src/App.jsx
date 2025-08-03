import { useEffect, useRef, useState } from 'react';

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:3000'
  : `wss://${window.location.host}`;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState('');

  const localVideo = useRef();
  const remoteVideo = useRef();
  const localStream = useRef();
  const remoteStream = useRef();
  const peerConnection = useRef();
  const candidateQueue = useRef([]);
  const currentTarget = useRef('');

  const handleLogin = () => {
    const ws = new WebSocket(SERVER_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'login', username }));
      setLoggedIn(true);
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'users') {
        setUsers(data.users.filter(u => u !== username));
      }
      if (data.type === 'offer') {
        const accept = window.confirm(`Incoming call from ${data.from}. Accept?`);
        if (!accept) return;

        currentTarget.current = data.from;
        await startLocalStream();

        setupPeer();

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        candidateQueue.current.forEach(async candidate => {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        });

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        ws.send(JSON.stringify({ type: 'answer', answer, target: data.from }));
        candidateQueue.current = [];
      }
      if (data.type === 'answer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setStatus('Call connected ✔️');

        candidateQueue.current.forEach(async candidate => {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
        candidateQueue.current = [];
      }
      if (data.type === 'candidate') {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          candidateQueue.current.push(data.candidate);
        }
      }
    };

    setSocket(ws);
  };

  const startLocalStream = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.current.srcObject = localStream.current;

    remoteStream.current = new MediaStream();
    remoteVideo.current.srcObject = remoteStream.current;
  };

  const setupPeer = () => {
    peerConnection.current = new RTCPeerConnection(config);

    peerConnection.current.ontrack = (event) => {
      remoteStream.current.addTrack(event.track);
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send(JSON.stringify({
          type: 'candidate',
          candidate: event.candidate,
          target: currentTarget.current
        }));
      }
    };

    localStream.current.getTracks().forEach(track =>
      peerConnection.current.addTrack(track, localStream.current)
    );
  };

  const startCall = async (target) => {
    currentTarget.current = target;
    await startLocalStream();
    setupPeer();

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socket.send(JSON.stringify({ type: 'offer', target, offer }));
    setStatus(`Calling ${target}...`);
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#fff', background: '#111', minHeight: '100vh' }}>
      {!loggedIn ? (
        <div>
          <h2>Start a Call</h2>
          <input
            placeholder="Enter username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <button onClick={handleLogin}>Login</button>
        </div>
      ) : (
        <div>
          <h3>Status: {status}</h3>
          <h2>Online Users</h2>
          <ul>
            {users.length === 0 && <li>No other users online</li>}
            {users.map(user => (
              <li key={user} onClick={() => startCall(user)} style={{ color: '#4f46e5', cursor: 'pointer' }}>
                {user}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '1rem', marginTop: 20 }}>
            <video ref={localVideo} autoPlay playsInline muted style={{ width: '45%' }} />
            <video ref={remoteVideo} autoPlay playsInline style={{ width: '45%' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
