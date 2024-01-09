'use strict';

const { Router } = require('express');
const  router = Router();
const { getInstantaneous } = require('../controller/api');
const { updateLoadDef } = require('../controller/api');

router.get('/instantaneous', getInstantaneous);
router.put('/loadef', updateLoadDef);

module.exports = router;
