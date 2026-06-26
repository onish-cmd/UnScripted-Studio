set_project("UnScriptedCore")
set_version("1.0.0")

target("unscripted_core")
set_kind("binary")
add_files("main.cpp")
set_targetdir("../frontend/public")
set_basename("unscripted_core.js")
set_extension("")

add_cxflags("-O3")

add_ldflags("-s WASM=1", { force = true })
add_ldflags("-s ALLOW_MEMORY_GROWTH=1", { force = true })
add_ldflags("--bind", { force = true })

add_ldflags('-s EXPORTED_RUNTIME_METHODS=["ccall","cwrap"]', { force = true })
