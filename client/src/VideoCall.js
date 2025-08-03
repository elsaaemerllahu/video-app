import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://video-app-z3ae.onrender.com'); // your deployed backend URL

const VideoCall = () => {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [callStarted, setCallStarted] = useState(false);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerConnection = useRef(null);

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  useEffect(() => {
    if (!joined) return;

    socket.emit('join', roomId);

    socket.on('offer', async (offer) => {
      peerConnection.current = createPeerConnection();
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
      localVideo.current.srcObject = stream;

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    });

    socket.on('answer', async (answer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', async (candidate) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
    };
  }, [joined, roomId]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { roomId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    return pc;
  };

  const startCall = async () => {
    setCallStarted(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.current.srcObject = stream;

    peerConnection.current = createPeerConnection();
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('offer', { roomId, offer });
  };

  const handleJoinRoom = () => {
    if (roomId.trim() !== '') {
      setJoined(true);
    } else {
      alert('Please enter a room ID');
    }
  };

  return (
    <div className="container">
      {!joined ? (
        <div>
          <h2>Enter Room ID to Join</h2>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            style={{ padding: 8, fontSize: 16 }}
          />
          <button onClick={handleJoinRoom} style={{ marginLeft: 10, padding: '8px 16px' }}>
            Join Room
          </button>
          <p>Or share a unique room ID with your friend to connect</p>
        </div>
      ) : (
        <>
          <h1 className="title">Room: {roomId}</h1>
          <div className="video-wrapper">
            <video ref={localVideo} autoPlay playsInline muted className="video-box" />
            <video ref={remoteVideo} autoPlay playsInline className="video-box" />
          </div>
          {!callStarted && (
            <button className="call-button" onClick={startCall}>
              Start Call
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default VideoCall;
