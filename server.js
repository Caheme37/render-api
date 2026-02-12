const express = require("express"); // Carrega o motor do site
const { execFile } = require("child_process"); // Ferramenta para rodar comandos
const path = require("path"); 
const fs = require("fs/promises"); // Ajuda a lidar com arquivos e pastas
const app = express();

app.use(express.json({ limit: "5mb" })); // Permite receber JSON grande

// Função para baixar a imagem da internet
async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar URL: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

// Função robusta que tenta 'magick' e depois 'convert'
function runMagick(args) {
  return new Promise((resolve, reject) => {
    // 1. Tenta o comando moderno 'magick'
    execFile("magick", args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      
      // 2. Se o comando 'magick' não for encontrado (ENOENT), tenta 'convert'
      if (err && err.code === 'ENOENT') {
        return execFile("convert", args, { maxBuffer: 50 * 1024 * 1024 }, (err2, stdout2, stderr2) => {
          if (err2) return reject(new Error(stderr2 || err2.message));
          resolve({ stdout: stdout2, stderr: stderr2 });
        });
      }

      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout, stderr });
    });
  });
}

// ROTA DE TESTE
app.get("/health", (req, res) => res.json({ ok: true }));

// ROTA DE RENDERIZAÇÃO
app.post("/render", async (req, res) => {
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body || {};
    
    if (!backgroundUrl || !productUrl) {
      return res.status(400).json({ error: "Faltam os links das imagens!" });
    }

    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    const bgPath = path.join(tmpDir, `bg_${Date.now()}.png`);
    const productPath = path.join(tmpDir, `prod_${Date.now()}.png`);
    const outPath = path.join(tmpDir, `out_${Date.now()}.png`);

    await downloadToFile(backgroundUrl, bgPath);
    await downloadToFile(productUrl, productPath);

    const args = [
      bgPath,
      "-resize", `${outWidth}x${outHeight}^`,
      "-gravity", "center",
      "-extent", `${outWidth}x${outHeight}`,
      "(", productPath, "-resize", "760x760", ")",
      "-gravity", "center",
      "-geometry", "+0+80",
      "-composite",
      "-strip",
      outPath
    ];

    await runMagick(args);

    const outBuf = await fs.readFile(outPath);
    res.setHeader("Content-Type", "image/png");
    res.send(outBuf);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Fábrica rodando na porta ${port}`));
