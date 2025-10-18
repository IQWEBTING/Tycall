// public/client.js

// เตรียมตัวแปร
const socket = io(); // เชื่อมต่อกับ Signaling Server (Socket.IO)
const myPeer = new Peer(undefined, {
    // ใช้ Host เดียวกันกับที่รัน Server.js 
    // หรือใส่ URL ของ Render ที่ Deploy แล้ว (แต่ PeerJS ส่วนใหญ่จะทำงานเองถ้า Server อยู่ที่เดียวกัน)
});

const videoGrid = document.getElementById('video-grid');
const myVideo = document.getElementById('local-video');
const peers = {}; // สำหรับเก็บ Peer ID ของเพื่อน
let myVideoStream;
let currentRoomId;

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
const leaveButton = document.getElementById('leave-button');


// 1. **เริ่มจากเอา Media (กล้อง/ไมค์) ของตัวเองก่อน**
//    ***สำคัญ***: กำหนด Constraint ให้ความละเอียดต่ำสุด เพื่อให้เน็ต 256kbps ยังพอไหว
navigator.mediaDevices.getUserMedia({
    video: {
        width: { max: 320 }, // ความละเอียดต่ำมากเพื่อประหยัดแบนด์วิธ
        height: { max: 240 }
    },
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream); // แสดงวิดีโอตัวเอง

    // เมื่อมีเพื่อนโทรเข้ามา
    myPeer.on('call', call => {
        // รับสายด้วย Stream ของเรา
        call.answer(stream);
        const friendVideo = document.createElement('video');
        
        // เมื่อได้รับ Stream จากเพื่อนแล้ว
        call.on('stream', userVideoStream => {
            // โชว์วิดีโอเพื่อน
            addVideoStream(friendVideo, userVideoStream);
            statusMessage.innerText = 'สถานะ: เชื่อมต่อกับเพื่อนแล้ว 🎉';
        });

        // เก็บ Peer ไว้ในตัวแปร peers
        peers[call.peer] = call;
    });

    // 4. เมื่อ Socket.IO บอกว่ามีคนใหม่ในห้อง
    socket.on('user-connected', (userId) => {
        console.log('เพื่อนใหม่เข้ามา:', userId);
        statusMessage.innerText = 'สถานะ: กำลังโทรหาเพื่อน... 🤙';
        // โทรหาเพื่อนคนนั้นทันที
        connectToNewUser(userId, stream);
    });

}).catch(err => {
    console.error("ไม่สามารถเข้าถึงกล้อง/ไมค์ได้: ", err);
    statusMessage.innerText = 'สถานะ: กรุณาอนุญาตให้เข้าถึงกล้องและไมค์';
});


// 2. **เมื่อพร้อมใช้ Peer ID แล้ว**
myPeer.on('open', id => {
    console.log('Peer ID พร้อมแล้ว:', id);
    // Peer ID ถูกสร้างแล้ว (สำคัญมาก)
});

// 3. **Logic การเข้าร่วมห้อง**
joinButton.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        currentRoomId = roomId;
        roomInfo.innerText = `รหัสห้อง: ${currentRoomId}`;
        joinScreen.style.display = 'none';
        callScreen.style.display = 'block';

        // ส่งสัญญาณให้ Server (Socket.IO) รู้ว่าเราเข้าร่วมห้องนี้แล้ว
        socket.emit('join-room', roomId, myPeer.id);
        
        statusMessage.innerText = 'สถานะ: รอเพื่อนเข้าร่วม... ⏳';
    } else {
        alert('กรุณาใส่รหัสห้อง');
    }
});


