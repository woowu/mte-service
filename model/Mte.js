const net = require('node:net');

module.exports = class Mte {
    #client;

    constructor() {
    }

    connect(host, port) {
        this.#client = new net.Socket();

        return new Promise((resolve, reject) => {
            this.#client.connect(port, host, () => {
                console.log('connected');
                resolve();
            });
        });
    }

    readInstantaneous() {
        return new Promise((resolve, reject) => {
            this.#client.write('read instantaneous');
            this.#client.once('data', data => {
                this.#client.destroy();
                resolve({
                    v: 2.41e8,
                    i: 1.2345e6,
                    p: 6.321e6,
                    q: 1.221e3,
                });
            });
        });
    }
};
