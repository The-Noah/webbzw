import {serve as httpServer} from "https://deno.land/std@0.80.0/http/server.ts";

import {renderToString} from "https://deno.land/x/dejs@0.9.3/mod.ts";
import ws from "https://deno.land/x/deno_ws@0.1.4/mod.ts";

// const WASM_PATH = "./wasm/target/wasm32-unknown-unknown/release/wasm.wasm";

const serve = Deno.args[0] === "serve";

let indexTemplate = "";
let editorTemplate = "";
let css = "";
let js = "";

function compress(text: string, force = false): string{
  return serve && !force ? text : text.split("\n").map((line) => line.trim()).join("");
}

async function loadIndexTemplate(){
  indexTemplate = await Deno.readTextFile("./src/index.ejs");
}

async function loadEditorTemplate(){
  editorTemplate = await Deno.readTextFile("./src/editor.ejs");
}

async function loadCSS(){
  css = compress(await Deno.readTextFile("./src/style.css"), true).replace(/: /g, ":");
}

async function loadJS(){
  try{
    const {diagnostics, files} = await Deno.emit("src/app.ts", JSON.parse(await Deno.readTextFile("tsconfig.json")));

    if(diagnostics.length > 0){
      console.error(Deno.formatDiagnostics(diagnostics));

      if(!serve){
        Deno.exit(1);
      }
    }

    // HACK: there shouldn't need to be any `replace` calls
    js = compress(files["deno:///bundle.js"].replace(/Pyramid1/g, "Pyramid").replace(/Box1/g, "Box"));
  }catch(err){
    console.error(err);
  }
}

async function build(): Promise<{index: string, editor: string}>{
  while(indexTemplate === ""){
    await loadIndexTemplate();
  }
  while(editorTemplate === ""){
    await loadEditorTemplate();
  }
  while(css === ""){
    await loadCSS();
  }
  while(js === ""){
    await loadJS();
  }

  let version = "unknown";
  if(serve){
    const versionProcess = Deno.run({cmd: ["git", "describe", "--tags"], stdout: "piped", stderr: "piped"});
    version = new TextDecoder().decode(await versionProcess.output()).split("-")[0];
    versionProcess.close();
  }else{
    version = Deno.env.get("GIT_TAG") ?? "unknown";
  }

  return {
    index: await renderToString(indexTemplate, {
      css,
    }),
    editor: await renderToString(editorTemplate, {
      version,
      css,
      js,
    }),
  }
}

await loadIndexTemplate();
await loadEditorTemplate();
await loadCSS();
await loadJS();

if(serve){
  const WS_PORT = 8001;
  const RELOAD_COMMAND = "reload";
  const RELOAD_TIMEOUT = 50;

  const RELOAD_HTML = `<script>var ssgs=new WebSocket("ws://localhost:${WS_PORT}");ssgs.onmessage=function(event){if(event.data==="${RELOAD_COMMAND}"){window.location.reload()}}</script>`;

  const server = httpServer({port: 8000});
  console.log("dev server running on http://localhost:8000/");

  const wss = new ws.Server(undefined, WS_PORT);

  const _reload = async (event: Deno.FsEvent): Promise<void> => {
    if(event.paths[0].endsWith("index.ejs")){
      console.log("index template changed");
      await loadIndexTemplate();
    }else if(event.paths[0].endsWith("editor.ejs")){
      console.log("editor template changed");
      await loadEditorTemplate();
    }else if(event.paths[0].endsWith("style.css")){
      console.log("css changed");
      await loadCSS();
    }else if(event.paths[0].endsWith(".ts")){
      console.log("js changed");
      await loadJS();
    }

    wss.clients.forEach((client) => client.send(RELOAD_COMMAND));
  };

  let timeoutId = 0;
  const reload = (event: Deno.FsEvent) => {
    if(timeoutId){
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => _reload(event), RELOAD_TIMEOUT);
  };

  setTimeout(async () => {
    for await(const event of Deno.watchFs("src", {recursive: true})){
      await reload(event);
    }
  });

  for await(const req of server){
    // if(req.url === "/wasm.wasm"){
    //   const headers = new Headers();
    //   headers.set("content-type", "application/wasm");

    //   req.respond({
    //     status: 200,
    //     headers,
    //     body: await Deno.readFile(WASM_PATH)
    //   });
    //   continue;
    // }

    try{
      const pages = await build();
      let html;

      if(req.url === "/editor"){
        html = pages.editor;
      }else{
        html = pages.index;
      }

      req.respond({
        status: 200,
        body: html + RELOAD_HTML,
      });
    }catch(err){
      req.respond({
        status: 500,
        body: `<!DOCTYPE html><html><body><pre>${err}</pre>${RELOAD_HTML}</body></html>`,
      });
    }
  }
}else{
  try{
    await Deno.lstat("build");
  }catch(err){
    if(err instanceof Deno.errors.NotFound){
      await Deno.mkdir("build");
    }else{
      throw err;
    }
  }

  // await Deno.copyFile(WASM_PATH, "./build/wasm.wasm");

  const pages = await build();
  await Deno.writeTextFile("build/index.html", pages.index);
  await Deno.writeTextFile("build/editor.html", pages.editor);
}
