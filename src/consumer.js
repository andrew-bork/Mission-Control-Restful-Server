
import EventEmitter from "events";
import net from "net";


/**
 * Convert a key to a reference and property name.
 * key = "a.b.c"
 * object = {
 *      a: {
 *          b: {
 *              c: *
 *          }
 *      }
 * }
 * returns: {
 *      reference: object.a.b
 *      property: "c"
 * }
 * @param {string} dotName
 * @param {Object} object
 * 
 * @returns {{reference: Object, property: string}}
 */
function dotNameToReference(dotName, object) {
    if(dotName.length === 0) throw "Empty key name";
    const parts = dotName.split(".");
    for(let i = 0; i < parts.length - 1; i ++) {
        const part = parts[i];
        if(!(part in object)) {
            object[parts[i]] = {};
        }
        object = object[parts[i]];
        if(typeof(object) !== "object") {
            throw `${parts.slice(0, i).join(".")} is not a JS object, it is a ${typeof(object)}`
        }
    }

    return {
        reference: object,
        property: parts[parts.length - 1]
    };
}

export default class Drone extends EventEmitter {
    /**
     * 
     * @param {string} host 
     * @param {string|number} port 
     */
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;

        /** @type {{readables: { [name: string] : string }, commands: [string]}} */
        this.advertisement = {
            readables: {},
            commands: [],
        };

        /** @type {DroneData} */
        this.data = {};
    

        this.reconnecting = true;
        this.connect();

    }

    connect() {
        this.socket = net.connect({ host: this.host, port: this.port });

        this.socket.once("connect", () => {
            console.log("Drone found");
        });

        this.socket.on("data", (data) => {
            /** @type {Message[]} */
            let messages = data.toString("utf-8")
                                .split("\x1f")
                                .filter((message) => (message.length > 0))
                                .map((message) => {
                                    // console.log(message);
                                    try {
                                        return JSON.parse(message);
                                    }catch(e) {
                                        return null;
                                    }
                                })
                                .filter((message) => (message != null));
            // console.log(messages);
            messages.forEach((message) => {
                this.processMessage(message);
            });
        });

        this.socket.once("error", () => {
            console.error("Error with connection to drone.");
            this.socket.destroy();
            this.scheduleReconnect();
        });
        
        this.socket.once("end", () => {
            console.log("Connection with drone has ended.");
            this.socket.end();
            this.scheduleReconnect();
        });

        this.reconnecting = false;
    }

    scheduleReconnect() {
        if(!this.reconnecting) {
            this.reconnecting = true;
            setTimeout(() => {
                this.connect();
            }, 5000);
        }
        
    }

    /**
     * 
     * @param {Message} message 
     */
    processMessage(message) {
        if(message.type === "advertise") {
            this.advertisement.readables = message.readables;
            this.advertisement.commands = message.commands;
            this.emit("advertisement", this.advertisement);
        }else if(message.type === "update") {
            // this.data = message.data;
            Object.entries(message.data)
                .forEach(([key, value]) => {
                    const {reference, property} = dotNameToReference(key, this.data);
                    reference[property] = value;
                });
            // console.log(this.data);
            this.emit("data", this.data);
        }
    }

    getData() {
        return this.data;
    }

    execute(cmd, args) {
        if(this.socket && !this.socket.closed) {
            console.log(`${cmd} ${args.join(" ")};`);
            this.socket.write(`${cmd} ${args.join(" ")};`);
        }
    }
}
