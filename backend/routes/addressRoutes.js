const express = require('express');
const router = express.Router();
const { protect, customerOnly } = require('../middleware/auth');
const { getAddresses, addAddress, updateAddress, deleteAddress } = require('../controllers/addressController');

// Express 4 does not catch rejected async handlers, so wrap them.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(protect, customerOnly);
router.get('/', wrap(getAddresses));
router.post('/', wrap(addAddress));
router.put('/:addressId', wrap(updateAddress));
router.delete('/:addressId', wrap(deleteAddress));

module.exports = router;
