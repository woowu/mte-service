'use strict';

const { Router } = require('express');
const  router = Router();
const {
    getInstantaneous,
    updateLoadDef,
    updateMteConfig,
    getMteConfig,
} = require('../controller/api');

router.get('/instantaneous', getInstantaneous);
router.put('/loadef', updateLoadDef);
router.put('/mteconfig', updateMteConfig);
router.get('/mteconfig', getMteConfig);

module.exports = router;
