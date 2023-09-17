import express from "express";
import net from "net"; // UNIX Domain sockets

const PORT = process.env.PORT ?? 1234;

const app = express();


app.listen(() => {

}, PORT);