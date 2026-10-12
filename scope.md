             ┌─────────────────────┐
             │   Node.js Server    │
             │                     │
             │  In-Memory Queue    │
             │  Session            │
             │  WebSocket          │
             └──────────┬──────────┘
                        │
              WebSocket / HTTP
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
   Computer A       Computer B       Computer C
   HTML/CSS/JS      HTML/CSS/JS      HTML/CSS/JS
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
                  YouTube Player


ไม่ต้องใช้ Database
ข้อมูลจะอยู่ประมาณนี้ใน Node.js:
const queue = [];
const sessions = new Map();

เช่น

queue = [
  {
    id: "001",
    videoId: "abc123",
    title: "Song A",
    requestedBy: "Supahkit",
    status: "WAITING"
  },
  {
    id: "002",
    videoId: "xyz789",
    title: "Song B",
    requestedBy: "Ball",
    status: "WAITING"
  }
];

Tech Stack: 
Frontend
├── HTML
├── CSS
└── Pure JavaScript

Backend
├── Node.js
├── Native HTTP
└── WebSocket

External
└── YouTube API

ระบบ Session
เครื่อง A
ชื่อ = Supahkit
       ↓
Server Session
       ↓
sessionId
       ↓
Supahkit

Server สามารถเก็บ
sessions.set(sessionId, {
    name: "Supahkit"
});
แล้วทุก Request จะรู้ว่าใครเป็นคนขอเพลง

มีการกำหนด limit 

Real-time Queue #WebSocket

User A
   ↓
Server
   ↓
เพิ่ม Queue
   ↓
WebSocket Broadcast
   ↓
┌──────────┬──────────┐
│ Machine A│ Machine B│
│ Machine C│ Admin    │
└──────────┴──────────┘

Cafe Music
│
├── Frontend
│   ├── HTML
│   ├── CSS
│   └── Pure JavaScript
│
├── Server
│   ├── Node.js
│   ├── HTTP
│   ├── WebSocket
│   ├── Session
│   └── In-Memory Queue
│
└── External
    └── YouTube


    คุณคือ Senior Full-Stack Developer ที่มีประสบการณ์ด้าน JavaScript และ Real-time Web Application

ช่วยพัฒนาเว็บแอปพลิเคชันชื่อ "Cafe Music Queue" สำหรับใช้งานภายในองค์กร

เป้าหมาย:
สร้างระบบสำหรับให้พนักงานกรอกชื่อ แล้วสามารถค้นหาเพลงจาก YouTube หรือวาง YouTube URL เพื่อเพิ่มเพลงเข้าสู่ Queue กลางของ Cafe จากนั้นเพลงจะถูกเล่นผ่าน YouTube Player ตามลำดับ Queue

IMPORTANT REQUIREMENT:
ระบบนี้ต้องไม่มี Database

ห้ามใช้:
- MySQL
- PostgreSQL
- MongoDB
- SQLite
- Redis
- Database ใด ๆ

ให้เก็บข้อมูล Queue ทั้งหมดใน Memory ของ Spring Boot และยอมรับว่า Queue และ Session จะหายเมื่อ Server Restart

TECH STACK:

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Java Script
- WebSocket

External API:
- YouTube Data API
- YouTube IFrame Player API

Authentication:
- User ไม่ต้อง Login
- User เพียงกรอกชื่อ
- Backend ต้องตรวจว่า name != null และ name.trim() ไม่เป็น empty
- หลังจากผ่าน validation ให้สร้าง HTTP Session
- เก็บ userName ใน Session

USER REQUIREMENT:

หน้าแรก:
- แสดงชื่อ Cafe Music
- Input ชื่อ
- Button Enter
- หากชื่อ null หรือ blank ให้แสดง Error
- ไม่ต้องตรวจชื่อซ้ำ
- ไม่ต้องมี User Database

หลังจากเข้าสู่ระบบ:
- แสดงชื่อ User
- แสดง Now Playing
- แสดง Queue
- แสดง Search YouTube
- รองรับการวาง YouTube URL
- แสดงเพลงที่ User ขอ
- แสดงจำนวน Active Request เช่น 2 / 3

REQUEST LIMIT:

กำหนดค่าเริ่มต้น:
MAX_ACTIVE_REQUESTS_PER_USER = 3

นับเฉพาะเพลงที่มี Status:
- WAITING
- PLAYING

ไม่นับ:
- PLAYED
- SKIPPED
- REMOVED

หากครบ 3 เพลง ห้ามเพิ่มเพลงใหม่

REQUEST COOLDOWN:

กำหนด 5 วินาทีต่อการ Request
ตรวจสอบที่ Backend ไม่ใช่เฉพาะ Frontend

DUPLICATE PROTECTION:

YouTube Video ID เดียวกันไม่สามารถอยู่ใน Active Queue มากกว่า 1 รายการ

QUEUE STATUS:

- WAITING
- PLAYING
- PLAYED
- SKIPPED
- REMOVED

QUEUE ITEM:

แต่ละรายการควรมี:
- id
- youtubeVideoId
- title
- thumbnailUrl
- channelName
- duration
- requestedBy
- status
- requestedAt
- startedAt
- finishedAt

YOUTUBE SEARCH:

