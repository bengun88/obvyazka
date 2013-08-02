/**
 *
 * @param items - array of {'domain':"string",'ports':[1,2,3]}. Ports are optional
 * @returns {string}
 */
module.exports.makeCrossdomainXML = function(items){
    var crossDomainStrings = "";
    for ( var i in items ) {
        crossDomainStrings += '<allow-access-from '
        if ('domain' in items[i]){
            crossDomainStrings += 'domain="' + items[i]['domain'] + '" ';
        }
        if ('ports' in items[i]){
            crossDomainStrings += 'to-ports="' + items[i]['ports'].join() + '" ';
        }
        crossDomainStrings += '/>';
    }

    var res = "";
    res += '<?xml version="1.0" encoding="UTF-8"?>';
    res += '<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">';
    res += '<cross-domain-policy>';
    res += crossDomainStrings;
    res += '</cross-domain-policy>';

    return res;
};
