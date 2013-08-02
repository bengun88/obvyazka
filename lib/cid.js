var crypto = require('crypto');

var CID_BYTES = module.exports.CID_BYTES = 32;

module.exports.generateCID = function(){
    return crypto.randomBytes(CID_BYTES).toString('hex');
};

var CIDRegExp = new RegExp("[\\da-fA-F]{"+CID_BYTES*2+"}");

module.exports.isValidCID = function(str){
    var match = str.match(CIDRegExp);
    if (match === null) return false;
    return match[0].length === str.length;
};