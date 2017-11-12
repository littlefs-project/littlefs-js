## A javascript wrapper for the little filesystem

This project puts together two things that should probably never
go together:  
embedded system filesystems, and web-side javascript.

The result is a fully functional javascript API for littlefs, complete
with simulated block devices. This was all built using emscripten, a
backend for the LLVM that can compile C to javascript. There's no smoke
and mirrors here, this is actually running littlefs in your browser.

**littlefs** - https://github.com/geky/littlefs  
**emscripten** - https://github.com/kripken/emscripten  

So you want to see littlefs running in your browser? Just follow this link to
the demo!  
http://littlefs.geky.net/demo.html

You can find the full implementation of the demo in [demo.html](demo.html).
