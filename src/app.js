import express from "express";
import net from "net"; // UNIX Domain sockets
import cors from "cors";

import fs from "fs";
// const 
const PORT = process.env.PORT ?? 1234;

const app = express();

app.use(cors({
    origin: "*"
}));

let scheme = {
    // accel: "acceleration",
    gyro: "angle",
    engine: {
        power: "engpwr"
    },
    system: {
        time: "time",
        last_contact_recieved: "last_contact_recieved",

    }
}

/** @type {Object<string, string|number|boolean>} */
let raw_data = {

};
let logs = [];
let commands = [];
let readables = {};

const server_to_controller = net.createServer((socket) => {
    socket.write("set filter 0.1;")
    socket.on("data", (data) => {
        // console.log(data.toString("utf-8"));
        const message = JSON.parse(data.toString("utf-8"));
        raw_data["last_contact_recieved"] = Date.now();

        if(message.type === "advertise") {
            readables = message.readables;
            commands = message.commands;

            console.log(readables);
            console.log(commands);
        }else {
            raw_data = message.data;
            if("out" in message) {
                logs = logs.concat(message.out);
                // console.log(logs);
            }
        }
    })
});


fs.unlinkSync("/tmp/server.sock");
server_to_controller.listen("/tmp/server.sock");

app.use(express.json());
// app.use("/execute", express.json());

function build_data_from_scheme(scheme, raw_data) {
    if(typeof(scheme) === "string") {
        if(scheme in raw_data) return raw_data[scheme];
        else return null;
    }else if(typeof(scheme) === "object") {
        return Object.keys(scheme)
                    .reduce((prev, curr) => {
                        prev[curr] = build_data_from_scheme(scheme[curr], raw_data);
                        return prev;
                    }, {});
    }else {
        // ?????
    }
}

app.get("/data/*", (req,res) => {
    try {

        const requested_scheme = 
            req.url
                .slice(6) // /data/accel/x -> accel/x
                .split("/") // accel/x -> ["accel", "x"]
                .filter((a) => a.length > 0) // Filter all the empty elements out
                .reduce((prev, curr, i, array) => {
                    if(curr in prev) return prev[curr];
                    else throw `Scheme "${array.join(".")}" does not exist.`;
                }, scheme); // scheme.accel.x

        res.status(200)
            .set("Cache-Control", "no-cache")
            .json({
                success:true,
                result: build_data_from_scheme(requested_scheme, raw_data)
            });
    }catch(e) {
        res
            .status(404)
            .set("Cache-Control", "no-cache")
            .json({
                success:false,
                reason: e
            });
    }
});

app.get("/data", (req,res) => {
    
    res
        .status(200)
        .set("Cache-Control", "no-cache")
        .json({
            success:true,
            result: build_data_from_scheme(scheme, raw_data)
        });
});

app.post("/execute", (req, res) => {
    console.log(req.body);
    res
        .status(200)
        .json({success: false});
});



app.listen(PORT, () => {

});