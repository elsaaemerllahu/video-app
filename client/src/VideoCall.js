// /client/src/VideoCall.js
import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000'); // Replace with deployed URL later

const VideoCall = () => {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerConnection = useRef(null);
  const [callStarted, setCallStarted] = useState(false);

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  useEffect(() => {
    socket.on('offer', async (offer) => {
      peerConnection.current = createPeerConnection();
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
      localVideo.current.srcObject = stream;

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answer', answer);
    });

    socket.on('answer', async (answer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', async (candidate) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  }, []);

  const startCall = async () => {
    setCallStarted(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.current.srcObject = stream;

    peerConnection.current = createPeerConnection();
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('offer', offer);
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    return pc;
  };

  return (
    <div className="container">
      <h1 className="title">Video Call</h1>
      <div className="video-wrapper">
        <video ref={localVideo} autoPlay playsInline muted className="video-box" />
        <video ref={remoteVideo} autoPlay playsInline className="video-box" />
      </div>
      {!callStarted && (
        <button className="call-button" onClick={startCall}>
          Start Call
        </button>
      )}
    </div>
  );
};

export default VideoCall;
