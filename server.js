// server.js (ใช้ Node.js + Express + Socket.IO)

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

// อนุญาตให้ Server ใช้งานได้จากทุกที่ (สำคัญสำหรับ Render)
const io = new Server(server, {
    cors: {
        origin: "*", // หรือกำหนด Domain ของ Client ถ้าต้องการความปลอดภัยเพิ่ม
        methods: ["GET", "POST"]
    }
});

// ตั้งค่าให้เสิร์ฟไฟล์ HTML/JS/CSS จากโฟลเดอร์ 'public'
app.use(express.static('public'));

app.get('/', (req, res) => {
    // ส่งไฟล์ index.html เป็นหน้าหลัก
    res.sendFile(__dirname + '/public/index.html');
});

// ส่วนสำคัญ: Logic ของ Socket.IO (Signaling)
io.on('connection', (socket) => {
    console.log('ผู้ใช้ใหม่เชื่อมต่อ:', socket.id);

    // 1. รับ ID ห้อง และให้ User เข้าร่วมห้อง
    socket.on('join-room', (roomId, userId) => {
        console.log(`User ${userId} เข้าร่วมห้อง: ${roomId}`);
        socket.join(roomId);

        // 2. ส่งสัญญาณให้ทุกคนในห้อง (ยกเว้นตัวเอง) รู้ว่ามีคนใหม่เข้ามา
        // ทำให้ WebRTC เริ่มกระบวนการเชื่อมต่อ (peer.connect)
        socket.to(roomId).emit('user-connected', userId);

        // 3. เมื่อ User ออกจากห้อง
        socket.on('disconnect', () => {
            console.log('ผู้ใช้ออกจากห้อง:', userId);
            // ส่งสัญญาณให้ทุกคนรู้ว่า User นี้หลุดไปแล้ว
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

// ตั้งค่า Port สำหรับ Render (สำคัญมาก)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server กำลังทำงานที่ Port ${PORT}`);
});
