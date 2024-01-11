#!/usr/bin/node --harmony
'use strict';

const net = require('node:net');
const dump = require('buffer-hexdump');
const {
    MessageReceiver,
    createConnectRespMsg,
    createReadInstantaneousResp,
    createReadRespMsg,
    createAcknowledgeMsg,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SERVER_PORT = 2404;

/*----------------------------------------------------------------------------*/

function handleConnect(req, socket)
{
    const msg = createConnectRespMsg(req.receiverAddr, req.senderAddr,
        {});
    console.log('send response:\n' + dump(msg));
    socket.write(msg);
}

function handleRead(req, socket)
{
    /* currently i assume the addr is always [0x02, 0x3d] and
     * data is [0xff, 0x3f, 0xff, 0xff, 0x0f]
     */

    const resp = createReadInstantaneousResp({
        v: [242.1e3, 242.2e3, 242.3e3],
        i: [6.6e3, 10.2e3, 20e3],
        p: [1.3838e6, 2.4704e6, 4.846e6],
        q: [.79893e6, 0, 0],
        pf: [.8607e3, 1, 1],
        f: 50.03e3
    });
    const msg = createReadRespMsg(req.receiverAddr, req.senderAddr,
        req.data.addr, resp);
    console.log('send response:\n' + dump(msg));
    socket.write(msg);
}

function handleWrite(req, socket)
{
    const msg = createAcknowledgeMsg(req.receiverAddr, req.senderAddr,
        true);
    console.log('send response:\n', dump(msg));
    socket.write(msg);
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
        console.log('received message', msg);
        const reqCmdHandlers = {
            201: handleConnect,
            160: handleRead,
            163: handleWrite,
        };

        var handlered = false;
        for (const [cmd, handler] of Object.entries(reqCmdHandlers)) {
            if (cmd == msg.cmd) {
                console.log(`found command handler for ${msg.cmd}`);
                handler(msg, this.#client);
                handlered = true;
                break;
            }
        }
        if (! handlered) console.log('no handler for command', msg.cmd);
    }
}

const server = net.createServer(socket => {
    console.log('new connection');
    new Server(socket).start();
});

console.log(`listen on ${SERVER_PORT}`);
server.listen(SERVER_PORT, 'localhost');
