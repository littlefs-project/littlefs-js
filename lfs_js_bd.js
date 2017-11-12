// block device class
function BD(read_size, prog_size, erase_size, size) {
    this.read_size = read_size
    this.prog_size = prog_size
    this.erase_size = erase_size
    this.size = size
    this._storage = []
}

BD.prototype.read = function(block, off, buffer, size) {
    if (this.onread) {
        if (this.onread(block, off, size) == false) {
            return 0
        }
    }

    if (!this._storage[block]) {
        this._storage[block] = new Uint8Array(this.erase_size);
    }

    Module.HEAPU8.set(
        new Uint8Array(this._storage[block].buffer, off, size),
        buffer)
    return 0
}

BD.prototype.prog = function(block, off, buffer, size) {
    if (this.onprog) {
        if (this.onprog(block, off, size) == false) {
            return 0
        }
    }

    if (!this._storage[block]) {
        this._storage[block] = new Uint8Array(this.erase_size);
    }

    this._storage[block].set(
        new Uint8Array(Module.HEAPU8.buffer, buffer, size),
        off)
    return 0
}

BD.prototype.erase = function(block) {
    if (this.onerase) {
        this.onerase(block)
    }

    delete this._storage[block]
    return 0
}
