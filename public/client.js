// public/client.js - อัปเดตการปรับปรุงความเสถียร

const socket = io(); 

// **การตั้งค่า PeerJS ที่ปรับให้ดีที่สุดสำหรับเน็ตช้า**
const myPeer = new Peer(undefined, {
    // กำหนด Server ที่ใช้ Signaling
    // Note: Render จะมี Public IP ที่สามารถใช้เป็น Host ได้
});

const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.id = 'local-video'; // ใช้ id เดิมในการอ้างอิง
myVideo.autoplay = true;
myVideo.muted = true;
videoGrid.append(myVideo); // เพิ่ม Element เข้าไปใน DOM ตั้งแต่แรก

const peers = {}; 
let myVideoStream;
let currentRoomId;
let isScreenSharing = false;

// ----- UI Elements -----
// ... (เหมือนเดิม)
const joinScreen = document.getElementById('join-screen');
const callScreen = document.getElementById('call-screen');
const joinButton = document.getElementById('join-button');
const roomIdInput = document.getElementById('room-id-input');
const roomInfo = document.getElementById('room-info');
const statusMessage = document.getElementById('status-message');
const toggleVideoButton = document.getElementById('toggle-video');
const toggleAudioButton = document.getElementById('toggle-audio');
const shareScreenButton = document.getElementById('share-screen');
const leaveButton = document.getElementById('leave-button');


// **Constraints ที่เหมาะสมกับเน็ตช้า (256kbps)**
const LOW_BANDWIDTH_CONSTRAINTS = {
    // 1. Audio: เน้นคุณภาพเสียงดีที่สุด
    audio: {
        echoCancellation: true, // ตัดเสียงสะท้อน
        noiseSuppression: true // ลดเสียงรบกวน
    },
    // 2. Video: ความละเอียดต่ำสุดเพื่อลดการกระตุกของเสียง
    video: {
        width: { ideal: 160 }, // ลดเหลือ 160x120
        height: { ideal: 120 },
        frameRate: { max: 10 } // ลดเฟรมเรตลงเหลือ 10 FPS
    }
};


// 1. **เริ่มจากเอา Media (กล้อง/ไมค์) ของตัวเองก่อน**
navigator.mediaDevices.getUserMedia(LOW_BANDWIDTH_CONSTRAINTS)
.then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream); 

    myPeer.on('call', call => {
        call.answer(stream);
        addPeerCallLogic(call);
    });

    socket.on('user-connected', (userId) => {
        console.log('เพื่อนใหม่เข้ามา:', userId);
        statusMessage.innerText = 'สถานะ: กำลังโทรหาเพื่อน... 🤙';
        connectToNewUser(userId, stream);
    });

}).catch(err => {
    console.error("ไม่สามารถเข้าถึงกล้อง/ไมค์ได้: ", err);
    statusMessage.innerText = 'สถานะ: กรุณาอนุญาตให้เข้าถึงกล้องและไมค์';
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
    friendVideo.classList.add('friend-video'); // เพิ่มคลาสสำหรับ CSS
    
    call.on('stream', userVideoStream => {
        addVideoStream(friendVideo, userVideoStream);
        statusMessage.innerText = 'สถานะ: เชื่อมต่อกับเพื่อนแล้ว 🎉';
    });
    
    call.on('close', () => {
        friendVideo.remove();
        statusMessage.innerText = 'สถานะ: เพื่อนหลุด/วางสายไปแล้ว 😥';
        delete peers[call.peer];
    });

    // เพิ่มการจัดการเมื่อมี Peer Id เข้ามาใหม่
    peers[call.peer] = call;
}


// ฟังก์ชันช่วยในการเพิ่ม Video Element
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    // ตรวจสอบว่าวิดีโอยังไม่ถูกเพิ่มก่อน
    if (!video.parentNode) {
        videoGrid.append(video);
    }
}


