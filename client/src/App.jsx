import { useRef, useState } from 'react';
import './App.css';

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:3000'
  : 'wss://video-app-z3ae.onrender.com';

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState('');
  const [incomingOffer, setIncomingOffer] = useState(null);

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
        setIncomingOffer(data);
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

  const acceptCall = async () => {
    const data = incomingOffer;
    setIncomingOffer(null);
    currentTarget.current = data.from;
    await startLocalStream();
    setupPeer();

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));

    candidateQueue.current.forEach(async candidate => {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket.send(JSON.stringify({ type: 'answer', answer, target: data.from }));
    candidateQueue.current = [];
    setStatus(`In call with ${data.from}`);
  };

  const declineCall = () => {
    setIncomingOffer(null);
    setStatus(`Call from ${incomingOffer.from} declined`);
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
    <div className='app-container'>
      <div className="glass-container">
{!loggedIn ? (
  <>
    <h2>Join the Call</h2>
    <input
      placeholder="Enter username"
      value={username}
      onChange={e => setUsername(e.target.value)}
    />
    <button onClick={handleLogin}>Login</button>
  </>
) : (
  <>
    <h3 className="status-text">Status: {status}</h3>
    <h2>Available Users</h2>
    <ul>
      {users.length === 0 && <li>No one online</li>}
      {users.map(user => (
        <li key={user} onClick={() => startCall(user)}>{user}</li>
      ))}
    </ul>
    <div className="video-area">
      <video ref={localVideo} autoPlay playsInline muted />
      <video ref={remoteVideo} autoPlay playsInline />
    </div>
  </>
)}


{incomingOffer && (
  <div className="modal">
    <p>Incoming call from <strong>{incomingOffer.from}</strong></p>
    <button onClick={acceptCall}>Accept</button>
    <button onClick={declineCall} className="decline">Decline</button>
  </div>
)}

      </div>

    </div>
  );
}

export default App;
