const express = require("express"); // Carrega o motor do site
const { execFile } = require("child_process"); // Ferramenta para rodar comandos no computador
const path = require("path"); 
const fs = require("fs/promises"); // Ajuda a lidar com arquivos e pastas
const app = express();

app.use(express.json({ limit: "5mb" })); // Diz ao app para aceitar dados em formato texto/JSON

// Função para baixar a imagem da internet e salvar numa pasta temporária
async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar URL: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

// Função que "conversa" com o ImageMagick para editar a foto
function runMagick(args) {
  return new Promise((resolve, reject) => {
    // Tentamos usar o comando 'magick' (versão nova) ou 'convert' (versão clássica)
    execFile("magick", args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout, stderr });
    });
  });
}

// ROTA DE TESTE: Para saber se a fábrica está ligada
app.get("/health", (req, res) => res.json({ ok: true }));

// ROTA DE RENDERIZAÇÃO: Onde a mágica acontece
app.post("/render", async (req, res) => {
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body || {};
    
    // Verifica se enviamos os links das imagens
    if (!backgroundUrl || !productUrl) {
      return res.status(400).json({ error: "Faltam os links das imagens!" });
    }

    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    // Cria nomes temporários para as fotos
    const bgPath = path.join(tmpDir, `bg_${Date.now()}.png`);
    const productPath = path.join(tmpDir, `prod_${Date.now()}.png`);
    const outPath = path.join(tmpDir, `out_${Date.now()}.png`);

    // Baixa as imagens
    await downloadToFile(backgroundUrl, bgPath);
    await downloadToFile(productUrl, productPath);

    // Instruções para o ImageMagick: "Pegue o fundo, redimensione, coloque o produto em cima..."
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

    await runMagick(args); // Executa a montagem

    const outBuf = await fs.readFile(outPath); // Lê o resultado
    res.setHeader("Content-Type", "image/png"); // Avisa que é uma imagem
    res.send(outBuf); // Envia a imagem pronta

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Fábrica rodando na porta ${port}`));
