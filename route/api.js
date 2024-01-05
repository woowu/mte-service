'use strict';

const { Router } = require('express');
const  router = Router();
const { getInstantaneous } = require('../controller/api');

router.get('/instantaneous', getInstantaneous);

module.exports = router;
