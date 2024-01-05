#!/usr/bin/node --harmony
'use strict';

require('dotenv').config()
const Server = require('./model/server');
const server = new Server();
server.listen()