สร้าง API:
GET /api/youtube/search?q=...

ใช้ YouTube Data API

ส่งข้อมูลกลับ:
- videoId
- title
- thumbnail
- channelTitle
- duration

YOUTUBE URL:

รองรับ URL จาก YouTube ที่ระบบกำหนด

ต้อง Validate URL และ Extract Video ID ที่ Backend

PLAYER:

ใช้ YouTube IFrame Player API

ห้าม Download MP3 หรือ Video
ห้ามเก็บไฟล์เพลง
Backend เก็บเฉพาะ Video ID และ Metadata

AUTO NEXT:

เมื่อเพลงจบ:
1. เปลี่ยนเพลงปัจจุบันเป็น PLAYED
2. หา WAITING เพลงแรก
3. เปลี่ยนเป็น PLAYING
4. แจ้ง Client ผ่าน WebSocket
5. เล่นเพลงใหม่

ต้องป้องกันการ Trigger END event ซ้ำ

REAL-TIME:

ใช้ WebSocket

เมื่อเกิด:
- SONG_ADDED
- SONG_STARTED
- SONG_PLAYED
- SONG_SKIPPED
- SONG_REMOVED
- QUEUE_CLEARED

ให้ Broadcast Queue Update ไปยัง Client

ADMIN:

สร้าง Admin Dashboard

Admin สามารถ:
- ดู Now Playing
- Play
- Pause
- Resume
- Skip
- Remove
- Clear Queue
- ดูชื่อผู้ขอ

Admin Authentication สำหรับ MVP ใช้ Password จาก Environment Variable:

ADMIN_PASSWORD

ห้าม Hard-code Password

ENV:

YOUTUBE_API_KEY=...
ADMIN_PASSWORD=...
MAX_ACTIVE_REQUESTS_PER_USER=3
REQUEST_COOLDOWN_SECONDS=5

FRONTEND ENV:

VITE_API_URL=http://localhost:8080

API:

POST /api/session
GET /api/session/me
DELETE /api/session

GET /api/youtube/search?q=...
GET /api/youtube/video/{videoId}

GET /api/queue
GET /api/queue/me
POST /api/queue
DELETE /api/queue/{id}

POST /api/admin/queue/{id}/play
POST /api/admin/queue/{id}/pause
POST /api/admin/queue/{id}/skip
DELETE /api/admin/queue/{id}
DELETE /api/admin/queue

ERROR CODE:

- NAME_REQUIRED
- REQUEST_LIMIT_REACHED
- REQUEST_COOLDOWN
- SONG_ALREADY_IN_QUEUE
- INVALID_YOUTUBE_URL
- YOUTUBE_VIDEO_NOT_FOUND
- QUEUE_EMPTY
- SESSION_NOT_FOUND
- UNAUTHORIZED

SECURITY:

- Validate ทุก Input ที่ Backend
- อย่าเชื่อข้อมูลจาก Frontend
- อย่าเปิดเผย YouTube API Key ใน Frontend
- อย่า Hard-code Admin Password
- ตรวจ Session ทุก API ที่เกี่ยวข้องกับ User
- ตรวจ Admin Permission ทุก Admin API
- ใช้ Thread-safe Data Structure สำหรับ In-Memory Queue
- ป้องกัน Race Condition ตอนเพิ่มเพลงพร้อมกันหลาย Request

PROJECT STRUCTURE:


UI:

ออกแบบ UI ให้ดูทันสมัย สะอาด และเหมาะกับ Cafe Music

หน้าหลักควรมี:
1. Current Playing
2. Search
3. YouTube URL
4. Queue
5. My Request Limit

Admin Dashboard:
1. Player
2. Playback Controls
3. Queue Management

IMPORTANT DEVELOPMENT RULES:

1. อย่าสร้าง Database
2. อย่าเพิ่ม Feature นอก Scope โดยไม่จำเป็น
3. Backend ต้องเป็น Source of Truth
4. Limit ต้องตรวจที่ Backend
5. Session ต้องจัดการโดย Backend
6. ใช้ Environment Variables สำหรับ Secret
7. เขียน Code ที่แยก Controller / Service / Model / DTO ชัดเจน
8. ใช้ Thread-safe Collection สำหรับ Queue
9. Handle Error อย่างเหมาะสม
10. Code ต้องสามารถ Run ได้จริง
11. อย่าเขียน pseudo-code หากสามารถเขียน implementation จริงได้
12. หากต้องเลือกวิธี Implement ให้เลือกวิธีที่เรียบง่ายและเหมาะกับ MVP
13. อธิบายคำสั่งติดตั้งและคำสั่ง Run
14. แสดงโครงสร้าง Folder
15. ให้ Code แบบครบไฟล์และสามารถ Copy ไปใช้งานได้

เริ่มต้นด้วย:
1. สรุป Architecture
2. แสดง Folder Structure
3. สร้าง Backend
4. สร้าง Frontend
5. เชื่อม API
6. เชื่อม WebSocket
7. เชื่อม YouTube
8. ทดสอบ Flow ตั้งแต่กรอกชื่อ → Search → Add Queue → Play → Auto Next
9. ระบุข้อจำกัดของระบบที่เกิดจากการไม่มี Database