import express from "express";
import net from "net"; // UNIX Domain sockets
import cors from "cors";


const PORT = process.env.PORT ?? 2032;

let scheme = {
    accel: "accelerometer.acceleration",
    gyro: "orientation",
    gyro_v: "gyroscope.angular_velocity",
    system: {
        last_contact_recieved: "last_contact_recieved",
        status: "status",
        logs: "logs"
    }
};


const app = express();

app.use(cors({
    origin: "*"
}));


/** @type {Object<string, string|number|boolean>} */
let raw_data = {

};
let logs = [];
let commands = [];
let readables = {};


class Consumer {

    constructor({ host, port }) {
        this.host = host;
        this.port = port;
        this.reconnect();
        this.timeout = null;
    }

    reconnect() {
        if(this.socket != null && !this.socket.closed) this.socket.end();

        this.socket = net.connect({ host: this.host, port: this.port }, () => {this.onConnect()});
        this.socket.on("data", (data) => {
            try {
                const messages = data.toString("utf-8").split("\x1f").filter((a) => a.length > 0);
                messages.forEach((message) => {
                    message = JSON.parse(message);
                    // console.log(message);
            
                    if(message.type === "advertise") {
                        readables = message.readables;
                        commands = message.commands;
                        
                        console.log(readables);
                        console.log(commands);
                    }else if(message.type === "update") {
                        raw_data = message.data;
                        // console.log(raw_data);
                        if("out" in message) {
                            logs = logs.concat(message.out);
                            raw_data.logs = message.out;
                            if(message.out.length > 1) console.log(message.out);
                            console.log(logs);
                        }else {
                            
                        }
                    }
                });
                raw_data["last_contact_recieved"] = Date.now();
            }catch(e) { 

            }
        });

        this.socket.on("error", () => {
            this.socket.end();
            if(this.timeout == null) {
                const seconds = 5;
                console.log(`Failed to connect to consumer, trying again in ${seconds}s`);
                setTimeout(() => {
                    this.reconnect();
                }, seconds * 1000);
            }
        });

        this.socket.on("close", () => {
            this.socket.end();
            if(this.timeout == null) {
                const seconds = 5;
                console.log(`Failed to connect to consumer, trying again in ${seconds}s`);
                setTimeout(() => {
                    this.reconnect();
                }, seconds * 1000);
            }
        });
    }

    onConnect() {
        this.socket.write("advertise;");
    }

    execute(command, args) {
        this.socket.write(`${command} ${args.join(" ")};`);
    }
}


const consumer = new Consumer({ host: "drone", port: "3000"}); 



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
        throw "Invalid type in scheme"
    }
}

app.use(express.json());

app.get("/raw", (req, res) => {
    res.status(200)
        .json({
            success: true,
            result: raw_data
        });
});

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
            result: build_data_from_scheme(scheme, raw_data)
        });
});

app.post("/execute", (req, res) => {
    // console.log(req.body);
    if(("command" in req.body) && ("args" in req.body)) {
        const command = req.body.command;
        const args = req.body.args;
        
        consumer.execute(command, args);

        res.status(200)
            .json({success: true});
        return;
    }



    res.status(200)
        .json({success: false});
});

app.get("/", (req, res) => {
    res.send("hi");
})



app.listen(PORT, () => {
    console.log(PORT);
});