// 5. **ฟังก์ชันสำหรับโทรหาเพื่อนใหม่**
function connectToNewUser(userId, stream) {
    // โทรออก
    const call = myPeer.call(userId, stream);
    const friendVideo = document.createElement('video');
    
    // เมื่อเพื่อนรับสายและส่ง Stream กลับมา
    call.on('stream', userVideoStream => {
        addVideoStream(friendVideo, userVideoStream);
        statusMessage.innerText = 'สถานะ: เชื่อมต่อกับเพื่อนแล้ว 🎉';
    });
    
    // เมื่อเพื่อนวางสายหรือหลุด
    call.on('close', () => {
        friendVideo.remove();
        statusMessage.innerText = 'สถานะ: เพื่อนหลุด/วางสายไปแล้ว 😥';
    });

    // เก็บ Peer ID ของเพื่อน
    peers[userId] = call;
}


// 6. **ฟังก์ชันช่วยในการเพิ่ม Video Element**
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    // ตรวจสอบว่ามีวิดีโอของเพื่อนคนนี้อยู่แล้วหรือยัง
    if (!videoGrid.querySelector(`[srcObject="${stream}"]`)) {
        videoGrid.append(video);
    }
}


// 7. **Logic การปิด/เปิดกล้องและไมค์ (สำคัญสำหรับเน็ตช้า)**
toggleVideoButton.addEventListener('click', () => {
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        toggleVideoButton.innerText = '🎥 กล้องปิดอยู่';
    } else {
        myVideoStream.getVideoTracks()[0].enabled = true;
        toggleVideoButton.innerText = '🎥 เปิด/ปิดกล้อง';
    }
});

toggleAudioButton.addEventListener('click', () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        toggleAudioButton.innerText = '🎤 ไมค์ปิดอยู่';
    } else {
        myVideoStream.getAudioTracks()[0].enabled = true;
        toggleAudioButton.innerText = '🎤 เปิด/ปิดไมค์';
    }
});


// 8. **Logic แชร์หน้าจอ (ฟีเจอร์เสริม/เน็ตเร็ว)**
shareScreenButton.addEventListener('click', () => {
    navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false // แนะนำไม่เอาเสียงมาด้วย
    }).then(screenStream => {
        // แทนที่ Stream ปัจจุบันด้วย Stream หน้าจอ
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // ส่งสัญญาณให้เพื่อนรู้ว่าเรากำลังแชร์หน้าจอ
        for (let peerId in peers) {
            const sender = peers[peerId].peerConnection.getSenders().find(
                s => s.track.kind == videoTrack.kind
            );
            sender.replaceTrack(videoTrack);
        }

        // แสดงผลหน้าจอที่แชร์บนหน้าจอของเราเอง
        myVideo.srcObject = screenStream;
        shareScreenButton.innerText = '🖥️ หยุดแชร์';

        // เมื่อหยุดแชร์หน้าจอ
        videoTrack.onended = () => {
            // เปลี่ยนกลับไปใช้กล้องปกติ
            myVideo.srcObject = myVideoStream;
            for (let peerId in peers) {
                const sender = peers[peerId].peerConnection.getSenders().find(
                    s => s.track.kind == myVideoStream.getVideoTracks()[0].kind
                );
                sender.replaceTrack(myVideoStream.getVideoTracks()[0]);
            }
            shareScreenButton.innerText = '🖥️ แชร์หน้าจอ';
        };
    }).catch(err => {
        console.error("ไม่สามารถแชร์หน้าจอได้:", err);
        alert("ไม่สามารถแชร์หน้าจอได้ ลองอีกครั้ง!");
    });
});


// 9. **เมื่อเพื่อนวางสาย (หลุด)**
socket.on('user-disconnected', (userId) => {
    if (peers[userId]) {
        peers[userId].close(); // ปิดการเชื่อมต่อ Peer
        delete peers[userId];
        // ลบ Element วิดีโอของเพื่อนออก
        // (ต้องหา Element ที่ตรงกันแล้วลบ, ในโค้ดนี้เราจะให้มันจัดการเองผ่าน call.on('close') ด้านบน)
        statusMessage.innerText = 'สถานะ: เพื่อนวางสายไปแล้ว 😥';
    }
});

// 10. **วางสาย**
leaveButton.addEventListener('click', () => {
    window.location.reload(); // วิธีที่ง่ายที่สุดในการวางสายและออกจากห้อง
});
