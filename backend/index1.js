const PORT = 10000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const { request } = require("http");
const { error } = require("console");
const fs = require("fs");
const Papa = require("papaparse");
const http = require("http");
const { Server } = require("socket.io");

app.use(express.json()); //response will auto pass thorugh json
app.use(cors()); //react will connect using on the prot


const Users=mongoose.model('Users',{
      name:{
            type:String
      },
      password:{
            type:String
      },
      email:{
            type:String
      },
      cartData:{
            type:Object
      },
      date:{
            type:Date
      }

})
app.post('/signup',async (req,res)=>{
      let check=await Users.findOne({email:req.body.email});
      if(check){
            return res.status(400).json({success:false,errors:"existing users found with same username"})
      }
      let cart ={};
      for(let i=0;i<300;i++){
            cart[i]=0
      }
      const user=new Users({
      name:req.body.username,
      email:req.body.email,
      password:req.body.password,
      cartData:cart,
})
await user.save();
const data={
      user:{
            id:user.id
      }
}
const token=jwt.sign(data,'secret-ecom');
res.json({success:true,token})
})


app.post('/login',async (req,res)=>{
let user=await Users.findOne({email:req.body.email});
if(user){
      const passCompare=req.body.password===user.password;
      if(passCompare){
            const data={
                  user :{
                        id:user.id
                  }
            }
            const token=jwt.sign(data,'secret_ecom');
            res.json({success:true,token});
      }
      else{
            res.json({success:false,errors:"Wrong password"})
      }
}
else{
      res.json({success:false,errors:"Wrong email id"})
}

})


//Database connectio with mongo DB
mongoose.connect("mongodb+srv://aarshjain2022:aarshjain@cluster0.grnmg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
let SKILL_DATABASE = [];

function loadSkillsFromCSV(filePath) {
  const fileData = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse(fileData, {
    header: true,
    skipEmptyLines: true
  });
  SKILL_DATABASE = parsed.data
    .map(row => row.skill?.toLowerCase().trim())
    .filter(Boolean);
  console.log(`✅ Loaded ${SKILL_DATABASE.length} skills from CSV.`);
}

const filePath = path.join(__dirname, "skills.csv");
loadSkillsFromCSV(filePath);

function extractSkills(text) {
  const lowerText = text.toLowerCase();
  return SKILL_DATABASE.filter(skill => lowerText.includes(skill));
}

  
app.post("/ats", (req, res) => {
  const { resume_text, job_description } = req.body;

  if (!resume_text || !job_description) {
    return res.status(400).json({ error: "Resume text and job description are required." });
  }

  const jdSkills = extractSkills(job_description);
  const resumeSkills = extractSkills(resume_text);

  const matchingSkills = resumeSkills.filter(skill => jdSkills.includes(skill));
  const missingSkills = jdSkills.filter(skill => !resumeSkills.includes(skill));

  const totalSkillsRequired = jdSkills.length;
  const skillsMatched = matchingSkills.length;

  const atsScore = totalSkillsRequired > 0
    ? Math.round((skillsMatched / totalSkillsRequired) * 100)
    : 0;

  const jdWords = job_description.toLowerCase().split(/\W+/);
  const resumeWords = resume_text.toLowerCase().split(/\W+/);
  const commonWords = jdWords.filter(word => resumeWords.includes(word));
  const similarityScore = Math.min(100, Math.round((commonWords.length / jdWords.length) * 100));

  res.json({
    ats_score: atsScore,
    similarity_score: similarityScore,
    skills_matched: skillsMatched,
    total_skills_required: totalSkillsRequired,
    matching_skills: matchingSkills,
    missing_skills: missingSkills
  });
});
app.get("/ats", (req, res) => {
    res.send("✅ Resume Matcher Backend is running.");
});
app.get("/", (req, res) => {
    res.send("✅ Resume Matcher Backend is running.");
});
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://collab-jade-five.vercel.app", // Allow frontend
        methods: ["GET", "POST"]
    }
});
const RoomSchema = new mongoose.Schema({ name: String });
const Room = mongoose.model("Room", RoomSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
    room: String,
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);

    // Send available chat rooms from MongoDB
    const rooms = await Room.find();
    socket.emit("roomList", rooms.map(room => room.name));

    // Create a chat room (store in MongoDB)
    socket.on("createRoom", async (roomName) => {
        const existingRoom = await Room.findOne({ name: roomName });
        if (!existingRoom) {
            await new Room({ name: roomName }).save();
            io.emit("roomList", (await Room.find()).map(room => room.name)); // Update for all users
        }
    });

    // Join a room
    socket.on("joinRoom", async (room) => {
        socket.join(room);
        socket.emit("message", { sender: "System", text: `You joined ${room}`, timestamp: new Date() });

        // Fetch and send chat history from MongoDB
        const chatHistory = await Message.find({ room }).sort({ timestamp: 1 });
        socket.emit("chatHistory", chatHistory);
    });

    // Send a message
    socket.on("chatMessage", async ({ room, message }) => {
        const msg = { sender: socket.id, text: message, timestamp: new Date() };

        // Emit immediately
        io.to(room).emit("message", msg);

        // Save to MongoDB
        await new Message({ room, sender: socket.id, text: message }).save();
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

module.exports = app;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
