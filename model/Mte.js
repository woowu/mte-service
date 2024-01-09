const net = require('node:net');
const dump = require('buffer-hexdump');

const {
    MessageReceiver,
    commandCodes,
    createConnectMsg,
    createReadInstantaneousMsg,
    createSetupLoadMsg,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SELF_ADDR = 6;

class Mte {
    #client;
    #receiver;

    connect(host, port) {
        this.#client = new net.Socket();

        this.#client.on('close', () => {
            console.log('mte socket closed');
            this.#receiver.end();
        });

        return new Promise((resolve, reject) => {
            this.#client.connect(port, host, () => {
                console.log('mte socket connected');
                this.#receiver = new MessageReceiver(this.#client, SELF_ADDR);
                this.#receiver.start();
                this.#exchangeMsg(createConnectMsg(SELF_ADDR, DEFAULT_MTE_ADDR))
                    .then(resp => {
                        resolve(resp);
                    })
                    .catch(reject);
            });
        });
    }

    disconnect() {
        this.#client.destroy();
    }

    readInstantaneous() {
        return new Promise((resolve, reject) => {
            this.#exchangeMsg(createReadInstantaneousMsg(
                SELF_ADDR, DEFAULT_MTE_ADDR))
                .then(resp => {
                    resolve(resp.data);
                })
                .catch(reject);
        });
    }

    async setupLoad(def) {
        return new Promise((resolve, reject) => {
            this.#exchangeMsg(createSetupLoadMsg(
                SELF_ADDR, DEFAULT_MTE_ADDR, def))
                .then(resp => {
                    resolve(resp.data);
                })
                .catch(reject);
        });
    }

    #exchangeMsg(req, timeout=3000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('request timeout'));
            }, timeout);
            this.#receiver.once('message', resp => {
                console.log('received resp:\n' + dump(resp));
                clearTimeout(timer);
                resolve(resp);
            });
            console.log('send req:\n' + dump(req));
            this.#client.write(req);
        });
    }
}

module.exports = Mte;
