const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const fetch = require("node-fetch"); // Garantindo que o fetch funcione

const app = express();
app.use(express.json({ limit: "10mb" }));

// Função para baixar imagens
async function downloadToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buf = await res.buffer();
  await fs.writeFile(outPath, buf);
}

// Função que tenta encontrar o ImageMagick no servidor
function runMagick(args) {
  return new Promise((resolve, reject) => {
    // Tentamos 'magick' e, se falhar, tentamos 'convert'
    execFile("magick", args, (err, stdout, stderr) => {
      if (err && (err.code === 'ENOENT')) {
        return execFile("convert", args, (err2, stdout2, stderr2) => {
          if (err2) return reject(new Error(stderr2 || err2.message));
          resolve({ stdout: stdout2, stderr: stderr2 });
        });
      }
      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout, stderr });
    });
  });
}

app.get("/health", (req, res) => res.json({ ok: true, message: "Fábrica online!" }));

app.post("/render", async (req, res) => {
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body;
    
    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    const id = Date.now();
    const bgPath = path.join(tmpDir, `bg_${id}.png`);
    const prodPath = path.join(tmpDir, `prod_${id}.png`);
    const outPath = path.join(tmpDir, `out_${id}.png`);

    await Promise.all([
      downloadToFile(backgroundUrl, bgPath),
      downloadToFile(productUrl, prodPath)
    ]);

    const args = [
      bgPath, "-resize", `${outWidth}x${outHeight}^`, "-gravity", "center", "-extent", `${outWidth}x${outHeight}`,
      "(", prodPath, "-resize", "760x760", ")", "-gravity", "center", "-geometry", "+0+80", "-composite",
      outPath
    ];

    await runMagick(args);
    const image = await fs.readFile(outPath);
    
    // Limpeza de arquivos temporários
    await Promise.all([fs.unlink(bgPath), fs.unlink(prodPath), fs.unlink(outPath)]);

    res.set("Content-Type", "image/png");
    res.send(image);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
