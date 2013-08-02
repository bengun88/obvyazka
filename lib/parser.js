module.exports = Parser;

function Parser(descriptor){
    this.descriptor = descriptor;
}

Parser.prototype.parse = function(buf){
    if (! this.descriptor) throw new Error("Bad descriptor");

    var totalSize = 0;
    var pos = 0;

    var sizes = {};
    var positions = {};
    var results = {};

    var newSize = 0;

    for (var i=0; i<this.descriptor.length;i++){
        var item = this.descriptor[i];
        positions[item.name] = pos;
        switch (item.type){
            case "const":
            case "string":
            case "buffer":
            case "object":
                if ('size' in item){
                    newSize = item.size;
                } else if ('sizeRef' in item){
                    newSize = results[item.sizeRef];
                }
                if (typeof newSize !== 'number') throw new Error("Invalid size");
                totalSize+=newSize;
                if (buf.length < totalSize) return false;
                positions[item.name] = pos;
                sizes[item.name] = newSize;
                pos += newSize;
                break;
            case 'uint32le':
                totalSize += 4;
                if (buf.length < totalSize) return false;
                results[item.name] = buf.readUInt32LE(pos);
                pos += 4;
                break;
            case 'uint16le':
                totalSize += 2;
                if (buf.length < totalSize) return false;
                results[item.name] = buf.readUInt16LE(pos);
                pos += 2;
                break;
        }
    }

    for (var i=0; i<this.descriptor.length;i++){
        var item = this.descriptor[i];
        switch (item.type){
            case "string":
                results[item.name] = buf.toString('utf8',positions[item.name],positions[item.name]+sizes[item.name]);
                break;
            case "buffer":
                results[item.name] = buf.slice(positions[item.name],positions[item.name]+sizes[item.name]).concat();
                break;
            case "object":
                results[item.name] = JSON.parse(buf.toString('utf8',positions[item.name],positions[item.name]+sizes[item.name]));
                break;
        }
    }

    return {totalSize:totalSize,results:results};
};