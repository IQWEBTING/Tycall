// public/client.js - อัปเดตการปรับปรุงความเสถียรและเพิ่ม Flip Camera

const socket = io(); 
const myPeer = new Peer(undefined, {});

const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.id = 'local-video'; 
myVideo.autoplay = true;
myVideo.muted = true;
videoGrid.append(myVideo); 

const peers = {}; 
let myVideoStream;
let currentRoomId;
let isScreenSharing = false;
let isFrontCamera = true; // สถานะกล้องปัจจุบัน (True = กล้องหน้า/ผู้ใช้)

// ----- UI Elements -----
const joinScreen = document.getElementById('join-screen');
const callScreen = document.getElementById('call-screen');
const joinButton = document.getElementById('join-button');
const roomIdInput = document.getElementById('room-id-input');
const roomInfo = document.getElementById('room-info');
const statusMessage = document.getElementById('status-message');
const toggleVideoButton = document.getElementById('toggle-video');
const toggleAudioButton = document.getElementById('toggle-audio');
const shareScreenButton = document.getElementById('share-screen');
const flipCameraButton = document.getElementById('flip-camera'); // ปุ่มใหม่
const leaveButton = document.getElementById('leave-button');


// **Constraints ที่เหมาะสมกับเน็ตช้า (256kbps)**
function getCameraConstraints(isFront) {
    return {
        audio: {
            echoCancellation: true, 
            noiseSuppression: true 
        },
        video: {
            width: { ideal: 160 }, 
            height: { ideal: 120 },
            frameRate: { max: 10 },
            // การกลับกล้องอยู่ที่นี่: user (กล้องหน้า) หรือ environment (กล้องหลัง)
            facingMode: isFront ? "user" : "environment" 
        }
    };
}


// ฟังก์ชันหลักในการเริ่มและเปลี่ยน Stream
async function getMediaStream(isInitial = false) {
    // 1. ถ้าไม่ใช่การเริ่มต้น หรือมีการเปลี่ยนกล้อง (flip)
    if (!isInitial && myVideoStream) {
        myVideoStream.getTracks().forEach(track => track.stop()); // ปิด Stream เก่า
    }
    
    try {
        const constraints = getCameraConstraints(isFrontCamera);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        myVideoStream = stream;
        addVideoStream(myVideo, stream); 

        // 2. ถ้ามีการเปลี่ยน Stream ระหว่างคอล ให้ส่งสัญญาณใหม่ไปหาเพื่อน
        if (!isInitial) {
            replaceVideoTrack(stream.getVideoTracks()[0]);
        }
        
        return stream;

    } catch(err) {
        console.error("ไม่สามารถเข้าถึงกล้อง/ไมค์ได้: ", err);
        statusMessage.innerText = 'สถานะ: กรุณาอนุญาตให้เข้าถึงกล้องและไมค์';
        return null;
    }
}


// **เมื่อเริ่มต้น Load หน้าจอ**
getMediaStream(true).then(stream => {
    if (stream) {
        // เมื่อมีเพื่อนโทรเข้ามา
        myPeer.on('call', call => {
            call.answer(stream);
            addPeerCallLogic(call);
        });

        // เมื่อ Socket.IO บอกว่ามีคนใหม่ในห้อง
        socket.on('user-connected', (userId) => {
            console.log('เพื่อนใหม่เข้ามา:', userId);
            statusMessage.innerText = 'สถานะ: กำลังโทรหาเพื่อน... 🤙';
            connectToNewUser(userId, stream);
        });
    }
});


// Logic การเข้าร่วมห้อง (เหมือนเดิม)
joinButton.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        currentRoomId = roomId;
        roomInfo.innerText = `ห้อง: ${currentRoomId}`;
        joinScreen.style.display = 'none';
        callScreen.style.display = 'block';
        socket.emit('join-room', roomId, myPeer.id);
        
        statusMessage.innerText = 'สถานะ: รอเพื่อนเข้าร่วม... ⏳';
    } else {
        alert('กรุณาใส่รหัสห้อง');
    }
});


// ฟังก์ชันสำหรับโทรหาเพื่อนใหม่
function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    addPeerCallLogic(call);
    peers[userId] = call;
}

