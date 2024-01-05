module.exports = class Mte {
    #host;
    #port;

    constructor() {
    }

    connect(host, port) {
        this.#host = host;
        this.#port = port;
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 200);
        });
    }

    readInstantaneous() {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve({
                    voltage: 2.41e8,
                    current: 1.2345e6,
                    activePower: 6.321e6,
                    reactivePower: 1.221e3,
                });
            }, 2000);
        });
    }
};
