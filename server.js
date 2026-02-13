const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const app = express();

app.use(express.json({ limit: "10mb" }));

// Função para baixar as imagens
async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

// Função de processamento com "Plano B" reforçado
function runMagick(args) {
  return new Promise((resolve, reject) => {
    // Definimos os comandos possíveis. No Docker/Linux, geralmente é /usr/bin/convert
    const commands = ["/usr/bin/magick", "magick", "/usr/bin/convert", "convert"];
    
    let attempt = 0;

    function tryNext() {
      if (attempt >= commands.length) {
        return reject(new Error("Nenhum executável do ImageMagick foi encontrado no servidor."));
      }

      const currentCommand = commands[attempt];
      
      execFile(currentCommand, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && (err.code === 'ENOENT' || err.code === 127)) {
          // Se não achou o comando, tenta o próximo da lista
          attempt++;
          return tryNext();
        }
        
        if (err) return reject(new Error(`Erro no ImageMagick: ${stderr || err.message}`));
        
        resolve({ stdout, stderr });
      });
    }

    tryNext();
  });
}

app.get("/health", (req, res) => res.json({ ok: true, status: "Pronto para renderizar" }));

app.post("/render", async (req, res) => {
  let bgPath, productPath, outPath;
  
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body || {};
    
    if (!backgroundUrl || !productUrl) {
      return res.status(400).json({ error: "Links das imagens são obrigatórios." });
    }

    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    const id = Date.now();
    bgPath = path.join(tmpDir, `bg_${id}.png`);
    productPath = path.join(tmpDir, `prod_${id}.png`);
    outPath = path.join(tmpDir, `out_${id}.png`);

    // Download das imagens em paralelo para ganhar tempo
    await Promise.all([
      downloadToFile(backgroundUrl, bgPath),
      downloadToFile(productUrl, productPath)
    ]);

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
    
    // Limpeza: remove os arquivos temporários após o uso
    await Promise.all([
      fs.unlink(bgPath).catch(() => {}),
      fs.unlink(productPath).catch(() => {}),
      fs.unlink(outPath).catch(() => {})
    ]);

    res.setHeader("Content-Type", "image/png");
    res.send(outBuf);

  } catch (e) {
    console.error("Erro na renderização:", e.message);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Fábrica rodando na porta ${port}`));
