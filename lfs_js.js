
// configurable constants
var LFS_READ_SIZE = 64
var LFS_PROG_SIZE = 64 
var LFS_BLOCK_SIZE = 512
var LFS_LOOKAHEAD = 512

// internal constants
var LFS_TYPE_REG = 0x11
var LFS_TYPE_DIR = 0x22

var LFS_O_RDONLY = 1
var LFS_O_WRONLY = 2
var LFS_O_RDWR   = 3
var LFS_O_CREAT  = 0x0100
var LFS_O_EXCL   = 0x0200
var LFS_O_TRUNC  = 0x0400
var LFS_O_APPEND = 0x0800

var LFS_SEEK_SET = 0
var LFS_SEEK_CUR = 1
var LFS_SEEK_END = 2

// LFS class
function LFS(bd, read_size, prog_size, block_size, lookahead) {
    this.bd = bd
    this._mount = 0

    // setup config
    this.read_size = bd.read_size || 0
    if (this.read_size < (read_size || LFS_READ_SIZE)) {
        this.read_size = (read_size || LFS_READ_SIZE)
    }

    this.prog_size = bd.prog_size || 0
    if (this.prog_size < (prog_size || LFS_PROG_SIZE)) {
        this.prog_size = (prog_size || LFS_PROG_SIZE)
    }

    this.block_size = bd.erase_size || 0
    if (this.block_size < (block_size || LFS_BLOCK_SIZE)) {
        this.block_size = (block_size || LFS_BLOCK_SIZE)
    }

    this.block_count = (bd.size || 0) / this.block_size
    this.lookahead = 32 * ~~((this.block_count + 31)/32)
    if (this.lookahead < (lookahead || LFS_LOOKAHEAD)) {
        this.lookahead = (lookahead || LFS_LOOKAHEAD)
    }

    // wrap bd functions in C runtime
    // needs global thunks due to emscripten limitations
    if (!LFS._readptr) {
        LFS._readptr = Runtime.addFunction(function(cfg,
                block, off, buffer, size) {
            return LFS._readthunk(block, off, buffer, size)
        })
    }

    if (!LFS._progptr) {
        LFS._progptr = Runtime.addFunction(function(cfg,
                block, off, buffer, size) {
            return LFS._progthunk(block, off, buffer, size)
        })
    }

    if (!LFS._eraseptr) {
        LFS._eraseptr = Runtime.addFunction(function(cfg, block) {
            return LFS._erasethunk(block)
        })
    }

    if (!LFS._syncptr) {
        LFS._syncptr = Runtime.addFunction(function(cfg) {
            return LFS._syncthunk()
        })
    }

    if (!LFS._traverseptr) {
        LFS._traverseptr = Runtime.addFunction(function(cfg, block) {
            return LFS._traversethunk(block)
        })
    }

    // setup bd thunks
    LFS._readthunk = bd.read.bind(bd)
    LFS._progthunk = bd.prog.bind(bd)
    LFS._erasethunk = (bd.erase || function(){return 0}).bind(bd)
    LFS._syncthunk = (bd.sync || function(){return 0}).bind(bd)

    // constants
    this.types = {
        'reg': LFS_TYPE_REG,
        'dir': LFS_TYPE_DIR,
    }

    this.flags = {
        'rdonly': LFS_O_RDONLY,
        'wronly': LFS_O_WRONLY,
        'rdwr':   LFS_O_RDWR,
        'creat':  LFS_O_CREAT,
        'excl':   LFS_O_EXCL,
        'trunc':  LFS_O_TRUNC,
        'append': LFS_O_APPEND,
    }

    this.whences = {
        'set': LFS_SEEK_SET,
        'cur': LFS_SEEK_CUR,
        'end': LFS_SEEK_END,
    }

    // link in C functions
    var n = 'number'
    var s = 'string'
    this._lfs_new           = Module.cwrap('lfs_new', n, [])
    this._lfs_new_config    = Module.cwrap('lfs_new_config', n,
            [n, n, n, n, n, n, n, n, n])
    this._lfs_new_info      = Module.cwrap('lfs_new_info', n, [])
    this._lfs_new_file      = Module.cwrap('lfs_new_file', n, [])
    this._lfs_new_dir       = Module.cwrap('lfs_new_dir', n, [])

    this._lfs_format        = Module.cwrap('lfs_format', n, [n, n])
    this._lfs_mount         = Module.cwrap('lfs_mount', n, [n, n])
    this._lfs_unmount       = Module.cwrap('lfs_unmount', n, [n])
    this._lfs_remove        = Module.cwrap('lfs_remove', n, [n, s])
    this._lfs_rename        = Module.cwrap('lfs_rename', n, [n, s, s])
    this._lfs_stat          = Module.cwrap('lfs_stat', n, [n, s, n])

    this._lfs_file_open     = Module.cwrap('lfs_file_open', n, [n, n, s, n])
    this._lfs_file_close    = Module.cwrap('lfs_file_close', n, [n, n])
    this._lfs_file_sync     = Module.cwrap('lfs_file_sync', n, [n, n])
    this._lfs_file_read     = Module.cwrap('lfs_file_read', n, [n, n, n, n])
    this._lfs_file_write    = Module.cwrap('lfs_file_write', n, [n, n, n, n])
    this._lfs_file_seek     = Module.cwrap('lfs_file_seek', n, [n, n, n, n])
    this._lfs_file_truncate = Module.cwrap('lfs_file_seek', n, [n, n, n])
    this._lfs_file_tell     = Module.cwrap('lfs_file_tell', n, [n, n])
    this._lfs_file_rewind   = Module.cwrap('lfs_file_rewind', n, [n, n])
    this._lfs_file_size     = Module.cwrap('lfs_file_size', n, [n, n])

    this._lfs_mkdir         = Module.cwrap('lfs_mkdir', n, [n, s])
    this._lfs_dir_open      = Module.cwrap('lfs_dir_open', n, [n, n, s])
    this._lfs_dir_close     = Module.cwrap('lfs_dir_close', n, [n, n])
    this._lfs_dir_read      = Module.cwrap('lfs_dir_read', n, [n, n, n])
    this._lfs_dir_seek      = Module.cwrap('lfs_dir_seek', n, [n, n, n])
    this._lfs_dir_tell      = Module.cwrap('lfs_dir_tell', n, [n, n])
    this._lfs_dir_rewind    = Module.cwrap('lfs_dir_rewind', n, [n, n])

    this._lfs_traverse      = Module.cwrap('lfs_traverse', n, [n, n, n])
    this._lfs_deorphan      = Module.cwrap('lfs_deorphan', n, [n])
}

