// Servidor local mínimo (Node.js, sem dependências) para o Panorama Brasil.
// Uso: node server.js [porta]   →   http://localhost:8080
// O painel também abre direto pelo arquivo web/index.html; o servidor só evita restrições do modo file://.
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "web");
const PORTA = +process.argv[2] || 8080;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const arq = path.normalize(path.join(RAIZ, url === "/" ? "index.html" : url));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end("Proibido"); } // impede sair da pasta web
  fs.readFile(arq, (erro, dados) => {
    if (erro) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(dados);
  });
}).listen(PORTA, "127.0.0.1", () => console.log(`Panorama Brasil em http://localhost:${PORTA}  (Ctrl+C para parar)`));