// ฟังก์ชันรวม Logic การรับสาย/แสดงวิดีโอเพื่อน
function addPeerCallLogic(call) {
    const friendVideo = document.createElement('video');
    friendVideo.autoplay = true;
    friendVideo.classList.add('friend-video'); 
    
    call.on('stream', userVideoStream => {
        addVideoStream(friendVideo, userVideoStream);
        statusMessage.innerText = 'สถานะ: เชื่อมต่อกับเพื่อนแล้ว 🎉';
    });
    
    call.on('close', () => {
        friendVideo.remove();
        statusMessage.innerText = 'สถานะ: เพื่อนหลุด/วางสายไปแล้ว 😥';
        delete peers[call.peer];
    });

    peers[call.peer] = call;
}


// ฟังก์ชันช่วยในการเพิ่ม Video Element
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    if (!video.parentNode) {
        videoGrid.append(video);
    }
}


// Logic การปิด/เปิดกล้องและไมค์ (ปรับปรุงเล็กน้อย)
toggleVideoButton.addEventListener('click', () => {
    // ต้องเช็คก่อนว่ามี Stream อยู่
    if (!myVideoStream || myVideoStream.getVideoTracks().length === 0) return;

    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        toggleVideoButton.innerHTML = '🎥 **กล้องปิดอยู่**';
    } else {
        myVideoStream.getVideoTracks()[0].enabled = true;
        toggleVideoButton.innerHTML = '🎥 เปิด/ปิดกล้อง';
    }
});

toggleAudioButton.addEventListener('click', () => {
    if (!myVideoStream || myVideoStream.getAudioTracks().length === 0) return;

    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        toggleAudioButton.innerHTML = '🎤 **ไมค์ปิดอยู่**';
    } else {
        myVideoStream.getAudioTracks()[0].enabled = true;
        toggleAudioButton.innerHTML = '🎤 เปิด/ปิดไมค์';
    }
});


// **ฟังก์ชันใหม่: กลับกล้อง (Flip Camera)**
flipCameraButton.addEventListener('click', async () => {
    // 1. สลับสถานะกล้อง
    isFrontCamera = !isFrontCamera;

    // 2. เรียก Stream กล้องใหม่ และแทนที่ Track เก่า
    await getMediaStream(); 
});


// Logic แชร์หน้าจอ
shareScreenButton.addEventListener('click', async () => {
    if (isScreenSharing) {
        // 1. หยุดแชร์หน้าจอ: กลับไปใช้กล้องปกติ (ใช้ isFrontCamera สถานะเดิม)
        isScreenSharing = false;
        await getMediaStream(); // เรียก Stream กล้องใหม่
        shareScreenButton.innerHTML = '🖥️ แชร์หน้าจอ';
        
    } else {
        // 1. เริ่มแชร์หน้าจอ
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true 
            });

            // 2. แทนที่ Track Video ด้วย Track หน้าจอ
            replaceVideoTrack(screenStream.getVideoTracks()[0]);
            
            // 3. แสดงผลหน้าจอที่แชร์บนหน้าจอของเราเอง
            myVideo.srcObject = screenStream;
            shareScreenButton.innerHTML = '🖥️ **หยุดแชร์**';
            isScreenSharing = true;

            // 4. เมื่อผู้ใช้กดปุ่มหยุดแชร์ของเบราว์เซอร์
            screenStream.getVideoTracks()[0].onended = () => {
                shareScreenButton.click(); 
            };

        } catch (err) {
            console.error("ไม่สามารถแชร์หน้าจอได้:", err);
            alert("ไม่สามารถแชร์หน้าจอได้ ลองอีกครั้ง!");
        }
    }
});

// ฟังก์ชันสำหรับแทนที่ Track (สำคัญสำหรับการแชร์หน้าจอและการกลับกล้อง)
function replaceVideoTrack(newTrack) {
    for (let peerId in peers) {
        const sender = peers[peerId].peerConnection.getSenders().find(
            s => s.track && s.track.kind === newTrack.kind
        );
        if (sender) {
             sender.replaceTrack(newTrack);
        }
    }
}


// วางสาย
leaveButton.addEventListener('click', () => {
    if (myVideoStream) myVideoStream.getTracks().forEach(track => track.stop());
    for (let peerId in peers) {
        if (peers[peerId]) peers[peerId].close();
    }
    socket.disconnect(); 
    window.location.reload(); 
});