LFS.prototype.format = function() {
    if (this._mount > 0) {
        // temporarily unmount filesystems
        Module._free(this._lfs_config)
        Module._free(this._lfs)
    }

    // allocate memory
    this._lfs_config = this._lfs_new_config(
            LFS._readptr, LFS._progptr, LFS._eraseptr, LFS._syncptr,
            this.read_size, this.prog_size,
            this.block_size, this.block_count,
            this.lookahead)
    this._lfs = this._lfs_new()

    // call format
    var err = this._lfs_format(this._lfs, this._lfs_config)

    // clean up
    if (this._mount == 0) {
        Module._free(this._lfs_config)
        Module._free(this._lfs)
    }

    return err
}

LFS.prototype.mount = function() {
    this._mount += 1
    if (this._mount != 1) {
        return 0
    }

    // allocate memory
    this._lfs_config = this._lfs_new_config(
            LFS._readptr, LFS._progptr, LFS._eraseptr, LFS._syncptr,
            this.read_size, this.prog_size,
            this.block_size, this.block_count,
            this.lookahead)
    this._lfs = this._lfs_new()

    // call mount
    var err = this._lfs_mount(this._lfs, this._lfs_config)
    if (err) {
        this._mount -= 1
    }
    return err
}

LFS.prototype.unmount = function() {
    this._mount -= 1
    if (this._mount != 0) {
        return 0
    }

    // call unmount
    var err = this._lfs_unmount(this._lfs)

    // clean up
    Module._free(this._lfs_config)
    Module._free(this._lfs)

    return err
}

LFS.prototype.remove = function(path) {
    return this._lfs_remove(this._lfs, path)
}

LFS.prototype.rename = function(oldpath, newpath) {
    return this._lfs_rename(this._lfs, oldpath, newpath)
}

LFS.prototype.stat = function(path) {
    // fill out butter with stat
    var info = this._lfs_new_info()
    var err = this._lfs_stat(this._lfs, path, info)
    if (err) {
        // return err code instead of object
        Module._free(info)
        return err;
    }

    // extract results
    var res = {
        type: (
            Module.HEAPU8[info+0] == this.LFS_TYPE_DIR ? 'dir' :
            Module.HEAPU8[info+0] == this.LFS_TYPE_REG ? 'reg' :
            Module.HEAPU8[info+0]),
        size: Module.HEAPU32[(info+4)/4],
        name: Pointer_stringify(info+8),
    }
    Module._free(info)
    return res
}

