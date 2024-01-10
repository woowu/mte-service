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
        v: [
            [239e6, -6],
            [241e6, -6],
            [230e6, -6],
        ],
        i: [
            [5.01e6, -6],
            [4.99e6, -6],
            [20.68e6, -6],
        ],
        p: [
            [84668258, -5],
            [85035954, -5],
            [411916323, -5],
        ],
        q: [
            [84668258, -5],
            [85035954, -5],
            [237820000, -5],
        ],
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
