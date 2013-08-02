var assert = require('assert');
var Buffer = require('buffer').Buffer;

module.exports = BufferList;

function BufferList(list){
    this._list = list || [];
    this.length = this._list.reduce(function(acc,elem){return acc + elem.length},0);
}

BufferList.prototype.push = function(buffer){
    this._list.push(buffer);
    this.length += buffer.length;
};

BufferList.prototype.concat = function(){
    return Buffer.concat(this._list,this.length);
};

BufferList.prototype.slice = function(start,end){
    var sidx = this._getOffset(start);
    var eidx = this._getOffset(end-1);
    var res = new BufferList();
    if (sidx.buffer == eidx.buffer){
        var b = this._list[sidx.buffer].slice(sidx.byte,eidx.byte+1);
        res.push(b);
        return res;
    }

    var b = this._list[sidx.buffer].slice(sidx.byte);
    res.push(b);
    for (var i=sidx.buffer +1; i<eidx.buffer; i++){
        res.push(new Buffer(this._list[i]));
    }
    var b = this._list[eidx.buffer].slice(0,eidx.byte+1);
    res.push(b);

    return res;
};

BufferList.prototype.splice = function(start,howMany){
    if (arguments.length > 2) throw new Error("splice inserting not implemented");

    this.length -= howMany;

    var end = start + howMany;
    var sidx = this._getOffset(start);
    var eidx = this._getOffset(end-1);
    if (sidx.buffer == eidx.buffer){
        var b = this._list[sidx.buffer]
        var l = b.slice(0,sidx.byte);
        var m = b.slice(sidx.byte,eidx.byte+1);
        var r = b.slice(eidx.byte+1);
        var nb = Buffer.concat([l,r], l.length + r.length);

        if (nb.length === 0) this._list.splice(sidx.buffer,1);
        else this._list[sidx.buffer] = nb;

        return m;
    }

    var bl = this._list[sidx.buffer];
    var nl = bl.slice(0,sidx.byte);
    var l = bl.slice(sidx.byte+1);

    var br = this._list[eidx.buffer];
    var r = br.slice(0,eidx.byte);
    var nr = br.slice(eidx.byte+1);

    var arr = [];

    arr.push(l);
    for (var i=sidx.buffer+1; i<eidx.buffer; i++){
        arr.push(this._list[i]);
    }
    arr.push(r);

    var b = Buffer.concat(arr,howMany);

    var sl = sidx.buffer + 1;
    var sr = eidx.buffer - 1;
    if (nl.length === 0) sl--;
    if (nr.length === 0) sr++;

    this._list.splice(sl, sr - sl + 1);

    return b;
};

BufferList.prototype.toString = function(encoding,start,end){
    return this.slice(start,end).concat().toString(encoding);
};


//TODO: remove this in favor of slice, readUInt, toString, etc
BufferList.prototype.glueTo = function (len){
    var self = this;
    if (self._list[0].length >= len) return;

    var bufs = [];
    var bufsLen = 0;
    var buf;
    while (bufsLen < len){
        buf = self._list.shift();
        bufs.push(buf);
        bufsLen += buf.length;
    }
    buf = Buffer.concat(bufs,bufsLen);
    self._list.unshift(buf);
};

BufferList.prototype._getOffset = function(offset){
    var buf_idx = 0;
    var byte_offset = offset;
    while (byte_offset >= this._list[buf_idx].length){
        byte_offset -= this._list[buf_idx].length;
        buf_idx++;
    }
    return {buffer:buf_idx,byte:byte_offset};
};

BufferList.prototype.at = function(offset){
    if (offset >= this.length) return undefined;

    var idx = this._getOffset(offset);
    return this._list[idx.buffer][idx.byte];
};

BufferList.prototype.cut = function(length){
    this.glueTo(length);

    var res = this._list[0];
    if (length !== this._list[0].length){
        res = this._list[0].slice(0,length);
        this._list[0] = this._list[0].slice(length);
    }

    this.length -= length;
    return res;
};

function readUInt16(buffer, offset, isBigEndian, noAssert) {
    var val = 0;


    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 1 < buffer.length,
            'Trying to read beyond buffer length');
    }

    var v = [];
    v[0] = buffer.at(offset);
    v[1] = buffer.at(offset+1);

    if (isBigEndian) {
        val = v[0] << 8;
        val |= v[1];
    } else {
        val = v[0];
        val |= v[1] << 8;
    }

    return val;
}

BufferList.prototype.readUInt16LE = function(offset, noAssert) {
    return readUInt16(this, offset, false, noAssert);
};

function readUInt32(buffer, offset, isBigEndian, noAssert) {
    var val = 0;

    if (!noAssert) {
        assert.ok(typeof (isBigEndian) === 'boolean',
            'missing or invalid endian');

        assert.ok(offset !== undefined && offset !== null,
            'missing offset');

        assert.ok(offset + 3 < buffer.length,
            'Trying to read beyond buffer length');
    }

   var v = [];

    v[0] = buffer.at(offset);
    v[1] = buffer.at(offset + 1);
    v[2] = buffer.at(offset + 2);
    v[3] = buffer.at(offset + 3);

    if (isBigEndian) {
        val = v[1] << 16;
        val |= v[2] << 8;
        val |= v[3];
        val = val + (v[0] << 24 >>> 0);
    } else {
        val = v[2] << 16;
        val |= v[1] << 8;
        val |= v[0];
        val = val + (v[3] << 24 >>> 0);
    }

    return val;
}

BufferList.prototype.readUInt32LE = function(offset, noAssert) {
    return readUInt32(this, offset, false, noAssert);
};