LFS.File = function(lfs, name, flags) {
    this.lfs = lfs
    this.name = name
    this.flags = flags

    // setup flags
    var mask = 0
    for (var i = 0; i < (flags || []).length; i++) {
        console.assert(this.lfs.flags[flags[i]])
        mask |= this.lfs.flags[flags[i]]
    }

    // allocate memory and open file
    this._file = this.lfs._lfs_new_file()
    var err = this.lfs._lfs_file_open(this.lfs._lfs, this._file, name, mask)
    if (err < 0) {
        Module._free(this._file)
        this.err = err
    }
}

LFS.prototype.open = function(name, flags) {
    var res = new LFS.File(this, name, flags)
    if (res.err) {
        return res.err;
    }

    return res
}

LFS.File.prototype.close = function() {
    var err = this.lfs._lfs_file_close(this.lfs._lfs, this._file)
    Module._free(this._file)
    return err
}

LFS.File.prototype.sync = function() {
    return this.lfs._lfs_file_sync(this.lfs._lfs, this._file)
}

LFS.File.prototype.read = function(size) {
    if (!size) {
        size = this.size()
    }

    var buffer = Module._malloc(size)
    var res = this.lfs._lfs_file_read(this.lfs._lfs, this._file, buffer, size)
    if (res < 0) {
        Module._free(buffer)
        return res
    }

    var string = Pointer_stringify(buffer, res)
    Module._free(buffer)
    return string
}

LFS.File.prototype.write = function(string) {
    var buffer = Module._malloc(string.length)
    writeStringToMemory(string, buffer, true)
    
    var res = this.lfs._lfs_file_write(this.lfs._lfs, this._file,
            buffer, string.length)
    Module._free(buffer)
    return res
}

LFS.File.prototype.seek = function(off, whence) {
    console.assert(this.lfs.whences[whence || 'set'])
    return this.lfs._lfs_file_seek(this.lfs._lfs, this._file,
            off, this.lfs.whences[whence || 'set'])
}

LFS.File.prototype.truncate = function(size) {
    return this.lfs._lfs_file_truncate(this.lfs._lfs, this._file, size)
}

LFS.File.prototype.tell = function() {
    return this.lfs._lfs_file_tell(this.lfs._lfs, this._file)
}

LFS.File.prototype.rewind = function() {
    return this.lfs._lfs_file_rewind(this.lfs._lfs, this._file)
}

LFS.File.prototype.size = function() {
    return this.lfs._lfs_file_size(this.lfs._lfs, this._file)
}

LFS.prototype.mkdir = function(path) {
    return this._lfs_mkdir(this._lfs, path)
}

LFS.Dir = function(lfs, name) {
    this.lfs = lfs
    this.name = name

    // allocate memory and open dir
    this._dir = this.lfs._lfs_new_dir()
    var err = this.lfs._lfs_dir_open(this.lfs._lfs, this._dir, name)
    if (err < 0) {
        Module._free(this._dir)
        this.err = err
    }
}

LFS.prototype.opendir = function(name, flags) {
    var res = new LFS.Dir(this, name, flags)
    if (res.err) {
        return res.err;
    }

    return res
}

LFS.Dir.prototype.close = function() {
    var err = this.lfs._lfs_dir_close(this.lfs._lfs, this._dir)
    Module._free(this._dir)
    return err
}

LFS.Dir.prototype.read = function() {
    // fill out butter with dir read
    var info = this.lfs._lfs_new_info()
    var err = this.lfs._lfs_dir_read(this.lfs._lfs, this._dir, info)
    if (err == 0) {
        // return null when complete
        Module._free(info)
        return null
    } else if (err < 0) {
        // return err code instead of object
        Module._free(info)
        return err;
    }

    // extract results
    var res = {
        type: (
            Module.HEAPU8[info+0] == this.LFS_TYPE_DIR ? 'dir' :
            Module.HEAPU8[info+0] == this.LFS_TYPE_REG ? 'reg' :
            Module.HEAPU8[info+0]),
        size: Module.HEAPU32[(info+4)/4],
        name: Pointer_stringify(info+8),
    }
    Module._free(info)
    return res
}

LFS.Dir.prototype.seek = function(off) {
    return this.lfs._lfs_dir_seek(this.lfs._lfs, this._dir, off)
}

LFS.Dir.prototype.tell = function() {
    return this.lfs._lfs_dir_tell(this.lfs._lfs, this._dir)
}

LFS.Dir.prototype.rewind = function() {
    return this.lfs._lfs_dir_rewind(this.lfs._lfs, this._dir)
}

LFS.prototype.traverse = function(cb) {
    LFS._traversethunk = cb
    return this._lfs_traverse(this._lfs, LFS._traverseptr, 0)
}

LFS.prototype.deorphan = function() {
    return this._lfs_deorphan(this._lfs)
}
