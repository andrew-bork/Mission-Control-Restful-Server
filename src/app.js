import express from "express";
import net from "net"; // UNIX Domain sockets
import cors from "cors";
import http from "http";
import Drone from "./consumer.js";

import { Server as SocketIOServer } from "socket.io";

const PORT = process.env.PORT ?? 2032;


const app = express();
const server = http.createServer(app);
app.use(cors({
    origin: "*"
}));


const io = new SocketIOServer(server, {
    cors: {
      origin: "*"
    }
  });

const drone = new Drone("drone", "3000");

app.use(express.json());

io.on("connection", (socket) => {
    console.log("New Listener!");
});

drone.on("data", (data) => {    
    io.emit("data", data);
});
drone.on("advertisement", (advertisement) => {
    io.emit("advertisement", advertisement);
});


app.get("/raw", (req, res) => {
    res.status(200)
        .json({
            success: true,
            result: raw_data
        });
});

app.get("/readable", (req, res) => {
    res.status(200).json({ success: true, result: readables });
});
app.get("/commands", (req, res) => {
    res.status(200).json({ success: true, result: commands });
});

app.get("/data", (req,res) => {
    res
        .status(200)
        .set("Cache-Control", "no-cache")
        .json({
            success:true,
            result: drone.getData()
        });
});

app.post("/execute", (req, res) => {
    console.log(req.body);
    if(("command" in req.body) && ("args" in req.body)) {
        const command = req.body.command;
        const args = req.body.args;
        console.log(command, args);
        
        drone.execute(command, args);

        res.status(200)
            .json({success: true});
        return;
    }

    res.status(200)
        .json({success: false});
});

app.get("/", (req, res) => { res.send("hi"); })
server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});