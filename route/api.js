'use strict';

const { Router } = require('express');
const  router = Router();
const {
    getInstantaneous,
    updateLoadDef,
    updateMteConfig,
    getMteConfig,
    startTest,
    stopTest,
    pollTestResult,
} = require('../controller/api');

router.get('/instantaneous', getInstantaneous);
router.put('/loadef', updateLoadDef);
router.put('/test/start/:mindex', startTest);
router.put('/test/stop/:mindex', stopTest);
router.get('/test/result/:mindex', pollTestResult);
router.put('/mteconfig', updateMteConfig);

module.exports = router;