// Logic การปิด/เปิดกล้องและไมค์ (เหมือนเดิม)
toggleVideoButton.addEventListener('click', () => {
    const enabled = myVideoStream.getVideoTracks().length > 0 && myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        toggleVideoButton.innerHTML = '🎥 **กล้องปิดอยู่**';
    } else {
        // ต้องตรวจสอบว่ามี Track อยู่หรือไม่ ก่อนเปิด
        if (myVideoStream.getVideoTracks().length > 0) {
            myVideoStream.getVideoTracks()[0].enabled = true;
        }
        toggleVideoButton.innerHTML = '🎥 เปิด/ปิดกล้อง';
    }
});

toggleAudioButton.addEventListener('click', () => {
    const enabled = myVideoStream.getAudioTracks().length > 0 && myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        toggleAudioButton.innerHTML = '🎤 **ไมค์ปิดอยู่**';
    } else {
        if (myVideoStream.getAudioTracks().length > 0) {
            myVideoStream.getAudioTracks()[0].enabled = true;
        }
        toggleAudioButton.innerHTML = '🎤 เปิด/ปิดไมค์';
    }
});


// 8. **Logic แชร์หน้าจอ (แก้ไขให้ทำงานได้และสลับกลับได้)**
shareScreenButton.addEventListener('click', async () => {
    if (isScreenSharing) {
        // 1. หยุดแชร์หน้าจอ
        myVideoStream.getTracks().forEach(track => track.stop()); // ปิด Stream หน้าจอ
        
        // 2. กลับไปใช้กล้องปกติ (เรียก Stream กล้องใหม่ด้วย Low-Res)
        const newStream = await navigator.mediaDevices.getUserMedia(LOW_BANDWIDTH_CONSTRAINTS);
        myVideoStream = newStream;

        // 3. แทนที่ Track กลับ
        replaceVideoTrack(myVideoStream.getVideoTracks()[0]);

        myVideo.srcObject = myVideoStream;
        shareScreenButton.innerHTML = '🖥️ แชร์หน้าจอ';
        isScreenSharing = false;
        
    } else {
        // 1. เริ่มแชร์หน้าจอ
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true // ลองเพิ่ม Audio ด้วย ถ้าเน็ตพอไหว
            });

            // 2. แทนที่ Track Video ด้วย Track หน้าจอ
            replaceVideoTrack(screenStream.getVideoTracks()[0]);
            
            // 3. แสดงผลหน้าจอที่แชร์บนหน้าจอของเราเอง
            myVideo.srcObject = screenStream;
            shareScreenButton.innerHTML = '🖥️ **หยุดแชร์**';
            isScreenSharing = true;

            // 4. เมื่อผู้ใช้กดปุ่มหยุดแชร์ของเบราว์เซอร์
            screenStream.getVideoTracks()[0].onended = () => {
                // เรียกตัวเองเพื่อสลับกลับไปใช้กล้องปกติ
                shareScreenButton.click(); 
            };

        } catch (err) {
            console.error("ไม่สามารถแชร์หน้าจอได้:", err);
            alert("ไม่สามารถแชร์หน้าจอได้ ลองอีกครั้ง!");
        }
    }
});

// ฟังก์ชันสำหรับแทนที่ Track (สำคัญสำหรับการแชร์หน้าจอ)
function replaceVideoTrack(newTrack) {
    for (let peerId in peers) {
        const sender = peers[peerId].peerConnection.getSenders().find(
            s => s.track.kind === newTrack.kind
        );
        if (sender) {
             sender.replaceTrack(newTrack);
        }
    }
}


// วางสาย
leaveButton.addEventListener('click', () => {
    // ปิดทุก Track ที่เปิดอยู่ก่อน
    myVideoStream.getTracks().forEach(track => track.stop());
    for (let peerId in peers) {
        peers[peerId].close();
    }
    socket.disconnect(); // ปิด Socket
    window.location.reload(); // รีโหลดหน้าจอ
});
