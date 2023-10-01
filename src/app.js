import express from "express";
import net from "net"; // UNIX Domain sockets
import cors from "cors";


const PORT = process.env.PORT ?? 2032;

/**
 *  raw_data: {
 *      a: 0,
 *      b: 1,
 *      c: 2, 
 *      d: 3
 *  }
 * 
 *  scheme: {
 *      group1: {
 *          a: "a",
 *          c: "c"
 *      },
 *      group2 {
 *          group3: {
 *              a: "a",
 *              b: "b"
 *          },
 *          d: "d"
 *      }
 * }
 * 
 * result: {
 *      group1: {
 *          a: 0,
 *          c: 2
 *      },
 *      group2 {
 *          group3: {
 *              a: 0,
 *              b: 1
 *          },
 *          d: 3
 *      }
 * }
 */
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


/**
 * Abstraction over connection to consumer.
 */
class Consumer {

    /**
     * 
     * @param {{host: string, port: string}} param0 
     */
    constructor({ host, port }) {
        this.host = host;
        this.port = port;
        this.reconnect();
        this.timeout = null;
    }
    
    /**
     * Reconnect the socket. Destroys the original sockt if it exists and isn't closed.
     */
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
                        
                        // console.log(readables);
                        // console.log(commands);
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

    /**
     * Execute command with args.
     * 
     * @param {string} command 
     * @param {[string]} args 
     */
    execute(command, args) {
        this.socket.write(`${command} ${args.join(" ")};`);
    }
}


const consumer = new Consumer({ host: "drone", port: "3000"}); 



/**
 * Structures a new object, using a scheme, from raw_data.
 * 
 *  raw_data: {
 *      a: 0,
 *      b: 1,
 *      c: 2, 
 *      d: 3
 *  }
 * 
 *  scheme: {
 *      group1: {
 *          a: "a",
 *          c: "c"
 *      },
 *      group2 {
 *          group3: {
 *              a: "a",
 *              b: "b"
 *          },
 *          d: "d"
 *      }
 * }
 * 
 * result: {
 *      group1: {
 *          a: 0,
 *          c: 2
 *      },
 *      group2 {
 *          group3: {
 *              a: 0,
 *              b: 1
 *          },
 *          d: 3
 *      }
 * }
 * 
 * @param {Any}} scheme 
 * @param {Any} raw_data 
 * @returns {Any}
 */
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

/**
 * DEBUG
 * GET /raw
 * 
 * Sends back the raw data from the consumer. The json is not structured.
 * 
 */
app.get("/raw", (req, res) => {
    res.status(200)
        .json({
            success: true,
            result: raw_data
        });
});

/**
 * GET /data/*
 * 
 * Sends back the latest data from the consumer. The json is structured based on the scheme object.
 * Additional paths in the path narrow down the search path.
 * 
 * /data/a/b -> data.a.b
 */

// app.get("/data/*", (req,res) => {
//     try {

//         const requested_scheme = 
//             req.url
//                 .slice(6) // /data/accel/x -> accel/x
//                 .split("/") // accel/x -> ["accel", "x"]
//                 .filter((a) => a.length > 0) // Filter all the empty elements out
//                 .reduce((prev, curr, i, array) => {
//                     if(curr in prev) return prev[curr];
//                     else throw `Scheme "${array.join(".")}" does not exist.`;
//                 }, scheme); // scheme.accel.x

//         res.status(200)
//             .set("Cache-Control", "no-cache")
//             .json({
//                 success:true,
//                 result: build_data_from_scheme(requested_scheme, raw_data)
//             });
//     }catch(e) {
//         res
//             .status(404)
//             .set("Cache-Control", "no-cache")
//             .json({
//                 success:false,
//                 reason: e
//             });
//     }
// });

app.get("/readable", (req, res) => {
    res.status(200).json({ success: true, result: readables });
});
app.get("/commands", (req, res) => {
    res.status(200).json({ success: true, result: commands });
});

/**
 * GET /data
 * 
 * Sends back the latest data from the consumer. The json is structured based on the scheme object.
 * 
 */
app.get("/data", (req,res) => {
    
    res
        .status(200)
        .set("Cache-Control", "no-cache")
        .json({
            success:true,
            result: build_data_from_scheme(scheme, raw_data)
        });
});

/**
 * POST /execute
 * 
 * body: {
 *      command: ...,
 *      args: [...]
 * }
 * 
 * Executes the command on the consumer. DOES NOT CHECK IF THE COMMAND EXISTS.
 */
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

/**
 * Debug
 * GET /
 * Just sends hi.
 */
app.get("/", (req, res) => {
    res.send("hi");
})



app.listen(PORT, () => {
    console.log(PORT);
});