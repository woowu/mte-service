'use strict';

const express = require('express');

class Server {
    #app;
    #port;
    #paths;

    constructor() {
        this.#app = express();
        this.#port = process.env.PORT;
        this.#paths = {
            api: '/api',
        };

        this.#middlewares();
        this.#routes();
    }

    #middlewares() {
        this.#app.use(express.json());
    }

    #routes() {
        this.#app.use(this.#paths.api, require('../route/api'));
    }

    listen() {
        this.#app.listen(this.#port, () => {
            console.log('Server running on port:', this.#port);
        });
    }
}

module.exports = Server;
