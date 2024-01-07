#!/usr/bin/node --harmony
'use strict';

const net = require('node:net');
const {
    MessageReceiver,
    createConnectResp,
    createReadInstantaneousResp,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SERVER_PORT = 2404;

/*----------------------------------------------------------------------------*/

function handleConnect(req, socket)
{
    socket.write(createConnectResp(req.receiverAddr, req.senderAddr, {}));
}

function handleReadInstantaneous(req, socket)
{
    socket.write(createReadInstantaneousResp(req.receiverAddr, req.senderAddr,
        {}));
}

/*----------------------------------------------------------------------------*/

class Server {
    #client;
    #receiver;

    constructor(client) {
        this.#client = client;
        this.#receiver = new MessageReceiver(client, DEFAULT_MTE_ADDR);
    }

    start() {
        this.#client.on('close', () => {
            console.log('connection closed');
            this.#receiver.end();
        });
        this.#receiver.on('message', msg => {
            this.#processMessage(msg);
        });
        this.#receiver.start();
    }

    #processMessage(msg) {
        const reqCmdHandlers = {
            201: handleConnect,
            160: handleReadInstantaneous,
        };

        const req = {
            receiverAddr: msg[1],
            senderAddr: msg[2],
            cmd: msg[4],
            data: msg.slice(5, msg.length - 1),
        };

        var handlered = false;
        for (const [cmd, handler] of Object.entries(reqCmdHandlers)) {
            if (cmd == req.cmd) {
                console.log(`found command handler for ${req.cmd}`);
                handler(req, this.#client);
                handlered = true;
                break;
            }
        }
        if (! handlered) console.log('no handler for request', req);
    }
}

const server = net.createServer(socket => {
    console.log('new connection');
    new Server(socket).start();
});

console.log(`listen on ${SERVER_PORT}`);
server.listen(SERVER_PORT, 'localhost');