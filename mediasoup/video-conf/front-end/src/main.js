import './style.css';
import buttons from '../uiStuff/uiButtons';
import { io } from 'socket.io-client';
import { Device } from "mediasoup-client";
import createProducerTransport from '../mediaSoupFunctions/createProducerTransport';
import createProducer from '../mediaSoupFunctions/createProducer';
import requestTransportToConsume from '../mediaSoupFunctions/requestTransportToConsume';


let device = null
let localStream = null
let producerTransport = null
let videoProducer = null
let audioProducer = null

const socket = io.connect('https://localhost:3030');

socket.on('connect', () => {
  console.log("connected")
})

const joinRoom = async () => {
  console.log("join room")
  const userName = document.getElementById('username').value;
  const roomName = document.getElementById('room-input').value;
  const joinRoomResp = await socket.emitWithAck('joinRoom', { userName, roomName })
  console.log("joinRoomResp", joinRoomResp)

  device = new Device()
  await device.load({ routerRtpCapabilities: joinRoomResp.routerRtpCapabilities })

  console.log("device", device)

  // joinRoomResp contains arrays for:
  // audioPidsToCreate, videoPidsToCreate, associatedUserNames
  // can be empty, max 5 items
  requestTransportToConsume(joinRoomResp, socket, device)

  buttons.control.classList.remove('d-none')
}

const enableFeed = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  buttons.localMediaLeft.srcObject = localStream
  buttons.enableFeed.disabled = true
  buttons.sendFeed.disabled = false
  buttons.muteBtn.disabled = false
}

const sendFeed = async () => {
  // create a transport for THIUS client's upstream
  // It will handle both audio and video producers
  producerTransport = await createProducerTransport(socket, device)
  console.log("Have producer transport. now we can produce")

  // Create our producer
  const producers = await createProducer(localStream, producerTransport)

  audioProducer = producers.audioProducer
  videoProducer = producers.videoProducer
  console.log("producers", producers)
  buttons.hangUp.disabled = false
}

const muteAudio = () => {
  // Mute at the producer level to keep the transport and all the other mechanism in place
  if (audioProducer.paused) { //unpause
    audioProducer.resume()
    buttons.muteBtn.innerText = "Audio On"
    buttons.muteBtn.classList.add('btn-success')
    buttons.muteBtn.classList.remove('btn-danger')
    // Unpause on the server
    socket.emit("audioChange", "unmute")
  }
  else { //pause
    audioProducer.pause()
    buttons.muteBtn.innerText = "Audio Muted"
    buttons.muteBtn.classList.add('btn-danger')
    buttons.muteBtn.classList.remove('btn-success')
    // Pause on the server
    socket.emit("audioChange", "mute")
  }
}

buttons.joinRoom.addEventListener('click', joinRoom);
buttons.enableFeed.addEventListener('click', enableFeed);
buttons.sendFeed.addEventListener('click', sendFeed);
buttons.muteBtn.addEventListener('click', muteAudio);
