

/**
 * 
 * @typedef {any} DroneData
 * @typedef {{
 *      msg: string,
 *      type: string,
 *      time: number
 * }} LogEntry
 * 
 * @typedef {{
 *      type: "advertise",
 *      readables: { [name: string] : string },
 *      commands: [string],
 * }} AdvertiseMessage
 * @typedef {{
 *      type: "update",
 *      data: DroneData,
 *      out?: [LogEntry]
 * }} UpdateMessage
 * 
 * @typedef {UpdateMessage|AdvertiseMessage} Message
 */