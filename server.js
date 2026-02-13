const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const fetch = require("node-fetch");

const app = express();

// Aumentamos o limite para suportar o recebimento de imagens maiores se necessário
app.use(express.json({ limit: "10mb" }));

// Função auxiliar para baixar as imagens das URLs enviadas pelo n8n
async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const buf = await res.buffer();
  await fs.writeFile(outPath, buf);
}

// Função que executa o ImageMagick usando o caminho direto no Linux
function runMagick(args) {
  return new Promise((resolve, reject) => {
    // Usamos o endereço completo para garantir que o Node.js encontre o programa
    const command = "/usr/bin/convert"; 

    execFile(command, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Erro no ImageMagick: ${stderr || err.message}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

// Rota de teste para verificar se a API está online
app.get("/health", (req, res) => res.json({ status: "online", message: "Fábrica pronta!" }));

// Rota principal de renderização
app.post("/render", async (req, res) => {
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body;

    if (!backgroundUrl || !productUrl) {
      return res.status(400).json({ error: "backgroundUrl e productUrl são obrigatórios." });
    }

    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    const id = Date.now();
    const bgPath = path.join(tmpDir, `bg_${id}.png`);
    const prodPath = path.join(tmpDir, `prod_${id}.png`);
    const outPath = path.join(tmpDir, `out_${id}.png`);

    // Baixa as duas imagens ao mesmo tempo
    await Promise.all([
      downloadToFile(backgroundUrl, bgPath),
      downloadToFile(productUrl, prodPath)
    ]);

    // Comandos do ImageMagick para montar a imagem
    const args = [
      bgPath, 
      "-resize", `${outWidth}x${outHeight}^`, 
      "-gravity", "center", 
      "-extent", `${outWidth}x${outHeight}`,
      "(", prodPath, "-resize", "760x760", ")", 
      "-gravity", "center", 
      "-geometry", "+0+80", 
      "-composite",
      outPath
    ];

    await runMagick(args);

    // Lê o resultado e envia de volta
    const image = await fs.readFile(outPath);
    
    // Limpa os arquivos temporários para não encher o servidor
    await Promise.all([
      fs.unlink(bgPath).catch(() => {}),
      fs.unlink(prodPath).catch(() => {}),
      fs.unlink(outPath).catch(() => {})
    ]);

    res.set("Content-Type", "image/png");
    res.send(image);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
