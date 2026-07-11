import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const addStreamTracks = (pc, stream) => {
  if (!pc || !stream) return;
  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();
  audioTracks.forEach((track) => pc.addTrack(track, stream));
  videoTracks.forEach((track) => pc.addTrack(track, stream));
};

export const useWebRTC = (activeContact) => {
  const { socket } = useContext(SocketContext);
  const [callState, setCallState] = useState('idle'); // idle, incoming, outgoing, connecting, connected
  const [mediaType, setMediaType] = useState('video'); // video, audio
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const incomingCallRef = useRef(null); // stores active incoming call metadata
  const activeCallIdRef = useRef(null);
  const callTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  const resetCallState = useCallback(() => {
    setCallState('idle');
    setLocalStream((prev) => {
      if (prev) prev.getTracks().forEach((track) => track.stop());
      return null;
    });
    localStreamRef.current = null;
    setRemoteStream((prev) => {
      if (prev) prev.getTracks().forEach((track) => track.stop());
      return null;
    });
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    incomingCallRef.current = null;
    activeCallIdRef.current = null;
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  // Update call timer
  useEffect(() => {
    if (callState === 'connected') {
      startTimeRef.current = Date.now();
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  // Peer Connection Setup
  const createPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          recipient_id: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    return pc;
  }, [socket]);

  // Initiate Outgoing Call
  const startCall = async (type = 'video') => {
    if (!socket || !activeContact) return;
    
    setMediaType(type);
    setCallState('outgoing');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      socket.emit('call_initiate', {
        recipient_id: activeContact.id,
        media_type: type,
      });
    } catch (err) {
      console.error('Failed to get media devices', err);
      resetCallState();
    }
  };

  // Accept Incoming Call
  const acceptCall = async () => {
    const incoming = incomingCallRef.current;
    if (!socket || !incoming) return;

    setMediaType(incoming.media_type);
    setCallState('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incoming.media_type === 'video',
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(incoming.caller.id);
      addStreamTracks(pc, stream);

      socket.emit('call_accept', {
        call_id: incoming.call_id,
        caller_id: incoming.caller.id,
      });
    } catch (err) {
      console.error('Failed to accept call', err);
      socket.emit('call_reject', {
        call_id: incoming.call_id,
        caller_id: incoming.caller.id,
      });
      resetCallState();
    }
  };

  // Reject Incoming Call
  const rejectCall = () => {
    const incoming = incomingCallRef.current;
    if (socket && incoming) {
      socket.emit('call_reject', {
        call_id: incoming.call_id,
        caller_id: incoming.caller.id,
      });
    }
    resetCallState();
  };

  // End Current Call
  const endCall = () => {
    const duration = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    const recipientId = activeContact ? activeContact.id : (incomingCallRef.current?.caller?.id);
    
    if (socket && recipientId) {
      socket.emit('call_end', {
        call_id: activeCallIdRef.current,
        recipient_id: recipientId,
        duration: duration,
      });
    }
    resetCallState();
  };

  // Mute/Unmute audio track
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Turn Camera on/off
  const toggleCamera = () => {
    if (localStream && mediaType === 'video') {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Handle socket signaling messages
  useEffect(() => {
    if (!socket) return;

    // Incoming Call Invitation
    const handleIncomingCall = (data) => {
      incomingCallRef.current = data;
      activeCallIdRef.current = data.call_id;
      setMediaType(data.media_type);
      setCallState('incoming');
    };

    // Caller confirmed initial handshake receipt
    const handleCallInitiatedConfirm = (data) => {
      activeCallIdRef.current = data.call_id;
    };

    // Recipient accepted call -> Caller initializes RTCPeerConnection & sends WebRTC Offer SDP
    const handleCallAccepted = async (data) => {
      setCallState('connecting');
      const targetUserId = data.recipient_id;
      
      const pc = createPeerConnection(targetUserId);
      if (localStreamRef.current) {
        addStreamTracks(pc, localStreamRef.current);
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_offer', {
          recipient_id: targetUserId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Failed to create offer sdp', err);
        endCall();
      }
    };

    // Recipient rejected call
    const handleCallRejected = () => {
      resetCallState();
    };

    // Received SDP Offer -> Create SDP Answer
    const handleCallOffer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('call_answer', {
          recipient_id: data.sender_id,
          sdp: answer,
        });
        setCallState('connected');
      } catch (err) {
        console.error('Failed to set remote offer or create answer sdp', err);
        endCall();
      }
    };

    // Received SDP Answer -> Finalize connection description
    const handleCallAnswer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        setCallState('connected');
      } catch (err) {
        console.error('Failed to set remote answer sdp', err);
        endCall();
      }
    };

    // Received ICE Candidate -> Add candidate to peer connection
    const handleIceCandidate = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ice candidate', err);
      }
    };

    // Call terminated by other user
    const handleCallEnded = () => {
      resetCallState();
    };

    socket.on('call_incoming', handleIncomingCall);
    socket.on('call_initiated_confirm', handleCallInitiatedConfirm);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_offer', handleCallOffer);
    socket.on('call_answer', handleCallAnswer);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);

    return () => {
      socket.off('call_incoming', handleIncomingCall);
      socket.off('call_initiated_confirm', handleCallInitiatedConfirm);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_offer', handleCallOffer);
      socket.off('call_answer', handleCallAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
    };
  }, [socket, createPeerConnection, resetCallState]);

  return {
    callState,
    mediaType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    incomingCall: incomingCallRef.current,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
